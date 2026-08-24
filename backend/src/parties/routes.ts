import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireRoles } from "../auth/authorization.js";
import { UserRepository } from "../auth/user-repository.js";
import { ROLE_POLICY } from "../auth/role-policy.js";
import { PartyRepository } from "./repository.js";

const idSchema = z.object({ id: z.coerce.number().int().positive() });
const searchSchema = z.object({ search: z.string().trim().min(1).max(180).optional() });
const partySchema = z.object({
  name: z.string().trim().min(2).max(180),
  document: z.string().trim().max(30).nullable().optional(),
  email: z.string().email().max(180).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional()
});
const statusSchema = z.object({ active: z.boolean() });

export function registerPartyRoutes(app: FastifyInstance, users: UserRepository, parties: PartyRepository) {
  const supplierQueryRoles = ["ADMIN", "GERENTE", "FINANCEIRO"] as const;

  app.get("/suppliers", { onRequest: [app.authenticate] }, async (request, reply) => {
    if (!(await requireRoles(request, reply, users, supplierQueryRoles))) return;
    const { search } = searchSchema.parse(request.query);
    return { suppliers: await parties.list("suppliers", search) };
  });

  app.post("/suppliers", { onRequest: [app.authenticate] }, async (request, reply) => {
    if (!(await requireRoles(request, reply, users, ROLE_POLICY.PURCHASE_MAINTENANCE))) return;
    const supplier = await parties.create("suppliers", partySchema.parse(request.body));
    return reply.code(201).send({ supplier });
  });

  app.put("/suppliers/:id", { onRequest: [app.authenticate] }, async (request, reply) => {
    if (!(await requireRoles(request, reply, users, ROLE_POLICY.PURCHASE_MAINTENANCE))) return;
    const { id } = idSchema.parse(request.params);
    const supplier = await parties.update(id, "suppliers", partySchema.parse(request.body));
    if (!supplier) return reply.code(404).send({ message: "Fornecedor não encontrado." });
    return { supplier };
  });

  app.patch("/suppliers/:id/status", { onRequest: [app.authenticate] }, async (request, reply) => {
    if (!(await requireRoles(request, reply, users, ROLE_POLICY.PURCHASE_MAINTENANCE))) return;
    const { id } = idSchema.parse(request.params);
    const { active } = statusSchema.parse(request.body);
    const supplier = await parties.setActive(id, "suppliers", active);
    if (!supplier) return reply.code(404).send({ message: "Fornecedor não encontrado." });
    return { supplier };
  });
}
