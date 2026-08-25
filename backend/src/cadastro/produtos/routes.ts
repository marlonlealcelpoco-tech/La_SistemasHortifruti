import type { FastifyInstance } from "fastify";
import { requireRoles } from "../../auth/authorization.js";
import { UserRepository } from "../../auth/user-repository.js";
import { ROLE_POLICY } from "../../auth/role-policy.js";
import { ProductService } from "./service.js";
import { productIdSchema, productSearchSchema, productSchema, productStatusSchema, productMinimumSchema } from "./schema.js";

const PRODUCT_QUERY_ROLES = ["ADMIN", "GERENTE", "SUPERVISOR", "VENDAS", "ESTOQUE", "FINANCEIRO"] as const;

export function registerProductCadastroRoutes(app: FastifyInstance, users: UserRepository, products: ProductService) {
  app.get("/products", { onRequest: [app.authenticate] }, async (request, reply) => {
    if (!(await requireRoles(request, reply, users, [...PRODUCT_QUERY_ROLES]))) return;
    const { search } = productSearchSchema.parse(request.query);
    const roles = await users.findRoleNames(Number(request.user.sub));
    const canSeeCost = ROLE_POLICY.COST_VIEW.some((role) => roles.includes(role));
    const list = await products.list(search);
    if (canSeeCost) return { products: list };
    return { products: list.map(({ cost: _cost, ...product }) => product) };
  });

  app.post("/products", { onRequest: [app.authenticate] }, async (request, reply) => {
    if (!(await requireRoles(request, reply, users, ROLE_POLICY.PRODUCT_MAINTENANCE))) return;
    const product = await products.create(productSchema.parse(request.body));
    return reply.code(201).send({ product });
  });

  app.put("/products/:id", { onRequest: [app.authenticate] }, async (request, reply) => {
    if (!(await requireRoles(request, reply, users, ROLE_POLICY.PRODUCT_MAINTENANCE))) return;
    const { id } = productIdSchema.parse(request.params);
    const product = await products.update(id, productSchema.parse(request.body));
    if (!product) return reply.code(404).send({ message: "Produto não encontrado." });
    return { product };
  });

  app.patch("/products/:id/status", { onRequest: [app.authenticate] }, async (request, reply) => {
    if (!(await requireRoles(request, reply, users, ROLE_POLICY.PRODUCT_MAINTENANCE))) return;
    const { id } = productIdSchema.parse(request.params);
    const { active } = productStatusSchema.parse(request.body);
    const product = await products.setActive(id, active);
    if (!product) return reply.code(404).send({ message: "Produto não encontrado." });
    return { product };
  });

  app.put("/products/:id/minimum-stock", { onRequest: [app.authenticate] }, async (request, reply) => {
    if (!(await requireRoles(request, reply, users, ROLE_POLICY.PRODUCT_MAINTENANCE))) return;
    const { id } = productIdSchema.parse(request.params);
    const { minimumQuantity } = productMinimumSchema.parse(request.body);
    const product = await products.setMinimumQuantity(id, minimumQuantity);
    if (!product) return reply.code(404).send({ message: "Produto não encontrado." });
    return { product };
  });
}
