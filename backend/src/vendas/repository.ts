import type { Pool, PoolClient } from "pg";
import { StoreCreditRepository } from "../customers/store-credit.js";
import { validateSaleCustomer } from "../operations/operational-rules.js";

export const PAYMENT_METHODS = ["CASH", "PIX", "DEBIT_CARD", "CREDIT_CARD", "TRANSFER", "CREDIT", "STORE_CREDIT"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const SALE_DOCUMENT_TYPES = ["FISCAL", "GERENCIAL"] as const;
export type SaleDocumentType = (typeof SALE_DOCUMENT_TYPES)[number];

export type SaleInput = {
  cashSessionId: number;
  sellerId: number;
  customerId?: number | null;
  documentType?: SaleDocumentType;
  items: Array<{ productId: number; quantity: number; unitPrice: number }>;
  payments: Array<{ paymentMethod: PaymentMethod; amount: number; dueDate?: string | null }>;
};

export type SaleRecord = { id: number; customer_id: number | null; seller_id: number | null; cash_session_id: number | null; status: string; total: string; created_at: Date };

export class SalesRepository {
  constructor(private readonly pool: Pool) {}

  async create(input: SaleInput): Promise<SaleRecord> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const session = await client.query<{ seller_id: number | string }>("SELECT seller_id FROM cash_sessions WHERE id = $1 AND status = 'OPEN' FOR UPDATE", [input.cashSessionId]);
      if (!session.rows[0]) throw new Error("Caixa não está aberto.");
      if (Number(session.rows[0].seller_id) !== Number(input.sellerId)) throw new Error("A venda deve ser registrada no caixa do vendedor.");
      if (!input.items.length) throw new Error("A venda precisa ter pelo menos um item.");

      const total = Number(input.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0).toFixed(2));
      const paymentTotal = Number(input.payments.reduce((sum, payment) => sum + payment.amount, 0).toFixed(2));
      if (!input.payments.length || Math.abs(paymentTotal - total) > 0.005) throw new Error("A soma dos pagamentos deve ser igual ao total da venda.");
      validateSaleCustomer({
        customerId: input.customerId,
        hasCreditSale: input.payments.some(p => p.paymentMethod === "CREDIT"),
        hasStoreCreditUse: input.payments.some(p => p.paymentMethod === "STORE_CREDIT")
      });

      const sale = await client.query<SaleRecord>(`INSERT INTO sales (customer_id, seller_id, cash_session_id, status, total) VALUES ($1, $2, $3, 'CONFIRMED', $4) RETURNING id, customer_id, seller_id, cash_session_id, status, total, created_at`, [input.customerId ?? null, input.sellerId, input.cashSessionId, total]);
      const credits = new StoreCreditRepository(this.pool);

      for (const item of input.items) {
        if (item.quantity <= 0 || item.unitPrice < 0) throw new Error("Quantidade/preço inválido.");
        await this.decreaseStock(client, item.productId, item.quantity);
        await client.query(`INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, total) VALUES ($1, $2, $3, $4, $5)`, [sale.rows[0].id, item.productId, item.quantity, item.unitPrice, item.quantity * item.unitPrice]);
        await client.query(`INSERT INTO stock_movements (product_id, type, quantity, reference, notes) VALUES ($1, 'EXIT', $2, $3, 'Saída por venda')`, [item.productId, item.quantity, `VENDA-${sale.rows[0].id}`]);
      }

      for (const payment of input.payments) {
        if (payment.amount <= 0) throw new Error("Valor de pagamento inválido.");
        if (payment.paymentMethod === "STORE_CREDIT") await credits.consume(client, input.customerId as number, sale.rows[0].id, payment.amount);
        await client.query(`INSERT INTO sale_payments (sale_id, payment_method, amount, due_date) VALUES ($1, $2, $3, $4)`, [sale.rows[0].id, payment.paymentMethod, payment.amount, payment.dueDate ?? null]);
        if (payment.paymentMethod === "CREDIT") {
          if (!input.customerId || !payment.dueDate) throw new Error("Venda a prazo exige cliente e vencimento.");
          const ar = await client.query<{ id: number }>(`INSERT INTO financial_entries (type, description, amount, due_date, customer_id, source, document_number, sale_id) VALUES ('RECEIVABLE', $1, $2, $3, $4, 'SALE', $5, $6) RETURNING id`, [`Venda ${sale.rows[0].id} - Conta a Receber`, payment.amount, payment.dueDate, input.customerId, `VENDA-${sale.rows[0].id}`, sale.rows[0].id]);
          await client.query(`INSERT INTO financial_installments (financial_entry_id, installment_number, due_date, amount, settled_amount, status) VALUES ($1, 1, $2, $3, 0, 'PENDING')`, [ar.rows[0].id, payment.dueDate, payment.amount]);
        } else if (payment.paymentMethod !== "STORE_CREDIT") {
          await client.query(`INSERT INTO cash_events (cash_session_id, sale_id, type, payment_method, amount, description) VALUES ($1, $2, 'SALE_PAYMENT', $3, $4, 'Recebimento de venda')`, [input.cashSessionId, sale.rows[0].id, payment.paymentMethod, payment.amount]);
        }
      }

      await client.query(`INSERT INTO sale_fiscal_documents (sale_id, document_type, status) VALUES ($1, $2, $3)`, [sale.rows[0].id, input.documentType ?? "GERENCIAL", (input.documentType ?? "GERENCIAL") === "FISCAL" ? "PENDING" : "NOT_APPLICABLE"]);
      await client.query("COMMIT");
      return sale.rows[0];
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  }

  async registerFiscalResult(input: { saleId: number; status: "AUTHORIZED" | "REJECTED"; errorCode?: string | null; errorMessage?: string | null; accessKey?: string | null; protocol?: string | null; xmlRaw?: string | null }): Promise<Record<string, unknown>> {
    const result = await this.pool.query(`UPDATE sale_fiscal_documents SET status = $2, attempts = attempts + 1, last_attempt_at = CURRENT_TIMESTAMP, error_code = $3, error_message = $4, access_key = $5, protocol = $6, xml_raw = $7, authorized_at = CASE WHEN $2 = 'AUTHORIZED' THEN CURRENT_TIMESTAMP ELSE authorized_at END, updated_at = CURRENT_TIMESTAMP WHERE sale_id = $1 RETURNING *`, [input.saleId, input.status, input.errorCode ?? null, input.errorMessage ?? null, input.accessKey ?? null, input.protocol ?? null, input.xmlRaw ?? null]);
    if (!result.rows[0]) throw new Error("Documento fiscal da venda não encontrado.");
    return result.rows[0];
  }

  async fiscalPending(): Promise<unknown[]> {
    const result = await this.pool.query(`SELECT d.*, s.customer_id, s.total, s.cash_session_id, s.seller_id FROM sale_fiscal_documents d INNER JOIN sales s ON s.id = d.sale_id WHERE d.document_type = 'FISCAL' AND d.status IN ('PENDING','REJECTED') ORDER BY d.created_at ASC`);
    return result.rows;
  }

  async cancel(saleId: number, sellerId: number): Promise<"not_found" | "not_allowed" | "already_cancelled" | SaleRecord> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const sale = await client.query<SaleRecord>(`SELECT id, customer_id, seller_id, cash_session_id, status, total, created_at FROM sales WHERE id = $1 FOR UPDATE`, [saleId]);
      const record = sale.rows[0];
      if (!record) { await client.query("ROLLBACK"); return "not_found"; }
      if (record.seller_id != null && Number(record.seller_id) !== Number(sellerId)) { await client.query("ROLLBACK"); return "not_allowed"; }
      if (record.status === "CANCELLED") { await client.query("ROLLBACK"); return "already_cancelled"; }
      const items = await client.query<{ product_id: number; quantity: string }>("SELECT product_id, quantity FROM sale_items WHERE sale_id = $1", [saleId]);
      for (const item of items.rows) { await client.query("UPDATE stock SET quantity = quantity + $2 WHERE product_id = $1", [item.product_id, item.quantity]); await client.query(`INSERT INTO stock_movements (product_id, type, quantity, reference, notes) VALUES ($1, 'ENTRY', $2, $3, 'Estorno por cancelamento de venda')`, [item.product_id, item.quantity, `CANCELAMENTO-${saleId}`]); }
      const payments = await client.query<{ payment_method: string; amount: string }>("SELECT payment_method, amount FROM sale_payments WHERE sale_id = $1", [saleId]);
      for (const payment of payments.rows) { if (payment.payment_method !== "STORE_CREDIT") await client.query(`INSERT INTO cash_events (cash_session_id, sale_id, type, payment_method, amount, description) VALUES ($1, $2, 'CANCELLATION', $3, $4, 'Cancelamento de venda')`, [record.cash_session_id, saleId, payment.payment_method, -Number(payment.amount)]); }
      await client.query(`UPDATE financial_entries SET status = 'CANCELLED' WHERE sale_id = $1 AND type = 'RECEIVABLE' AND status <> 'CANCELLED'`, [saleId]);
      const creditPayment = payments.rows.filter(p => p.payment_method === "STORE_CREDIT").reduce((sum, p) => sum + Number(p.amount), 0);
      if (creditPayment > 0 && record.customer_id) await client.query(`INSERT INTO customer_credit_ledger (customer_id, type, amount, sale_id) VALUES ($1, 'CREDIT_REVERSAL', $2, $3)`, [record.customer_id, creditPayment, saleId]);
      const cancelled = await client.query<SaleRecord>(`UPDATE sales SET status = 'CANCELLED', cancelled_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id, customer_id, seller_id, cash_session_id, status, total, created_at`, [saleId]);
      await client.query("COMMIT");
      return cancelled.rows[0];
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  }

  private async decreaseStock(client: PoolClient, productId: number, quantity: number): Promise<void> {
    const product = await client.query<{ id: number }>("SELECT id FROM products WHERE id = $1 AND active = TRUE FOR UPDATE", [productId]);
    if (!product.rows[0]) throw new Error("Produto inexistente ou inativo.");
    const stock = await client.query<{ quantity: string }>(`UPDATE stock SET quantity = quantity - $2 WHERE product_id = $1 AND quantity >= $2 RETURNING quantity`, [productId, quantity]);
    if (!stock.rows[0]) throw new Error("Estoque insuficiente para concluir a venda.");
  }
}
