import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Environment } from "../config.js";
import { hashPassword, verifyPassword } from "./password.js";
import { UserRepository } from "./user-repository.js";

const credentialsSchema = z.object({
  email: z.string().email().max(180),
  password: z.string().min(8).max(128)
});

const setupSchema = credentialsSchema.extend({
  name: z.string().trim().min(2).max(150),
  bootstrapToken: z.string().min(16)
});

function publicUser(user: { id: number; name: string; email: string; active: boolean }, roles: string[]) {
  return { id: user.id, name: user.name, email: user.email, active: user.active, roles };
}

export function registerAuthRoutes(
  app: FastifyInstance,
  users: UserRepository,
  environment: Environment
) {
  app.post("/auth/setup", async (request, reply) => {
    const input = setupSchema.parse(request.body);

    if (input.bootstrapToken !== environment.BOOTSTRAP_TOKEN) {
      return reply.code(403).send({ message: "Token de inicialização inválido." });
    }

    if (await users.count() > 0) {
      return reply.code(409).send({ message: "O administrador inicial já foi criado." });
    }

    const user = await users.createWithRoles(
      input.name,
      input.email,
      await hashPassword(input.password),
      ["ADMIN"]
    );
    const token = await reply.jwtSign({ sub: String(user.id), email: user.email });
    return reply.code(201).send({ user, token });
  });

  app.post("/auth/login", async (request, reply) => {
    const input = credentialsSchema.parse(request.body);
    const user = await users.findByEmail(input.email);

    if (!user || !user.active || !(await verifyPassword(input.password, user.password_hash))) {
      return reply.code(401).send({ message: "E-mail ou senha inválidos." });
    }

    const token = await reply.jwtSign({ sub: String(user.id), email: user.email });
    return { user: publicUser(user, await users.findRoleNames(user.id)), token };
  });

  app.get("/auth/me", { onRequest: [app.authenticate] }, async (request, reply) => {
    const id = Number(request.user.sub);
    const user = await users.findById(id);

    if (!user || !user.active) {
      return reply.code(401).send({ message: "Usuário não autorizado." });
    }

    return { user: publicUser(user, await users.findRoleNames(user.id)) };
  });
}
