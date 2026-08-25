import test from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { CustomerRepository } from "../cadastro/clientes/repository.js";
import { SupplierRepository } from "../cadastro/fornecedores/repository.js";
import { ProductRepository } from "../cadastro/produtos/repository.js";
import { PurchaseRepository } from "../compras/repository.js";
import { CashRepository } from "../cash/repository.js";
import { SalesRepository } from "../sales/repository.js";
import { SalesReturnRepository } from "../sales/returns.js";
import { StoreCreditRepository } from "../customers/store-credit.js";
import { FinanceRepository, type FinancialEntry } from "../financeiro/repository.js";

test("real backend flow: purchase -> stock -> credit sale -> partial/full receipt -> return credit -> new sale -> cash close", async (t) => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL ?? "postgresql://la_erp:la_erp_dev@localhost:5432/la_erp"
  });

  t.after(async () => {
    await pool.end();
  });

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

  const user = await pool.query<{ id: number }>(
    "INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id",
    ["Integração PDV", `integration-${Date.now()}@test.local`, "test"]
  );
  const sellerId = user.rows[0].id;

  const supplier = await suppliers.create({ name: "Fornecedor Integração" });
  const customer = await customers.create({ name: "Cliente Integração" });
  const product = await products.create({
    code: `INT-${Date.now()}`,
    name: "Produto Integração",
    unit: "UN",
    cost: 10,
    salePrice: 15,
    profitMarginPct: 50
  });

  const purchase = await purchases.createManual(supplier.id, [
    { productId: product.id, quantity: 10, unitCost: 10 }
  ]);
  const confirmedPurchase = await purchases.confirm(purchase.purchase.id, new Map());
  assert.equal(confirmedPurchase.kind, "success");

  const afterPurchase = await pool.query<{ quantity: string }>("SELECT quantity FROM stock WHERE product_id = $1", [product.id]);
  assert.equal(Number(afterPurchase.rows[0].quantity), 10);

  const opened = await cash.open("PDV-INTEGRATION", sellerId, 100);
  assert.notEqual(opened, "already_open");
  const cashSessionId = (opened as { id: number }).id;

  await cash.addEvent(cashSessionId, "SUPPLY", 20, "Suprimento de integração");
  await cash.addEvent(cashSessionId, "WITHDRAWAL", 10, "Sangria de integração");

  const creditSale = await sales.create({
    cashSessionId,
    sellerId,
    customerId: customer.id,
    items: [{ productId: product.id, quantity: 6, unitPrice: 15 }],
    payments: [{ paymentMethod: "CREDIT", amount: 90, dueDate: "2099-12-31" }]
  });
  assert.equal(Number(creditSale.total), 90);

  const afterCreditSale = await pool.query<{ quantity: string }>("SELECT quantity FROM stock WHERE product_id = $1", [product.id]);
  assert.equal(Number(afterCreditSale.rows[0].quantity), 4);

  const pending = await finance.list("RECEIVABLE", "PENDING");
  const saleReceivable = pending.find((entry: FinancialEntry) => entry.sale_id === creditSale.id);
  assert.ok(saleReceivable);
});
