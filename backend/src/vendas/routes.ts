import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireRoles } from "../auth/authorization.js";
import { UserRepository } from "../auth/user-repository.js";
import { PAYMENT_METHODS, SALE_DOCUMENT_TYPES, SalesRepository } from "./repository.js";
import { SupervisorActionsRepository } from "./supervisor-actions.js";

const saleIdSchema = z.object({ id: z.coerce.number().int().positive() });
const itemIdSchema = z.object({ id: z.coerce.number().int().positive(), itemId: z.coerce.number().int().positive() });
const paymentSchema = z.object({ paymentMethod: z.enum(PAYMENT_METHODS), amount: z.coerce.number().positive(), dueDate: z.string().date().optional() }).superRefine((payment, context) => {
  if (payment.paymentMethod === "CREDIT" && !payment.dueDate) context.addIssue({ code: z.ZodIssueCode.custom, message: "Venda a prazo exige data de vencimento.", path: ["dueDate"] });
});
const saleSchema = z.object({
  cashSessionId: z.coerce.number().int().positive(), customerId: z.coerce.number().int().positive().nullable().optional(),
  documentType: z.enum(SALE_DOCUMENT_TYPES).default("GERENCIAL"),
  items: z.array(z.object({ productId: z.coerce.number().int().positive(), quantity: z.coerce.number().positive(), unitPrice: z.coerce.number().nonnegative() })).min(1),
  payments: z.array(paymentSchema).min(1)
}).superRefine((sale, context) => {
  const hasCreditSale = sale.payments.some((payment) => payment.paymentMethod === "CREDIT");
  if (hasCreditSale && !sale.customerId) context.addIssue({ code: z.ZodIssueCode.custom, message: "Venda a prazo exige cliente identificado.", path: ["customerId"] });
  const itemsTotal = sale.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const paymentsTotal = sale.payments.reduce((sum, payment) => sum + payment.amount, 0);
  if (Math.abs(itemsTotal - paymentsTotal) > 0.005) context.addIssue({ code: z.ZodIssueCode.custom, message: "A soma dos pagamentos deve ser igual ao total da venda.", path: ["payments"] });
});

const fiscalResultSchema = z.object({ status: z.enum(["AUTHORIZED", "REJECTED"]), errorCode: z.string().trim().max(100).nullable().optional(), errorMessage: z.string().trim().max(1000).nullable().optional(), accessKey: z.string().trim().length(44).nullable().optional(), protocol: z.string().trim().max(100).nullable().optional(), xmlRaw: z.string().nullable().optional() });
const SUPERVISOR_ROLES = ["ADMIN", "GERENTE", "SUPERVISOR"] as const;
const PDV_ROLES = ["ADMIN", "GERENTE", "SUPERVISOR", "VENDAS"] as const;

export function registerSalesRoutes(app: FastifyInstance, users: UserRepository, sales: SalesRepository, supervisorActions: SupervisorActionsRepository) {
  app.post("/sales", { onRequest: [app.authenticate] }, async (request, reply) => {
    if (!(await requireRoles(request, reply, users, [...PDV_ROLES]))) return;
    const input = saleSchema.parse(request.body);
    const sale = await sales.create({ ...input, sellerId: Number(request.user.sub) });
    return reply.code(201).send({ sale, fiscal: input.documentType === "FISCAL" ? { status: "PENDING" } : { status: "NOT_APPLICABLE" } });
  });

  app.get("/sales/fiscal/pending", { onRequest: [app.authenticate] }, async (request, reply) => {
    if (!(await requireRoles(request, reply, users, [...PDV_ROLES]))) return;
    return { documents: await sales.fiscalPending() };
  });

  // O emissor NFC-e externo deve chamar este endpoint após a tentativa de autorização.
  // A venda/caixa nunca é desfeita por uma rejeição fiscal.
  app.post("/sales/:id/fiscal/result", { onRequest: [app.authenticate] }, async (request, reply) => {
    if (!(await requireRoles(request, reply, users, [...PDV_ROLES]))) return;
    const { id } = saleIdSchema.parse(request.params);
    const result = fiscalResultSchema.parse(request.body);
    return { fiscal: await sales.registerFiscalResult({ saleId: id, ...result }) };
  });

  app.post("/sales/:id/cancel", { onRequest: [app.authenticate] }, async (request, reply) => {
    if (!(await requireRoles(request, reply, users, [...SUPERVISOR_ROLES]))) return;
    const { id } = saleIdSchema.parse(request.params);
    const result = await sales.cancel(id, Number(request.user.sub));
    if (result === "not_found") return reply.code(404).send({ message: "Venda não encontrada." });
    if (result === "not_allowed") return reply.code(403).send({ message: "A venda pertence a outro vendedor." });
    if (result === "already_cancelled") return reply.code(409).send({ message: "A venda já foi cancelada." });
    return { sale: result };
  });

  app.post("/sales/:id/items/:itemId/cancel", { onRequest: [app.authenticate] }, async (request, reply) => {
    if (!(await requireRoles(request, reply, users, [...SUPERVISOR_ROLES]))) return;
    const { id, itemId } = itemIdSchema.parse(request.params);
    const body = z.object({ reason: z.string().trim().min(3).max(255) }).parse(request.body);
    return reply.send(await supervisorActions.cancelItem({ saleId: id, saleItemId: itemId, supervisorId: Number(request.user.sub), reason: body.reason }));
  });

  app.post("/sales/:id/discount/authorize", { onRequest: [app.authenticate] }, async (request, reply) => {
    if (!(await requireRoles(request, reply, users, [...SUPERVISOR_ROLES]))) return;
    const { id } = saleIdSchema.parse(request.params);
    const body = z.object({ amount: z.coerce.number().positive(), reason: z.string().trim().min(3).max(255) }).parse(request.body);
    return reply.code(201).send(await supervisorActions.authorizeDiscount({ saleId: id, supervisorId: Number(request.user.sub), amount: body.amount, reason: body.reason }));
  });

  app.post("/sales/:id/exchange/authorize", { onRequest: [app.authenticate] }, async (request, reply) => {
    if (!(await requireRoles(request, reply, users, [...SUPERVISOR_ROLES]))) return;
    const { id } = saleIdSchema.parse(request.params);
    const body = z.object({ customerId: z.coerce.number().int().positive(), productId: z.coerce.number().int().positive(), quantity: z.coerce.number().positive(), reason: z.enum(["CUSTOMER_REGRET", "WRONG_PRODUCT", "DEFECT", "OTHER"]), notes: z.string().max(255).optional(), authorizationReason: z.string().trim().min(3).max(255) }).parse(request.body);
    return reply.code(201).send(await supervisorActions.authorizeExchange({ saleId: id, supervisorId: Number(request.user.sub), customerId: body.customerId, productId: body.productId, quantity: body.quantity, reason: body.reason, notes: body.notes, authorizationReason: body.authorizationReason }));
  });
}
