import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireRoles } from "../auth/authorization.js";
import { UserRepository } from "../auth/user-repository.js";
import { PAYMENT_METHODS } from "../sales/repository.js";
import { parseNfeXml } from "../purchases/xml-parser.js";
import { FinanceRepository, type FinancialType } from "./repository.js";

const entrySchema = z.object({
  description: z.string().trim().min(2).max(255),
  amount: z.coerce.number().positive(),
  dueDate: z.string().date().optional(),
  customerId: z.coerce.number().int().positive().optional(),
  supplierId: z.coerce.number().int().positive().optional()
});
const idSchema = z.object({ id: z.coerce.number().int().positive() });
const listSchema = z.object({ status: z.enum(["PENDING", "PARTIAL", "PAID", "RECEIVED"]).optional() });
const settlementSchema = z.object({
  amount: z.coerce.number().positive(),
  paymentMethod: z.enum(PAYMENT_METHODS),
  cashSessionId: z.coerce.number().int().positive().optional(),
  financialAccountId: z.coerce.number().int().positive().optional(),
  notes: z.string().trim().max(255).optional()
}).refine((value) => value.cashSessionId !== undefined || value.financialAccountId !== undefined, {
  message: "Informe o caixa ou a conta financeira.",
  path: ["cashSessionId"]
});
const importXmlSchema = z.object({
  xml: z.string().min(20),
  supplierId: z.coerce.number().int().positive(),
  dueDate: z.string().date(),
  description: z.string().trim().min(2).max(255).optional()
});

async function settle(
  type: FinancialType,
  finance: FinanceRepository,
  id: number,
  input: z.infer<typeof settlementSchema>,
  requestUserId: number,
  users: UserRepository,
  reply: any
) {
  if (type === "RECEIVABLE") {
    const roles = await users.findRoleNames(requestUserId);
    if (roles.includes("VENDAS") && !roles.includes("ADMIN") && !roles.includes("FINANCEIRO")) {
      if (!input.cashSessionId) return reply.code(400).send({ message: "O vendedor deve receber a conta pelo próprio caixa." });
      const session = await finance.getCashSessionOwner(input.cashSessionId);
      if (!session) return reply.code(404).send({ message: "Caixa não encontrado ou fechado." });
      if (session.seller_id !== requestUserId) return reply.code(403).send({ message: "O vendedor só pode receber no próprio caixa." });
    }
  }

  const result = await finance.settle(
    id,
    type,
    input.amount,
    input.paymentMethod,
    input.cashSessionId,
    input.financialAccountId,
    input.notes
  );
  if (result === "not_found") return reply.code(404).send({ message: "Conta não encontrada." });
  if (result === "already_settled") return reply.code(409).send({ message: "Esta conta já foi totalmente baixada." });
  if (result === "exceeds_remaining") return reply.code(400).send({ message: "O valor informado ultrapassa o saldo em aberto." });
  return { entry: result };
}

export function registerFinanceRoutes(app: FastifyInstance, users: UserRepository, finance: FinanceRepository) {
  const financeRoles = ["ADMIN", "FINANCEIRO"] as const;

  app.get("/finance/payables", { onRequest: [app.authenticate] }, async (request, reply) => {
    if (!(await requireRoles(request, reply, users, [...financeRoles]))) return;
    const { status } = listSchema.parse(request.query);
    return { payables: await finance.list("PAYABLE", status) };
  });

  app.post("/finance/payables", { onRequest: [app.authenticate] }, async (request, reply) => {
    if (!(await requireRoles(request, reply, users, [...financeRoles]))) return;
    const input = entrySchema.parse(request.body);
    if (!input.supplierId) return reply.code(400).send({ message: "Fornecedor é obrigatório para conta a pagar." });
    const entry = await finance.create({
      type: "PAYABLE", description: input.description, amount: input.amount, dueDate: input.dueDate,
      supplierId: input.supplierId
    });
    return reply.code(201).send({ entry });
  });

  app.post("/finance/payables/import-xml", { onRequest: [app.authenticate] }, async (request, reply) => {
    if (!(await requireRoles(request, reply, users, [...financeRoles]))) return;
    const input = importXmlSchema.parse(request.body);
    try {
      const invoice = parseNfeXml(input.xml);
      const entry = await finance.create({
        type: "PAYABLE",
        description: input.description ?? `NF-e ${invoice.number ?? "sem número"} - ${invoice.supplier.name ?? "Fornecedor"}`,
        amount: invoice.total,
        dueDate: input.dueDate,
        supplierId: input.supplierId,
        source: "XML",
        documentNumber: invoice.number ?? invoice.accessKey ?? null,
        xmlRaw: input.xml
      });
      return reply.code(201).send({ entry, invoice });
    } catch (error) {
      return reply.code(400).send({ message: error instanceof Error ? error.message : "Não foi possível interpretar o XML." });
    }
  });

  app.post("/finance/payables/:id/pay", { onRequest: [app.authenticate] }, async (request, reply) => {
    if (!(await requireRoles(request, reply, users, [...financeRoles]))) return;
    const { id } = idSchema.parse(request.params);
    return settle("PAYABLE", finance, id, settlementSchema.parse(request.body), Number(request.user.sub), users, reply);
  });

  app.get("/finance/receivables", { onRequest: [app.authenticate] }, async (request, reply) => {
    if (!(await requireRoles(request, reply, users, [...financeRoles]))) return;
    const { status } = listSchema.parse(request.query);
    return { receivables: await finance.list("RECEIVABLE", status) };
  });

  app.post("/finance/receivables", { onRequest: [app.authenticate] }, async (request, reply) => {
    if (!(await requireRoles(request, reply, users, [...financeRoles]))) return;
    const input = entrySchema.parse(request.body);
    if (!input.customerId) return reply.code(400).send({ message: "Cliente é obrigatório para conta a receber." });
    const entry = await finance.create({
      type: "RECEIVABLE", description: input.description, amount: input.amount, dueDate: input.dueDate,
      customerId: input.customerId
    });
    return reply.code(201).send({ entry });
  });

  app.post("/finance/receivables/:id/receive", { onRequest: [app.authenticate] }, async (request, reply) => {
    const requestUserId = Number(request.user.sub);
    const roles = await users.findRoleNames(requestUserId);
    const allowed = roles.includes("ADMIN") || roles.includes("FINANCEIRO") || roles.includes("VENDAS");
    if (!allowed) return reply.code(403).send({ message: "Acesso não autorizado." });
    const { id } = idSchema.parse(request.params);
    return settle("RECEIVABLE", finance, id, settlementSchema.parse(request.body), requestUserId, users, reply);
  });
}
