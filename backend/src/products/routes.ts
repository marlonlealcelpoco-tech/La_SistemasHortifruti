import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireRoles } from "../auth/authorization.js";
import { UserRepository } from "../auth/user-repository.js";
import { ROLE_POLICY } from "../auth/role-policy.js";
import { ProductRepository } from "./repository.js";

const idSchema = z.object({ id: z.coerce.number().int().positive() });
const searchSchema = z.object({ search: z.string().trim().min(1).max(180).optional() });
const productSchema = z.object({
  code: z.string().trim().min(1).max(60),
  name: z.string().trim().min(2).max(180),
  description: z.string().trim().max(10_000).nullable().optional(),
  unit: z.string().trim().min(1).max(20).default("UN"),
  cost: z.coerce.number().nonnegative(),
  salePrice: z.coerce.number().nonnegative(),
  profitMarginPct: z.coerce.number().min(0).max(999.99).default(0)
});
const statusSchema = z.object({ active: z.boolean() });
const minimumSchema = z.object({ minimumQuantity: z.coerce.number().nonnegative() });

const PRODUCT_QUERY_ROLES = ["ADMIN", "GERENTE", "SUPERVISOR", "VENDAS", "ESTOQUE", "FINANCEIRO"] as const;

export function registerProductRoutes(app: FastifyInstance, users: UserRepository, products: ProductRepository) {
  app.get("/products", { onRequest: [app.authenticate] }, async (request, reply) => {
    if (!(await requireRoles(request, reply, users, [...PRODUCT_QUERY_ROLES]))) return;
    const { search } = searchSchema.parse(request.query);
    const roles = await users.findRoleNames(Number(request.user.sub));
    const canSeeCost = ROLE_POLICY.COST_VIEW.some((role) => roles.includes(role));
    const productsList = await products.list(search);

    if (canSeeCost) return { products: productsList };
    return { products: productsList.map(({ cost: _cost, ...product }) => product) };
  });

  app.post("/products", { onRequest: [app.authenticate] }, async (request, reply) => {
    if (!(await requireRoles(request, reply, users, ROLE_POLICY.PRODUCT_MAINTENANCE))) return;
    const product = await products.create(productSchema.parse(request.body));
    return reply.code(201).send({ product });
  });

  app.put("/products/:id", { onRequest: [app.authenticate] }, async (request, reply) => {
    if (!(await requireRoles(request, reply, users, ROLE_POLICY.PRODUCT_MAINTENANCE))) return;
    const { id } = idSchema.parse(request.params);
    const product = await products.update(id, productSchema.parse(request.body));
    if (!product) return reply.code(404).send({ message: "Produto não encontrado." });
    return { product };
  });

  app.patch("/products/:id/status", { onRequest: [app.authenticate] }, async (request, reply) => {
    if (!(await requireRoles(request, reply, users, ROLE_POLICY.PRODUCT_MAINTENANCE))) return;
    const { id } = idSchema.parse(request.params);
    const { active } = statusSchema.parse(request.body);
    const product = await products.setActive(id, active);
    if (!product) return reply.code(404).send({ message: "Produto não encontrado." });
    return { product };
  });

  app.put("/products/:id/minimum-stock", { onRequest: [app.authenticate] }, async (request, reply) => {
    if (!(await requireRoles(request, reply, users, ROLE_POLICY.PRODUCT_MAINTENANCE))) return;
    const { id } = idSchema.parse(request.params);
    const { minimumQuantity } = minimumSchema.parse(request.body);
    const product = await products.setMinimumQuantity(id, minimumQuantity);
    if (!product) return reply.code(404).send({ message: "Produto não encontrado." });
    return { product };
  });
}
