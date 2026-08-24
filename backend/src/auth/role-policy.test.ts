import test from "node:test";
import assert from "node:assert/strict";
import { ROLE_POLICY, hasAnyRole } from "./role-policy.js";
import type { UserRole } from "./user-repository.js";

const allowed = (role: UserRole, policy: readonly UserRole[]) => hasAnyRole([role], policy);

test("negative authorization: caixa and supervisor cannot maintain customers", () => {
  assert.equal(allowed("VENDAS", ROLE_POLICY.CUSTOMER_MAINTENANCE), false);
  assert.equal(allowed("SUPERVISOR", ROLE_POLICY.CUSTOMER_MAINTENANCE), false);
  assert.equal(allowed("GERENTE", ROLE_POLICY.CUSTOMER_MAINTENANCE), true);
  assert.equal(allowed("FINANCEIRO", ROLE_POLICY.CUSTOMER_MAINTENANCE), true);
  assert.equal(allowed("ADMIN", ROLE_POLICY.CUSTOMER_MAINTENANCE), true);
});

test("negative authorization: estoque cannot create or maintain products", () => {
  assert.equal(allowed("ESTOQUE", ROLE_POLICY.PRODUCT_MAINTENANCE), false);
  assert.equal(allowed("GERENTE", ROLE_POLICY.PRODUCT_MAINTENANCE), true);
  assert.equal(allowed("FINANCEIRO", ROLE_POLICY.PRODUCT_MAINTENANCE), true);
  assert.equal(allowed("ADMIN", ROLE_POLICY.PRODUCT_MAINTENANCE), true);
});

test("negative authorization: estoque cannot register purchase or invoice", () => {
  assert.equal(allowed("ESTOQUE", ROLE_POLICY.PURCHASE_MAINTENANCE), false);
  assert.equal(allowed("GERENTE", ROLE_POLICY.PURCHASE_MAINTENANCE), true);
  assert.equal(allowed("FINANCEIRO", ROLE_POLICY.PURCHASE_MAINTENANCE), true);
  assert.equal(allowed("ADMIN", ROLE_POLICY.PURCHASE_MAINTENANCE), true);
});

test("negative authorization: finance cannot operate PDV or close cash", () => {
  assert.equal(allowed("FINANCEIRO", ROLE_POLICY.PDV), false);
  assert.equal(allowed("FINANCEIRO", ROLE_POLICY.CASH_OPERATORS), false);
  assert.equal(allowed("VENDAS", ROLE_POLICY.CASH_OPERATORS), true);
  assert.equal(allowed("SUPERVISOR", ROLE_POLICY.CASH_OPERATORS), true);
});

test("negative authorization: manager has no financial module access", () => {
  assert.equal(allowed("GERENTE", ROLE_POLICY.FINANCE), false);
  assert.equal(allowed("GERENTE", ROLE_POLICY.CASH_REPORTS), false);
  assert.equal(allowed("FINANCEIRO", ROLE_POLICY.FINANCE), true);
  assert.equal(allowed("ADMIN", ROLE_POLICY.FINANCE), true);
});

test("negative authorization: only authorized profiles see product cost", () => {
  assert.equal(allowed("VENDAS", ROLE_POLICY.COST_VIEW), false);
  assert.equal(allowed("SUPERVISOR", ROLE_POLICY.COST_VIEW), false);
  assert.equal(allowed("ESTOQUE", ROLE_POLICY.COST_VIEW), false);
  assert.equal(allowed("GERENTE", ROLE_POLICY.COST_VIEW), true);
  assert.equal(allowed("FINANCEIRO", ROLE_POLICY.COST_VIEW), true);
  assert.equal(allowed("ADMIN", ROLE_POLICY.COST_VIEW), true);
});
