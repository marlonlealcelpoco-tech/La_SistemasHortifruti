import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireRoles } from "../../auth/authorization.js";
import { UserRepository } from "../../auth/user-repository.js";
import { ROLE_POLICY } from "../../auth/role-policy.js";
import { CustomerRepository } from "./repository.js";

const idSchema = z.object({ id: z.coerce.number().int().positive() });
const searchSchema = z.object({ search: z.string().trim().min(1).max(180).optional() });
const customerSchema = z.object({
  name: z.string().trim().min(2).max(180),
  document: z.string().trim().max(30).nullable().optional(),
  email: z.string().email().max(180).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional()
});
const statusSchema = z.object({ active: z.boolean() });

export function registerCustomerRoutes(app: FastifyInstance, users: UserRepository, customers: CustomerRepository) {
  const queryRoles = ["ADMIN", "GERENTE", "FINANCEIRO", "SUPERVISOR", "VENDAS", "ESTOQUE"] as const;

  app.get("/customers", { onRequest: [app.authenticate] }, async (request, reply) => {
    if (!(await requireRoles(request, reply, users, queryRoles))) return;
    const { search } = searchSchema.parse(request.query);
    return { customers: await customers.list(search) };
  });

  app.post("/customers", { onRequest: [app.authenticate] }, async (request, reply) => {
    if (!(await requireRoles(request, reply, users, ROLE_POLICY.CUSTOMER_MAINTENANCE))) return;
    const customer = await customers.create(customerSchema.parse(request.body));
    return reply.code(201).send({ customer });
  });

  app.put("/customers/:id", { onRequest: [app.authenticate] }, async (request, reply) => {
    if (!(await requireRoles(request, reply, users, ROLE_POLICY.CUSTOMER_MAINTENANCE))) return;
    const { id } = idSchema.parse(request.params);
    const customer = await customers.update(id, customerSchema.parse(request.body));
    if (!customer) return reply.code(404).send({ message: "Cliente não encontrado." });
    return { customer };
  });

  app.patch("/customers/:id/status", { onRequest: [app.authenticate] }, async (request, reply) => {
    if (!(await requireRoles(request, reply, users, ROLE_POLICY.CUSTOMER_MAINTENANCE))) return;
    const { id } = idSchema.parse(request.params);
    const { active } = statusSchema.parse(request.body);
    const customer = await customers.setActive(id, active);
    if (!customer) return reply.code(404).send({ message: "Cliente não encontrado." });
    return { customer };
  });
}
