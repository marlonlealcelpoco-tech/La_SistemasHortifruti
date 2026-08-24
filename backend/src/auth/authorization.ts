import type { FastifyReply, FastifyRequest } from "fastify";
import type { UserRole } from "./user-repository.js";
import { UserRepository } from "./user-repository.js";

export async function requireRoles(
  request: FastifyRequest,
  reply: FastifyReply,
  users: UserRepository,
  allowedRoles: readonly UserRole[]
): Promise<boolean> {
  const roles = await users.findRoleNames(Number(request.user.sub));
  if (allowedRoles.some((role) => roles.includes(role))) {
    return true;
  }

  reply.code(403).send({ message: "Você não possui permissão para esta operação." });
  return false;
}
