import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireRoles } from "../auth/authorization.js";
import { UserRepository } from "../auth/user-repository.js";
import { ROLE_POLICY } from "../auth/role-policy.js";
import { FinanceRepository } from "../financeiro/repository.js";
import { CASH_EVENT_TYPES, CashRepository } from "./repository.js";

const sessionIdSchema = z.object({ id: z.coerce.number().int().positive() });
const openSchema = z.object({ terminalId: z.string().trim().min(1).max(100), openingAmount: z.coerce.number().nonnegative().default(0), sellerId: z.coerce.number().int().positive().optional() });
const transactionSchema = z.object({ type: z.enum(CASH_EVENT_TYPES), amount: z.coerce.number().positive(), description: z.string().trim().min(2).max(255).optional() });
const closeSchema = z.object({ closingAmount: z.coerce.number().nonnegative() });
const receiveSchema = z.object({ amount: z.coerce.number().positive(), paymentMethod: z.string().trim().min(1).max(30), notes: z.string().trim().max(255).optional() });
const listSchema = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), terminalId: z.string().trim().min(1).max(100).optional() });

async function canAccessSession(sessionId: number, currentUserId: number, users: UserRepository, cash: CashRepository): Promise<boolean> {
  const session = await cash.find(sessionId);
  if (!session) return false;
  const roles = await users.findRoleNames(currentUserId);
  return session.seller_id === currentUserId || roles.includes("ADMIN");
}

export function registerCashRoutes(app: FastifyInstance, users: UserRepository, cash: CashRepository, finance: FinanceRepository) {
  app.post("/cash-sessions", { onRequest: [app.authenticate] }, async (request, reply) => {
    if (!(await requireRoles(request, reply, users, ROLE_POLICY.CASH_OPERATORS))) return;
    const input = openSchema.parse(request.body);
    const currentUserId = Number(request.user.sub);
    const roles = await users.findRoleNames(currentUserId);
    const sellerId = input.sellerId ?? currentUserId;
    if (sellerId !== currentUserId && !roles.some((role) => ["ADMIN", "GERENTE"].includes(role))) return reply.code(403).send({ message: "Somente administradores ou gerentes podem abrir caixa para outro operador." });
    const session = await cash.open(input.terminalId, sellerId, input.openingAmount);
    if (session === "already_open") return reply.code(409).send({ message: "Já existe um caixa aberto neste computador." });
    return reply.code(201).send({ cashSession: session, cashNumber: `CX-${String(session.id).padStart(6, "0")}` });
  });

  app.post("/cash-sessions/:id/transactions", { onRequest: [app.authenticate] }, async (request, reply) => {
    if (!(await requireRoles(request, reply, users, ROLE_POLICY.CASH_OPERATORS))) return;
    const { id } = sessionIdSchema.parse(request.params);
    const currentUserId = Number(request.user.sub);
    if (!(await canAccessSession(id, currentUserId, users, cash))) return reply.code(403).send({ message: "Você não possui acesso a este caixa." });
    const input = transactionSchema.parse(request.body);
    const created = await cash.addEvent(id, input.type, input.amount, input.description);
    if (!created) return reply.code(409).send({ message: "O caixa não está aberto." });
    return reply.code(201).send({ message: "Movimento registrado." });
  });

  app.get("/cash-sessions/:id/receivables", { onRequest: [app.authenticate] }, async (request, reply) => {
    if (!(await requireRoles(request, reply, users, ROLE_POLICY.CASH_OPERATORS))) return;
    const { id } = sessionIdSchema.parse(request.params);
    const currentUserId = Number(request.user.sub);
    if (!(await canAccessSession(id, currentUserId, users, cash))) return reply.code(403).send({ message: "Você não possui acesso a este caixa." });
    return { receivables: await finance.list("RECEIVABLE", "PENDING") };
  });

  app.post("/cash-sessions/:id/receivables/:entryId/receive", { onRequest: [app.authenticate] }, async (request, reply) => {
    if (!(await requireRoles(request, reply, users, ROLE_POLICY.CASH_OPERATORS))) return;
    const { id } = sessionIdSchema.parse(request.params);
    const entryId = z.coerce.number().int().positive().parse((request.params as { entryId: unknown }).entryId);
    const currentUserId = Number(request.user.sub);
    if (!(await canAccessSession(id, currentUserId, users, cash))) return reply.code(403).send({ message: "Você não possui acesso a este caixa." });
    const input = receiveSchema.parse(request.body);
    const result = await finance.settle(entryId, "RECEIVABLE", input.amount, input.paymentMethod, id, null, input.notes ?? null);
    if (result === "not_found") return reply.code(404).send({ message: "Conta a receber não encontrada." });
    if (result === "already_settled") return reply.code(409).send({ message: "A conta a receber já está quitada." });
    if (result === "exceeds_remaining") return reply.code(409).send({ message: "O recebimento é maior que o saldo da conta." });
    return { receivable: result, cashSessionId: id, receivedAmount: input.amount };
  });

  app.get("/cash-sessions/:id/report", { onRequest: [app.authenticate] }, async (request, reply) => {
    if (!(await requireRoles(request, reply, users, [...ROLE_POLICY.CASH_OPERATORS, "FINANCEIRO"]))) return;
    const { id } = sessionIdSchema.parse(request.params);
    const currentUserId = Number(request.user.sub);
    const roles = await users.findRoleNames(currentUserId);
    if (!roles.includes("FINANCEIRO") && !(await canAccessSession(id, currentUserId, users, cash))) return reply.code(403).send({ message: "Você não possui acesso a este caixa." });
    const report = await cash.report(id);
    if (!report) return reply.code(404).send({ message: "Caixa não encontrado." });
    return report;
  });

  app.post("/cash-sessions/:id/close", { onRequest: [app.authenticate] }, async (request, reply) => {
    if (!(await requireRoles(request, reply, users, ROLE_POLICY.CASH_OPERATORS))) return;
    const { id } = sessionIdSchema.parse(request.params);
    const currentUserId = Number(request.user.sub);
    if (!(await canAccessSession(id, currentUserId, users, cash))) return reply.code(403).send({ message: "Você não possui acesso a este caixa." });
    const { closingAmount } = closeSchema.parse(request.body);
    const closed = await cash.close(id, closingAmount);
    if (closed === "not_found") return reply.code(404).send({ message: "Caixa não encontrado." });
    if (closed === "already_closed") return reply.code(409).send({ message: "Este caixa já foi fechado." });
    return { report: closed };
  });

  app.get("/cash-reports/daily", { onRequest: [app.authenticate] }, async (request, reply) => {
    if (!(await requireRoles(request, reply, users, ROLE_POLICY.CASH_REPORTS))) return;
    const input = listSchema.parse(request.query);
    const sessions = await cash.list(input.date, input.terminalId);
    const reports = await Promise.all(sessions.map((session) => cash.report(session.id)));
    const salesByPaymentMethod: Record<string, number> = {};
    let expectedCash = 0;
    for (const report of reports) {
      if (!report) continue;
      const payments = report.salesByPaymentMethod as Record<string, number>;
      for (const [method, amount] of Object.entries(payments)) salesByPaymentMethod[method] = Number(((salesByPaymentMethod[method] ?? 0) + amount).toFixed(2));
      expectedCash += Number((report.totals as { expectedCash: number }).expectedCash);
    }
    return { date: input.date ?? null, terminalId: input.terminalId ?? null, sessions: reports, consolidated: { salesByPaymentMethod, expectedCash: Number(expectedCash.toFixed(2)) } };
  });
}
