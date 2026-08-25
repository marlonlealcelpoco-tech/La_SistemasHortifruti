import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import Fastify, { type FastifyRequest } from "fastify";
import type { Pool } from "pg";
import { ZodError } from "zod";
import type { Environment } from "./config.js";
import { registerAuthRoutes } from "./auth/routes.js";
import { UserRepository } from "./auth/user-repository.js";
import { CashRepository } from "./cash/repository.js";
import { registerCashRoutes } from "./cash/routes.js";
import { CustomerRepository } from "./cadastro/clientes/repository.js";
import { registerCustomerRoutes } from "./cadastro/clientes/routes.js";
import { SupplierRepository } from "./cadastro/fornecedores/repository.js";
import { registerSupplierRoutes } from "./cadastro/fornecedores/routes.js";
import { ProductRepository } from "./cadastro/produtos/repository.js";
import { ProductService } from "./cadastro/produtos/service.js";
import { registerProductCadastroRoutes } from "./cadastro/produtos/routes.js";
import { InventoryRepository } from "./estoque/inventario/repository.js";
import { registerInventoryRoutes } from "./estoque/inventario/routes.js";
import { PurchaseRepository } from "./compras/repository.js";
import { registerPurchaseRoutes } from "./compras/routes.js";
import { FinanceRepository } from "./financeiro/repository.js";
import { registerFinanceRoutes } from "./financeiro/routes.js";
import { SalesRepository } from "./sales/repository.js";
import { SupervisorActionsRepository } from "./sales/supervisor-actions.js";
import { registerSalesRoutes } from "./sales/routes.js";
import { registerUserRoutes } from "./cadastro/usuarios/routes.js";

declare module "fastify" { interface FastifyInstance { authenticate(request: FastifyRequest): Promise<void>; } }

export function buildApp(environment: Environment, pool: Pool) {
  const app = Fastify({ logger: environment.NODE_ENV !== "test" });
  const users = new UserRepository(pool); const customers = new CustomerRepository(pool); const suppliers = new SupplierRepository(pool); const products = new ProductRepository(pool); const productService = new ProductService(products); const inventory = new InventoryRepository(pool); const purchases = new PurchaseRepository(pool); const finance = new FinanceRepository(pool); const cash = new CashRepository(pool); const sales = new SalesRepository(pool); const supervisorActions = new SupervisorActionsRepository(pool);
  app.register(cors, { origin: environment.CORS_ORIGIN ?? false }); app.register(jwt, { secret: environment.JWT_SECRET }); app.decorate("authenticate", async function authenticate(request) { await request.jwtVerify(); }); app.get("/health", async () => { await pool.query("SELECT 1"); return { status: "ok" }; });
  registerAuthRoutes(app, users, environment); registerUserRoutes(app, users); registerCustomerRoutes(app, users, customers); registerSupplierRoutes(app, users, suppliers); registerProductCadastroRoutes(app, users, productService); registerInventoryRoutes(app, users, inventory); registerPurchaseRoutes(app, users, purchases, products); registerFinanceRoutes(app, users, finance); registerCashRoutes(app, users, cash); registerSalesRoutes(app, users, sales, supervisorActions);
  app.setErrorHandler((error, _request, reply) => { if (error instanceof ZodError) return reply.code(400).send({ message: "Dados inválidos.", details: error.issues }); if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") return reply.code(409).send({ message: "Já existe um registro com estes dados." }); if (typeof error === "object" && error !== null && "code" in error && typeof error.code === "string" && error.code.startsWith("FST_JWT_")) { const message = error.code === "FST_JWT_NO_AUTHORIZATION_IN_HEADER" ? "Autenticação obrigatória." : "Token de autenticação inválido."; return reply.code(401).send({ message }); } app.log.error(error); if (environment.NODE_ENV === "test") { const message = error instanceof Error ? error.message : String(error); return reply.code(500).send({ message: "Erro interno do servidor.", details: message }); } return reply.code(500).send({ message: "Erro interno do servidor." }); });
  return app;
}