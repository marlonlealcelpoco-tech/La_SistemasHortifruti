import type { Pool } from "pg";
import { SalesReturnRepository, type ReturnInput } from "./returns.js";

export class SupervisorActionsRepository {
  constructor(private readonly pool: Pool) {}

  async cancelItem(input: { saleId: number; saleItemId: number; supervisorId: number; reason: string }): Promise<{ saleId: number; saleItemId: number; refundedAmount: number }> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const item = await client.query<{ product_id: number; quantity: string; total: string; cancelled_at: Date | null }>(`SELECT product_id, quantity, total, cancelled_at FROM sale_items WHERE id = $1 AND sale_id = $2 FOR UPDATE`, [input.saleItemId, input.saleId]);
      if (!item.rows[0]) throw new Error("Item da venda não encontrado.");
      if (item.rows[0].cancelled_at) throw new Error("Item já cancelado.");
      const sale = await client.query<{ status: string; customer_id: number | null; cash_session_id: number | null }>(`SELECT status, customer_id, cash_session_id FROM sales WHERE id = $1 FOR UPDATE`, [input.saleId]);
      if (!sale.rows[0] || sale.rows[0].status !== "CONFIRMED") throw new Error("Venda não está confirmada.");
      const amount = Number(item.rows[0].total);
      await client.query(`UPDATE sale_items SET cancelled_at = CURRENT_TIMESTAMP, cancelled_by = $3 WHERE id = $1 AND sale_id = $2`, [input.saleItemId, input.saleId, input.supervisorId]);
      await client.query("UPDATE stock SET quantity = quantity + $2 WHERE product_id = $1", [item.rows[0].product_id, item.rows[0].quantity]);
      await client.query(`INSERT INTO stock_movements (product_id, type, quantity, reference, notes) VALUES ($1, 'ENTRY', $2, $3, $4)`, [item.rows[0].product_id, item.rows[0].quantity, `CANCELAMENTO-ITEM-${input.saleItemId}`, `Cancelamento autorizado por supervisor: ${input.reason}`]);
      await client.query("UPDATE sales SET total = total - $2 WHERE id = $1", [input.saleId, amount]);
      const payments = await client.query<{ payment_method: string; amount: string }>("SELECT payment_method, amount FROM sale_payments WHERE sale_id = $1", [input.saleId]);
      const totalPaid = payments.rows.reduce((sum, payment) => sum + Number(payment.amount), 0);
      if (totalPaid > 0 && sale.rows[0].cash_session_id) {
        const refund = Math.min(amount, totalPaid);
        const immediate = payments.rows.find(p => !["CREDIT", "STORE_CREDIT"].includes(p.payment_method));
        if (immediate) await client.query(`INSERT INTO cash_events (cash_session_id, sale_id, type, payment_method, amount, description) VALUES ($1, $2, 'ITEM_CANCELLATION', $3, $4, $5)`, [sale.rows[0].cash_session_id, input.saleId, immediate.payment_method, -refund, `Estorno de item autorizado por supervisor: ${input.reason}`]);
        else if (sale.rows[0].customer_id) await client.query(`INSERT INTO customer_credit_ledger (customer_id, type, amount, sale_id) VALUES ($1, 'RETURN_CREDIT', $2, $3)`, [sale.rows[0].customer_id, refund, input.saleId]);
      }
      await client.query(`INSERT INTO pdv_authorizations (action, sale_id, sale_item_id, authorized_by, amount, reason) VALUES ('CANCEL_ITEM', $1, $2, $3, $4, $5)`, [input.saleId, input.saleItemId, input.supervisorId, amount, input.reason]);
      await client.query("COMMIT");
      return { saleId: input.saleId, saleItemId: input.saleItemId, refundedAmount: amount };
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  }

  async authorizeDiscount(input: { saleId: number; supervisorId: number; amount: number; reason: string }): Promise<{ authorizationId: number; saleId: number; amount: number }> {
    if (input.amount <= 0) throw new Error("Desconto deve ser maior que zero.");
    const sale = await this.pool.query<{ total: string; status: string }>("SELECT total, status FROM sales WHERE id = $1", [input.saleId]);
    if (!sale.rows[0]) throw new Error("Venda não encontrada.");
    if (sale.rows[0].status !== "CONFIRMED") throw new Error("Venda não está confirmada.");
    if (input.amount >= Number(sale.rows[0].total)) throw new Error("Desconto deve ser inferior ao total da venda.");
    const result = await this.pool.query<{ id: number }>(`INSERT INTO pdv_authorizations (action, sale_id, authorized_by, amount, reason) VALUES ('DISCOUNT', $1, $2, $3, $4) RETURNING id`, [input.saleId, input.supervisorId, input.amount, input.reason]);
    return { authorizationId: result.rows[0].id, saleId: input.saleId, amount: input.amount };
  }

  async authorizeExchange(input: ReturnInput & { supervisorId: number; authorizationReason: string }): Promise<{ returnId: number; creditAmount: number; authorizationId: number }> {
    const result = await new SalesReturnRepository(this.pool).create(input);
    const authorization = await this.pool.query<{ id: number }>(`INSERT INTO pdv_authorizations (action, sale_id, authorized_by, amount, reason) VALUES ('EXCHANGE', $1, $2, $3, $4) RETURNING id`, [input.saleId, input.supervisorId, result.creditAmount, input.authorizationReason]);
    return { ...result, authorizationId: authorization.rows[0].id };
  }
}
