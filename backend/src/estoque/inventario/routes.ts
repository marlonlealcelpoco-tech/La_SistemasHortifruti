import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireRoles } from "../../auth/authorization.js";
import { UserRepository } from "../../auth/user-repository.js";
import { InventoryRepository, MOVEMENT_TYPES } from "./repository.js";

const productIdSchema = z.object({ productId: z.coerce.number().int().positive() });
const movementSchema = z.object({
  productId: z.coerce.number().int().positive(),
  type: z.enum(MOVEMENT_TYPES),
  quantity: z.coerce.number().finite().refine((value) => value !== 0, "A quantidade não pode ser zero."),
  reference: z.string().trim().max(100).nullable().optional(),
  notes: z.string().trim().max(255).nullable().optional()
}).superRefine((value, context) => {
  if (value.type !== "ADJUSTMENT" && value.quantity <= 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Entradas e saídas devem ter quantidade positiva.", path: ["quantity"] });
  }
});

export function registerInventoryRoutes(app: FastifyInstance, users: UserRepository, inventory: InventoryRepository) {
  app.get("/products/:productId/movements", { onRequest: [app.authenticate] }, async (request, reply) => {
    if (!(await requireRoles(request, reply, users, ["ADMIN", "GERENTE", "ESTOQUE", "SUPERVISOR", "FINANCEIRO"]))) return;
    const { productId } = productIdSchema.parse(request.params);
    return { movements: await inventory.listMovements(productId) };
  });

  app.post("/inventory/movements", { onRequest: [app.authenticate] }, async (request, reply) => {
    if (!(await requireRoles(request, reply, users, ["ADMIN", "GERENTE", "ESTOQUE"]))) return;
    const result = await inventory.move(movementSchema.parse(request.body));
    if (result.kind === "not_found") return reply.code(404).send({ message: "Produto não encontrado." });
    if (result.kind === "insufficient") return reply.code(409).send({ message: "Estoque insuficiente para esta saída ou ajuste." });
    return reply.code(201).send({ movement: result.movement, quantity: result.quantity });
  });
}
