import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireRoles } from "../auth/authorization.js";
import { hashPassword } from "../auth/password.js";
import { ROLE_NAMES, UserRepository } from "../auth/user-repository.js";

const rolesSchema = z.array(z.enum(ROLE_NAMES)).min(1).transform((roles) => [...new Set(roles)]);
const userIdSchema = z.object({ id: z.coerce.number().int().positive() });

const createUserSchema = z.object({
  name: z.string().trim().min(2).max(150),
  email: z.string().email().max(180),
  password: z.string().min(8).max(128),
  roles: rolesSchema.default(["VENDAS"])
});

const updateRolesSchema = z.object({ roles: rolesSchema });
const updateStatusSchema = z.object({ active: z.boolean() });

export function registerUserRoutes(app: FastifyInstance, users: UserRepository) {
  app.get("/users", { onRequest: [app.authenticate] }, async (request, reply) => {
    if (!(await requireRoles(request, reply, users, ["ADMIN"]))) return;
    return { users: await users.list() };
  });

  app.post("/users", { onRequest: [app.authenticate] }, async (request, reply) => {
    if (!(await requireRoles(request, reply, users, ["ADMIN"]))) return;

    const input = createUserSchema.parse(request.body);
    const user = await users.createWithRoles(
      input.name,
      input.email,
      await hashPassword(input.password),
      input.roles
    );

    return reply.code(201).send({ user });
  });

  app.put("/users/:id/roles", { onRequest: [app.authenticate] }, async (request, reply) => {
    if (!(await requireRoles(request, reply, users, ["ADMIN"]))) return;

    const { id } = userIdSchema.parse(request.params);
    if (id === Number(request.user.sub)) {
      return reply.code(400).send({ message: "Não é permitido alterar os próprios perfis." });
    }

    const { roles } = updateRolesSchema.parse(request.body);
    const user = await users.replaceRoles(id, roles);
    if (!user) return reply.code(404).send({ message: "Usuário não encontrado." });

    return { user };
  });

  app.patch("/users/:id/status", { onRequest: [app.authenticate] }, async (request, reply) => {
    if (!(await requireRoles(request, reply, users, ["ADMIN"]))) return;

    const { id } = userIdSchema.parse(request.params);
    if (id === Number(request.user.sub)) {
      return reply.code(400).send({ message: "Não é permitido desativar o próprio acesso." });
    }

    const { active } = updateStatusSchema.parse(request.body);
    const user = await users.setActive(id, active);
    if (!user) return reply.code(404).send({ message: "Usuário não encontrado." });

    return { user };
  });
}
