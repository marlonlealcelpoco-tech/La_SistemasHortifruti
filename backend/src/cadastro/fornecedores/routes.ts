import type { FastifyInstance } from "fastify";
import { requireRoles } from "../../auth/authorization.js";
import { UserRepository } from "../../auth/user-repository.js";
import { ROLE_POLICY } from "../../auth/role-policy.js";
import { SupplierRepository } from "./repository.js";
import { supplierIdSchema, supplierSchema, supplierSearchSchema, supplierStatusSchema } from "./schema.js";

export function registerSupplierRoutes(app: FastifyInstance, users: UserRepository, suppliers: SupplierRepository) {
  const supplierQueryRoles = ["ADMIN", "GERENTE", "FINANCEIRO"] as const;

  app.get("/suppliers", { onRequest: [app.authenticate] }, async (request, reply) => {
    if (!(await requireRoles(request, reply, users, supplierQueryRoles))) return;
    const { search } = supplierSearchSchema.parse(request.query);
    return { suppliers: await suppliers.list(search) };
  });

  app.post("/suppliers", { onRequest: [app.authenticate] }, async (request, reply) => {
    if (!(await requireRoles(request, reply, users, ROLE_POLICY.PURCHASE_MAINTENANCE))) return;
    const supplier = await suppliers.create(supplierSchema.parse(request.body));
    return reply.code(201).send({ supplier });
  });

  app.put("/suppliers/:id", { onRequest: [app.authenticate] }, async (request, reply) => {
    if (!(await requireRoles(request, reply, users, ROLE_POLICY.PURCHASE_MAINTENANCE))) return;
    const { id } = supplierIdSchema.parse(request.params);
    const supplier = await suppliers.update(id, supplierSchema.parse(request.body));
    if (!supplier) return reply.code(404).send({ message: "Fornecedor não encontrado." });
    return { supplier };
  });

  app.patch("/suppliers/:id/status", { onRequest: [app.authenticate] }, async (request, reply) => {
    if (!(await requireRoles(request, reply, users, ROLE_POLICY.PURCHASE_MAINTENANCE))) return;
    const { id } = supplierIdSchema.parse(request.params);
    const { active } = supplierStatusSchema.parse(request.body);
    const supplier = await suppliers.setActive(id, active);
    if (!supplier) return reply.code(404).send({ message: "Fornecedor não encontrado." });
    return { supplier };
  });
}
