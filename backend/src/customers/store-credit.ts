import type { Pool, PoolClient } from "pg";

export type CreditLedgerEntry = { id: number; customer_id: number; type: "RETURN_CREDIT" | "CREDIT_USE" | "CREDIT_REVERSAL"; amount: string; source_return_id: number | null; sale_id: number | null; created_at: Date };

export class StoreCreditRepository {
  constructor(private readonly pool: Pool) {}

  async balance(customerId: number): Promise<number> {
    const result = await this.pool.query<{ balance: string }>(
      `SELECT COALESCE(SUM(CASE WHEN type IN ('RETURN_CREDIT','CREDIT_REVERSAL') THEN amount ELSE -amount END), 0)::numeric AS balance
         FROM customer_credit_ledger WHERE customer_id = $1`, [customerId]
    );
    return Number(result.rows[0].balance);
  }

  async grantFromReturn(client: PoolClient, customerId: number, returnId: number, amount: number): Promise<void> {
    if (amount <= 0) throw new Error("Valor de crédito inválido.");
    await client.query(
      `INSERT INTO customer_credit_ledger (customer_id, type, amount, source_return_id)
       VALUES ($1, 'RETURN_CREDIT', $2, $3)`, [customerId, amount, returnId]
    );
  }

  async consume(client: PoolClient, customerId: number, saleId: number, amount: number): Promise<void> {
    if (amount <= 0) throw new Error("Valor de utilização de crédito inválido.");

    // Lock the customer row to serialize concurrent credit consumption, then
    // calculate the aggregate balance separately. PostgreSQL does not allow
    // FOR UPDATE directly on an aggregate query.
    await client.query(`SELECT id FROM customers WHERE id = $1 FOR UPDATE`, [customerId]);
    const balance = await client.query<{ balance: string }>(
      `SELECT COALESCE(SUM(CASE WHEN type IN ('RETURN_CREDIT','CREDIT_REVERSAL') THEN amount ELSE -amount END), 0)::numeric AS balance
         FROM customer_credit_ledger WHERE customer_id = $1`, [customerId]
    );
    if (Number(balance.rows[0].balance) + 0.005 < amount) throw new Error("Crédito disponível insuficiente.");
    await client.query(
      `INSERT INTO customer_credit_ledger (customer_id, type, amount, sale_id)
       VALUES ($1, 'CREDIT_USE', $2, $3)`, [customerId, amount, saleId]
    );
  }
}
