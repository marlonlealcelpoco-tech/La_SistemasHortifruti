import type { Pool } from "pg";

export type FinancialMovement = {
  id: number;
  date: Date;
  accountId: number | null;
  cashSessionId: number | null;
  amount: number;
  direction: "IN" | "OUT";
  movementType: string;
  description: string;
  financialEntryId: number | null;
  source: "BANK" | "CASH";
};

/**
 * Reads the operational movement tables already used by financial settlement.
 * It deliberately does not create a second ledger, avoiding duplicated balances.
 */
export class FinancialMovementRepository {
  constructor(private readonly pool: Pool) {}

  async list(from: string, to: string): Promise<FinancialMovement[]> {
    const result = await this.pool.query<FinancialMovement>(
      `
      SELECT
        id,
        created_at AS date,
        financial_account_id AS "accountId",
        NULL::bigint AS "cashSessionId",
        amount::numeric AS amount,
        CASE WHEN amount >= 0 THEN 'IN' ELSE 'OUT' END AS direction,
        transaction_type AS "movementType",
        description,
        financial_entry_id AS "financialEntryId",
        'BANK' AS source
      FROM financial_account_transactions
      WHERE created_at >= $1::date
        AND created_at < ($2::date + INTERVAL '1 day')

      UNION ALL

      SELECT
        id,
        created_at AS date,
        NULL::bigint AS "accountId",
        cash_session_id AS "cashSessionId",
        amount::numeric AS amount,
        CASE WHEN amount >= 0 THEN 'IN' ELSE 'OUT' END AS direction,
        type AS "movementType",
        description,
        NULL::bigint AS "financialEntryId",
        'CASH' AS source
      FROM cash_events
      WHERE created_at >= $1::date
        AND created_at < ($2::date + INTERVAL '1 day')

      ORDER BY date ASC, id ASC
      `,
      [from, to]
    );

    return result.rows.map((row) => ({
      ...row,
      amount: Number(row.amount)
    }));
  }

  async totals(from: string, to: string): Promise<{ income: number; expense: number; net: number }> {
    const movements = await this.list(from, to);
    const income = movements.filter((m) => m.amount > 0).reduce((sum, m) => sum + m.amount, 0);
    const expense = movements.filter((m) => m.amount < 0).reduce((sum, m) => sum + Math.abs(m.amount), 0);
    return { income, expense, net: income - expense };
  }
}
