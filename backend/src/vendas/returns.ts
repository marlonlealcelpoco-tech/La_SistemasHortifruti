import type { Pool } from "pg";
import { StoreCreditRepository } from "../customers/store-credit.js";

export type ReturnInput = { saleId: number; customerId: number; productId: number; quantity: number; reason: "CUSTOMER_REGRET" | "WRONG_PRODUCT" | "DEFECT" | "OTHER"; notes?: string | null };

export class SalesReturnRepository {
  private readonly credits: StoreCreditRepository;
  constructor(private readonly pool: Pool) { this.credits = new StoreCreditRepository(pool); }

  async create(input: ReturnInput): Promise<{ returnId: number; creditAmount: number }> {
    if (!input.customerId) throw new Error("Cliente é obrigatório para gerar crédito de troca.");
    if (input.quantity <= 0) throw new Error("Quantidade devolvida inválida.");
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const sale = await client.query<{ id: number; customer_id: number | null }>("SELECT id, customer_id FROM sales WHERE id = $1 AND status = 'CONFIRMED' FOR UPDATE", [input.saleId]);
      if (!sale.rows[0]) throw new Error("Venda não encontrada ou não está confirmada.");
      if (sale.rows[0].customer_id !== input.customerId) throw new Error("Cliente não corresponde à venda original.");
      const sold = await client.query<{ quantity: string; unit_price: string }>(`SELECT quantity, unit_price FROM sale_items WHERE sale_id = $1 AND product_id = $2 FOR UPDATE`, [input.saleId, input.productId]);
      if (!sold.rows[0] || Number(sold.rows[0].quantity) < input.quantity) throw new Error("Quantidade devolvida superior à quantidade vendida.");
      const creditAmount = Number((input.quantity * Number(sold.rows[0].unit_price)).toFixed(2));
      const ret = await client.query<{ id: number }>(`INSERT INTO sales_returns (sale_id, customer_id, product_id, quantity, amount, reason, notes) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`, [input.saleId, input.customerId, input.productId, input.quantity, creditAmount, input.reason, input.notes ?? null]);
      await client.query("UPDATE stock SET quantity = quantity + $2 WHERE product_id = $1", [input.productId, input.quantity]);
      await client.query(`INSERT INTO stock_movements (product_id, type, quantity, reference, notes, performed_by, previous_quantity, resulting_quantity) SELECT $1, 'RETURN', $2, $3, $4, NULL, quantity - $2, quantity FROM stock WHERE product_id = $1`, [input.productId, input.quantity, `DEVOLUCAO-${ret.rows[0].id}`, "Devolução vinculada à venda original"]);
      await this.credits.grantFromReturn(client, input.customerId, ret.rows[0].id, creditAmount);
      await client.query("COMMIT");
      return { returnId: ret.rows[0].id, creditAmount };
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  }
}
