import test from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { CustomerRepository } from "../cadastro/clientes/repository.js";
import { SupplierRepository } from "../cadastro/fornecedores/repository.js";
import { ProductRepository } from "../cadastro/produtos/repository.js";
import { PurchaseRepository } from "../compras/repository.js";
import { CashRepository } from "../cash/repository.js";
import { SalesRepository } from "../vendas/repository.js";
import { SalesReturnRepository } from "../vendas/returns.js";
import { StoreCreditRepository } from "../customers/store-credit.js";
import { FinanceRepository, type FinancialEntry } from "../financeiro/repository.js";

test("real backend flow: purchase -> stock -> credit sale -> partial receipt -> fiscal pending -> return credit -> cash close", async (t) => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL ?? "postgresql://la_erp:la_erp_dev@localhost:5432/la_erp" });
  t.after(async () => { await pool.end(); });

  await pool.query("TRUNCATE TABLE users, customers, suppliers, products, stock, stock_movements, purchases, purchase_items, sales, sale_items, financial_entries, financial_settlements, cash_sessions, cash_events, sale_payments, sales_returns, customer_credit_ledger, sale_fiscal_documents CASCADE");

  const suppliers = new SupplierRepository(pool); const customers = new CustomerRepository(pool); const products = new ProductRepository(pool); const purchases = new PurchaseRepository(pool); const cash = new CashRepository(pool); const sales = new SalesRepository(pool); const returns = new SalesReturnRepository(pool); const credits = new StoreCreditRepository(pool); const finance = new FinanceRepository(pool);
  const user = await pool.query<{ id: number }>("INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id", ["Integração PDV", `integration-${Date.now()}@test.local`, "test"]);
  const sellerId = user.rows[0].id;
  const supplier = await suppliers.create({ name: "Fornecedor Integração" });
  const customer = await customers.create({ name: "Cliente Integração" });
  const product = await products.create({ code: `INT-${Date.now()}`, name: "Produto Integração", unit: "UN", cost: 10, salePrice: 15, profitMarginPct: 50 });
  const purchase = await purchases.createManual(supplier.id, [{ productId: product.id, quantity: 10, unitCost: 10 }]);
  const confirmedPurchase = await purchases.confirm(purchase.purchase.id, new Map());
  assert.equal(confirmedPurchase.kind, "success");
  const afterPurchase = await pool.query<{ quantity: string }>("SELECT quantity FROM stock WHERE product_id = $1", [product.id]);
  assert.equal(Number(afterPurchase.rows[0].quantity), 10);

  const opened = await cash.open("PDV-INTEGRATION", sellerId, 100);
  assert.notEqual(opened, "already_open");
  const cashSessionId = (opened as { id: number }).id;
  await cash.addEvent(cashSessionId, "SUPPLY", 20, "Suprimento de integração");
  await cash.addEvent(cashSessionId, "WITHDRAWAL", 10, "Sangria de integração");

  const creditSale = await sales.create({ cashSessionId, sellerId, customerId: customer.id, documentType: "FISCAL", items: [{ productId: product.id, quantity: 6, unitPrice: 15 }], payments: [{ paymentMethod: "CREDIT", amount: 90, dueDate: "2099-12-31" }] });
  assert.equal(Number(creditSale.total), 90);
  const afterCreditSale = await pool.query<{ quantity: string }>("SELECT quantity FROM stock WHERE product_id = $1", [product.id]);
  assert.equal(Number(afterCreditSale.rows[0].quantity), 4);

  const pending = await finance.list("RECEIVABLE", "PENDING");
  const saleReceivable = pending.find((entry: FinancialEntry) => entry.sale_id === creditSale.id);
  assert.ok(saleReceivable);

  const partial = await finance.settle(saleReceivable!.id, "RECEIVABLE", 30, "CASH", cashSessionId, null, "Pagamento parcial no PDV");
  assert.notEqual(partial, "not_found");
  assert.notEqual(partial, "exceeds_remaining");
  assert.equal(Number((partial as FinancialEntry).settled_amount), 30);
  assert.equal((partial as FinancialEntry).status, "PARTIAL");

  const fiscalRejected = await sales.registerFiscalResult({ saleId: creditSale.id, status: "REJECTED", errorCode: "NCM_INVALID", errorMessage: "NCM inválido para o produto" });
  assert.equal(fiscalRejected.status, "REJECTED");
  assert.equal(fiscalRejected.error_code, "NCM_INVALID");
  assert.equal(Number(fiscalRejected.attempts), 1);

  const fiscalPending = await sales.fiscalPending();
  assert.equal(fiscalPending.length, 1);
  assert.equal((fiscalPending[0] as { sale_id: number }).sale_id, creditSale.id);

  const authorized = await sales.registerFiscalResult({ saleId: creditSale.id, status: "AUTHORIZED", accessKey: "12345678901234567890123456789012345678901234", protocol: "PROTO-1" });
  assert.equal(authorized.status, "AUTHORIZED");
  assert.equal(Number(authorized.attempts), 2);

  const ret = await returns.create({ saleId: creditSale.id, customerId: customer.id, productId: product.id, quantity: 1, reason: "CUSTOMER_REGRET" });
  assert.equal(ret.creditAmount, 15);
  const afterReturn = await pool.query<{ quantity: string }>("SELECT quantity FROM stock WHERE product_id = $1", [product.id]);
  assert.equal(Number(afterReturn.rows[0].quantity), 5);
  assert.ok(credits);

  const closed = await cash.close(cashSessionId, 115);
  assert.notEqual(closed, "not_found");
  assert.notEqual(closed, "already_closed");
  assert.equal(typeof (closed as { difference: number }).difference, "number");
});
