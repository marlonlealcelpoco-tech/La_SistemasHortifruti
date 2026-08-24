import type { Pool } from "pg";

export const MOVEMENT_TYPES = ["ENTRY", "EXIT", "ADJUSTMENT"] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

export type MovementInput = {
  productId: number;
  type: MovementType;
  quantity: number;
  reference?: string | null;
  notes?: string | null;
};

export type StockMovement = {
  id: number;
  product_id: number;
  type: MovementType;
  quantity: string;
  reference: string | null;
  notes: string | null;
  created_at: Date;
};

export type MovementResult =
  | { kind: "not_found" }
  | { kind: "insufficient" }
  | { kind: "success"; movement: StockMovement; quantity: string };

export class InventoryRepository {
  constructor(private readonly pool: Pool) {}

  async move(input: MovementInput): Promise<MovementResult> {
    const client = await this.pool.connect();
    const delta = input.type === "EXIT" ? -input.quantity : input.quantity;

    try {
      await client.query("BEGIN");
      const stock = await client.query<{ product_id: number }>(
        "SELECT product_id FROM stock WHERE product_id = $1 FOR UPDATE",
        [input.productId]
      );
      if (!stock.rows[0]) {
        await client.query("ROLLBACK");
        return { kind: "not_found" };
      }

      const updated = await client.query<{ quantity: string }>(
        `UPDATE stock
         SET quantity = quantity + $2
         WHERE product_id = $1 AND quantity + $2 >= 0
         RETURNING quantity`,
        [input.productId, delta]
      );
      if (!updated.rows[0]) {
        await client.query("ROLLBACK");
        return { kind: "insufficient" };
      }

      const movement = await client.query<StockMovement>(
        `INSERT INTO stock_movements (product_id, type, quantity, reference, notes)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, product_id, type, quantity, reference, notes, created_at`,
        [input.productId, input.type, delta, input.reference ?? null, input.notes ?? null]
      );
      await client.query("COMMIT");

      return { kind: "success", movement: movement.rows[0], quantity: updated.rows[0].quantity };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async listMovements(productId: number): Promise<StockMovement[]> {
    const result = await this.pool.query<StockMovement>(
      `SELECT id, product_id, type, quantity, reference, notes, created_at
       FROM stock_movements WHERE product_id = $1 ORDER BY created_at DESC, id DESC`,
      [productId]
    );
    return result.rows;
  }
}
