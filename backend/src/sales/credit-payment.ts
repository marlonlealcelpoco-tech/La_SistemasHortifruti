import type { Pool } from "pg";
import { StoreCreditRepository } from "../customers/store-credit.js";

export class CreditPaymentService {
  constructor(private readonly pool: Pool) {}

  async apply(customerId: number, saleId: number, requestedAmount: number): Promise<{ creditUsed: number; remainingToPay: number }> {
    if (requestedAmount <= 0) throw new Error("Valor da venda inválido.");
    const credits = new StoreCreditRepository(this.pool);
    const balance = await credits.balance(customerId);
    const creditUsed = Math.min(balance, requestedAmount);
    const remainingToPay = Number((requestedAmount - creditUsed).toFixed(2));
    if (creditUsed > 0) {
      const client = await this.pool.connect();
      try {
        await client.query("BEGIN");
        await credits.consume(client, customerId, saleId, creditUsed);
        await client.query("COMMIT");
      } catch (error) { await client.query("ROLLBACK"); throw error; }
      finally { client.release(); }
    }
    return { creditUsed, remainingToPay };
  }
}
