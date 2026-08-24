import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireRoles } from "../auth/authorization.js";
import { UserRepository } from "../auth/user-repository.js";
import { ROLE_POLICY } from "../auth/role-policy.js";
import { PartyRepository, type PartyType } from "./repository.js";

const idSchema = z.object({ id: z.coerce.number().int().positive() });
const searchSchema = z.object({ search: z.string().trim().min(1).max(180).optional() });
const partySchema = z.object({ name: z.string().trim().min(2).max(180), document: z.string().trim().max(30).nullable().optional(), email: z.string().email().max(180).nullable().optional(), phone: z.string().trim().max(40).nullable().optional() });
const statusSchema = z.object({ active: z.boolean() });

function registerPartyResourceRoutes(app: FastifyInstance, users: UserRepository, parties: PartyRepository, type: PartyType, path: string, queryRoles: Parameters<typeof requireRoles>[3], maintenanceRoles: Parameters<typeof requireRoles>[3]) {
  app.get(path, { onRequest: [app.authenticate] }, async (request, reply) => {
    if (!(await requireRoles(request, reply, users, queryRoles))) return;
    const { search } = searchSchema.parse(request.query);
    return { [type]: await parties.list(type, search) };
  });

  app.post(path, { onRequest: [app.authenticate] }, async (request, reply) => {
    if (!(await requireRoles(request, reply, users, maintenanceRoles))) return;
    const party = await parties.create(type, partySchema.parse(request.body));
    return reply.code(201).send({ [type.slice(0, -1)]: party });
  });

  app.put(`${path}/:id`, { onRequest: [app.authenticate] }, async (request, reply) => {
    if (!(await requireRoles(request, reply, users, maintenanceRoles))) return;
    const { id } = idSchema.parse(request.params);
    const party = await parties.update(id, type, partySchema.parse(request.body));
    if (!party) return reply.code(404).send({ message: "Cadastro não encontrado." });
    return { [type.slice(0, -1)]: party };
  });

  app.patch(`${path}/:id/status`, { onRequest: [app.authenticate] }, async (request, reply) => {
    if (!(await requireRoles(request, reply, users, maintenanceRoles))) return;
    const { id } = idSchema.parse(request.params);
    const { active } = statusSchema.parse(request.body);
    const party = await parties.setActive(id, type, active);
    if (!party) return reply.code(404).send({ message: "Cadastro não encontrado." });
    return { [type.slice(0, -1)]: party };
  });
}

export function registerPartyRoutes(app: FastifyInstance, users: UserRepository, parties: PartyRepository) {
  const customerQueryRoles = ["ADMIN", "GERENTE", "FINANCEIRO", "SUPERVISOR", "VENDAS", "ESTOQUE"] as const;
  const supplierQueryRoles = ["ADMIN", "GERENTE", "FINANCEIRO"] as const;
  registerPartyResourceRoutes(app, users, parties, "customers", "/customers", customerQueryRoles, ROLE_POLICY.CUSTOMER_MAINTENANCE);
  registerPartyResourceRoutes(app, users, parties, "suppliers", "/suppliers", supplierQueryRoles, ROLE_POLICY.PURCHASE_MAINTENANCE);
}
