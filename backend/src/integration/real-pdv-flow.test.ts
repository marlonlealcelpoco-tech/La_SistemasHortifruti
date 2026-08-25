import test from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { CustomerRepository } from "../cadastro/clientes/repository.js";
import { SupplierRepository } from "../cadastro/fornecedores/repository.js";
import { ProductRepository } from "../products/repository.js";
import { PurchaseRepository } from "../purchases/repository.js";
import { CashRepository } from "../cash/repository.js";
import { SalesRepository } from "../sales/repository.js";
import { SalesReturnRepository } from "../sales/returns.js";
import { StoreCreditRepository } from "../customers/store-credit.js";
import { FinanceRepository } from "../finance/repository.js";

test("real backend flow: purchase -> stock -> credit sale -> partial/full receipt -> return credit -> new sale -> cash close", async (t) => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL ?? "postgresql://la_erp:la_erp_dev@localhost:5432/la_erp" });
  t.after(async () => { await pool.end(); });
  await pool.query("TRUNCATE TABLE users, customers, suppliers, products, stock, stock_movements, purchases, purchase_items, sales, sale_items, financial_entries, financial_settlements, cash_sessions, cash_events, sale_payments, sales_returns, customer_credit_ledger CASCADE");

  const suppliers = new SupplierRepository(pool);
  const customers = new CustomerRepository(pool);
  const products = new ProductRepository(pool);
  const purchases = new PurchaseRepository(pool);
  const cash = new CashRepository(pool);
  const sales = new SalesRepository(pool);
  const returns = new SalesReturnRepository(pool);
  const credits = new StoreCreditRepository(pool);
  const finance = new FinanceRepository(pool);

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

  const creditSale = await sales.create({ cashSessionId, sellerId, customerId: customer.id, items: [{ productId: product.id, quantity: 6, unitPrice: 15 }], payments: [{ paymentMethod: "CREDIT", amount: 90, dueDate: "2099-12-31" }] });
  assert.equal(Number(creditSale.total), 90);
  const afterCreditSale = await pool.query<{ quantity: string }>("SELECT quantity FROM stock WHERE product_id = $1", [product.id]);
  assert.equal(Number(afterCreditSale.rows[0].quantity), 4);

  const pending = await finance.list("RECEIVABLE", "PENDING");
  const saleReceivable = pending.find((entry) => entry.sale_id === creditSale.id);
  assert.ok(saleReceivable);
  assert.equal(Number(saleReceivable.amount), 90);
  assert.equal(Number(saleReceivable.settled_amount), 0);
  const partial = await finance.settle(saleReceivable.id, "RECEIVABLE", 40, "CASH", cashSessionId);
  assert.equal((partial as { status: string }).status, "PARTIAL");
  assert.equal(Number((partial as { settled_amount: string }).settled_amount), 40);
  const afterPartial = (await finance.list("RECEIVABLE", "PARTIAL")).find((entry) => entry.id === saleReceivable.id);
  assert.ok(afterPartial);
  assert.equal(Number(afterPartial.settled_amount), 40);
  const receiptEventsAfterPartial = await pool.query<{ count: string }>("SELECT COUNT(*) AS count FROM cash_events WHERE cash_session_id = $1 AND type = 'CUSTOMER_RECEIPT' AND amount = 40", [cashSessionId]);
  assert.equal(Number(receiptEventsAfterPartial.rows[0].count), 1);

  const final = await finance.settle(saleReceivable.id, "RECEIVABLE", 50, "CASH", cashSessionId);
  assert.equal((final as { status: string }).status, "RECEIVED");
  assert.equal(Number((final as { settled_amount: string }).settled_amount), 90);
  const received = (await finance.list("RECEIVABLE", "RECEIVED")).find((entry) => entry.id === saleReceivable.id);
  assert.ok(received);
  assert.equal(Number(received.settled_amount), 90);
  const receiptEvents = await pool.query<{ total: string }>("SELECT COALESCE(SUM(amount), 0) AS total FROM cash_events WHERE cash_session_id = $1 AND type = 'CUSTOMER_RECEIPT'", [cashSessionId]);
  assert.equal(Number(receiptEvents.rows[0].total), 90);
  assert.equal(await finance.settle(saleReceivable.id, "RECEIVABLE", 1, "CASH", cashSessionId), "already_settled");

  const returned = await returns.create({ saleId: creditSale.id, customerId: customer.id, productId: product.id, quantity: 1, reason: "CUSTOMER_REGRET", notes: "Troca de integração" });
  assert.equal(returned.creditAmount, 15);
  assert.equal(await credits.balance(customer.id), 15);
  const afterReturn = await pool.query<{ quantity: string }>("SELECT quantity FROM stock WHERE product_id = $1", [product.id]);
  assert.equal(Number(afterReturn.rows[0].quantity), 5);

  const replacementSale = await sales.create({ cashSessionId, sellerId, customerId: customer.id, items: [{ productId: product.id, quantity: 1, unitPrice: 20 }], payments: [{ paymentMethod: "STORE_CREDIT", amount: 15 }, { paymentMethod: "CASH", amount: 5 }] });
  assert.equal(Number(replacementSale.total), 20);
  assert.equal(await credits.balance(customer.id), 0);
  const afterReplacement = await pool.query<{ quantity: string }>("SELECT quantity FROM stock WHERE product_id = $1", [product.id]);
  assert.equal(Number(afterReplacement.rows[0].quantity), 4);

  const reportBeforeClose = await cash.report(cashSessionId);
  assert.ok(reportBeforeClose);
  assert.equal(reportBeforeClose.totals.opening, 100);
  assert.equal(reportBeforeClose.totals.customerReceipts, 90);
  assert.equal(reportBeforeClose.totals.supplies, 20);
  assert.equal(reportBeforeClose.totals.withdrawals, 10);
  assert.equal(reportBeforeClose.salesByPaymentMethod.CASH, 5);
  assert.equal(reportBeforeClose.totals.expectedCash, 205);
  const closed = await cash.close(cashSessionId, 205);
  assert.equal((closed as { difference: number }).difference, 0);
  const closedSession = await cash.find(cashSessionId);
  assert.equal(closedSession?.status, "CLOSED");
});
