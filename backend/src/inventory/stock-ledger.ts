import type { Pool } from "pg";

export type StockLedgerRow = {
  movement_id: number;
  product_id: number;
  type: string;
  quantity: string;
  reference: string | null;
  notes: string | null;
  performed_by: number | null;
  previous_quantity: string | null;
  resulting_quantity: string | null;
  created_at: Date;
};

export type StockReconciliation = {
  productId: number;
  purchased: number;
  sold: number;
  returned: number;
  positiveAdjustments: number;
  negativeAdjustments: number;
  currentStock: number;
  expectedFromMovements: number;
  difference: number;
};

export class StockLedgerRepository {
  constructor(private readonly pool: Pool) {}

  async list(productId: number, from?: string, to?: string): Promise<StockLedgerRow[]> {
    const result = await this.pool.query<StockLedgerRow>(
      `SELECT id AS movement_id, product_id, type, quantity, reference, notes, performed_by,
              previous_quantity, resulting_quantity, created_at
         FROM stock_movements
        WHERE product_id = $1
          AND ($2::date IS NULL OR created_at::date >= $2::date)
          AND ($3::date IS NULL OR created_at::date <= $3::date)
        ORDER BY created_at ASC, id ASC`,
      [productId, from ?? null, to ?? null]
    );
    return result.rows;
  }

  async reconcile(productId: number, from?: string, to?: string): Promise<StockReconciliation> {
    const params: Array<number | string | null> = [productId, from ?? null, to ?? null];
    const result = await this.pool.query<{ type: string; quantity: string }>(
      `SELECT type, SUM(quantity)::numeric AS quantity
         FROM stock_movements
        WHERE product_id = $1
          AND ($2::date IS NULL OR created_at::date >= $2::date)
          AND ($3::date IS NULL OR created_at::date <= $3::date)
        GROUP BY type`, params
    );
    const totals = new Map(result.rows.map(row => [row.type, Number(row.quantity)]));
    const stock = await this.pool.query<{ quantity: string }>("SELECT quantity FROM stock WHERE product_id = $1", [productId]);
    if (!stock.rows[0]) throw new Error("Estoque do produto não encontrado.");

    const purchased = totals.get("PURCHASE") ?? totals.get("ENTRY") ?? 0;
    const sold = totals.get("SALE") ?? totals.get("EXIT") ?? 0;
    const returned = totals.get("RETURN") ?? 0;
    const positiveAdjustments = totals.get("ADJUSTMENT_ENTRY") ?? 0;
    const negativeAdjustments = totals.get("ADJUSTMENT_EXIT") ?? 0;
    const currentStock = Number(stock.rows[0].quantity);
    const expectedFromMovements = purchased + returned + positiveAdjustments - sold - negativeAdjustments;
    return { productId, purchased, sold, returned, positiveAdjustments, negativeAdjustments, currentStock, expectedFromMovements, difference: currentStock - expectedFromMovements };
  }
}
