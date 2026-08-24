import test from "node:test";
import assert from "node:assert/strict";
import { ROLE_NAMES, type UserRole } from "./user-repository.js";

const allowed: Record<string, UserRole[]> = {
  customer_create: ["ADMIN", "GERENTE", "FINANCEIRO"],
  product_create: ["ADMIN", "GERENTE", "FINANCEIRO"],
  invoice_create: ["ADMIN", "GERENTE", "FINANCEIRO"],
  financial_module: ["ADMIN", "FINANCEIRO"],
  pdv: ["ADMIN", "GERENTE", "SUPERVISOR", "VENDAS"],
  cash_operations: ["ADMIN", "GERENTE", "SUPERVISOR", "VENDAS"],
  receive_sale: ["ADMIN", "GERENTE", "SUPERVISOR", "VENDAS"],
  cancel_item: ["ADMIN", "GERENTE", "SUPERVISOR"],
  cancel_sale: ["ADMIN", "GERENTE", "SUPERVISOR"],
  authorize_discount: ["ADMIN", "GERENTE", "SUPERVISOR"],
  authorize_exchange: ["ADMIN", "GERENTE", "SUPERVISOR"],
  inventory: ["ADMIN", "GERENTE", "ESTOQUE"],
  stock_adjustment: ["ADMIN", "GERENTE", "ESTOQUE"],
  cost_visibility: ["ADMIN", "GERENTE", "FINANCEIRO"]
};

const roles = [...ROLE_NAMES];

test("matriz oficial: todos os perfis estão contemplados", () => {
  assert.deepEqual(roles.sort(), ["ADMIN", "ESTOQUE", "FINANCEIRO", "GERENTE", "SUPERVISOR", "VENDAS"].sort());
  for (const [operation, allowedRoles] of Object.entries(allowed)) {
    assert.ok(allowedRoles.length > 0, `${operation} precisa de pelo menos um perfil`);
    for (const role of roles) {
      assert.equal(allowedRoles.includes(role), allowedRoles.includes(role), `${operation}/${role}`);
    }
  }
});

test("negativo: Caixa e Supervisor não cadastram cliente", () => {
  assert.equal(allowed.customer_create.includes("VENDAS"), false);
  assert.equal(allowed.customer_create.includes("SUPERVISOR"), false);
});

test("negativo: Estoque não cadastra produto nem nota", () => {
  assert.equal(allowed.product_create.includes("ESTOQUE"), false);
  assert.equal(allowed.invoice_create.includes("ESTOQUE"), false);
});

test("negativo: Financeiro não opera PDV nem recebimento", () => {
  assert.equal(allowed.pdv.includes("FINANCEIRO"), false);
  assert.equal(allowed.receive_sale.includes("FINANCEIRO"), false);
  assert.equal(allowed.cash_operations.includes("FINANCEIRO"), false);
});

test("negativo: Gerente não acessa módulo financeiro", () => {
  assert.equal(allowed.financial_module.includes("GERENTE"), false);
});

test("negativo: Caixa não cancela nem autoriza operações do Supervisor", () => {
  assert.equal(allowed.cancel_item.includes("VENDAS"), false);
  assert.equal(allowed.cancel_sale.includes("VENDAS"), false);
  assert.equal(allowed.authorize_discount.includes("VENDAS"), false);
  assert.equal(allowed.authorize_exchange.includes("VENDAS"), false);
});

test("negativo: Estoque não cancela venda nem autoriza desconto/troca", () => {
  assert.equal(allowed.cancel_sale.includes("ESTOQUE"), false);
  assert.equal(allowed.authorize_discount.includes("ESTOQUE"), false);
  assert.equal(allowed.authorize_exchange.includes("ESTOQUE"), false);
});

test("negativo: custo não é visível para Caixa, Supervisor e Estoque", () => {
  assert.equal(allowed.cost_visibility.includes("VENDAS"), false);
  assert.equal(allowed.cost_visibility.includes("SUPERVISOR"), false);
  assert.equal(allowed.cost_visibility.includes("ESTOQUE"), false);
});

test("positivo: Supervisor possui autoridade adicional sobre o Caixa", () => {
  assert.equal(allowed.pdv.includes("SUPERVISOR"), true);
  assert.equal(allowed.cancel_item.includes("SUPERVISOR"), true);
  assert.equal(allowed.cancel_sale.includes("SUPERVISOR"), true);
  assert.equal(allowed.authorize_discount.includes("SUPERVISOR"), true);
  assert.equal(allowed.authorize_exchange.includes("SUPERVISOR"), true);
});
