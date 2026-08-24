import type { Pool, PoolClient } from "pg";

export const ADJUSTMENT_REASONS = [
  "LOSS", "EXPIRED", "DAMAGED", "THEFT", "BREAKAGE", "INTERNAL_USE",
  "MISSING", "INVENTORY_DIFFERENCE", "ENTRY_CORRECTION", "FOUND_SURPLUS", "OTHER"
] as const;
export type AdjustmentReason = (typeof ADJUSTMENT_REASONS)[number];

export type InventoryCount = { productId: number; systemQuantity: number; countedQuantity: number; reason?: AdjustmentReason; notes?: string | null };

export class InventoryAdjustmentRepository {
  constructor(private readonly pool: Pool) {}

  async createCountAdjustment(input: InventoryCount, userId: number): Promise<{ movementId: number; previousQuantity: number; newQuantity: number }> {
    if (!Number.isInteger(input.productId) || input.productId <= 0) throw new Error("Produto inválido.");
    if (!Number.isFinite(input.countedQuantity) || input.countedQuantity < 0) throw new Error("Quantidade contada inválida.");
    if (!input.reason) throw new Error("Informe o motivo do ajuste.");

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const stock = await client.query<{ quantity: string }>("SELECT quantity FROM stock WHERE product_id = $1 FOR UPDATE", [input.productId]);
      if (!stock.rows[0]) throw new Error("Estoque do produto não encontrado.");
      const previousQuantity = Number(stock.rows[0].quantity);
      const difference = input.countedQuantity - previousQuantity;
      if (Math.abs(difference) < 0.000001) throw new Error("A contagem não possui diferença para ajustar.");

      const updated = await client.query<{ quantity: string }>(
        "UPDATE stock SET quantity = $2 WHERE product_id = $1 RETURNING quantity",
        [input.productId, input.countedQuantity]
      );
      const movement = await client.query<{ id: number }>(
        `INSERT INTO stock_movements
          (product_id, type, quantity, reference, notes, adjustment_reason, performed_by, previous_quantity, resulting_quantity)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
        [input.productId, difference > 0 ? "ENTRY" : "EXIT", Math.abs(difference), `INVENTORY-${Date.now()}`,
          input.notes ?? "Ajuste originado por conferência de inventário", input.reason, userId, previousQuantity, Number(updated.rows[0].quantity)]
      );
      await client.query("COMMIT");
      return { movementId: movement.rows[0].id, previousQuantity, newQuantity: Number(updated.rows[0].quantity) };
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  }
}
