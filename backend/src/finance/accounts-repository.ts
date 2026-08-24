import type { Pool } from "pg";

export type FinancialAccountType = "BANK" | "CASH" | "DIGITAL" | "OTHER";

export type FinancialAccount = {
  id: number;
  code: string;
  name: string;
  type: FinancialAccountType;
  bank_name: string | null;
  bank_code: string | null;
  agency: string | null;
  account_number: string | null;
  active: boolean;
  opening_balance: string;
};

export type AccountBalance = FinancialAccount & { current_balance: string };

export class FinancialAccountsRepository {
  constructor(private readonly pool: Pool) {}

  async list(activeOnly = false): Promise<AccountBalance[]> {
    const result = await this.pool.query<AccountBalance>(
      `SELECT a.id, a.code, a.name, a.type, a.bank_name, a.bank_code, a.agency, a.account_number,
        a.active, a.opening_balance,
        (a.opening_balance + COALESCE(SUM(CASE WHEN m.direction = 'IN' THEN m.amount ELSE -m.amount END), 0))::numeric(14,2) AS current_balance
       FROM financial_accounts a
       LEFT JOIN financial_account_movements m ON m.financial_account_id = a.id
       WHERE ($1::boolean = FALSE OR a.active = TRUE)
       GROUP BY a.id ORDER BY a.name`,
      [activeOnly]
    );
    return result.rows;
  }

  async create(input: Omit<FinancialAccount, "id" | "active" | "opening_balance"> & { openingBalance?: number }): Promise<FinancialAccount> {
    const result = await this.pool.query<FinancialAccount>(
      `INSERT INTO financial_accounts (code, name, type, bank_name, bank_code, agency, account_number, opening_balance)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id, code, name, type, bank_name, bank_code, agency, account_number, active, opening_balance`,
      [input.code, input.name, input.type, input.bank_name, input.bank_code, input.agency, input.account_number, input.openingBalance ?? 0]
    );
    return result.rows[0];
  }

  async recordMovement(input: {
    accountId: number;
    direction: "IN" | "OUT";
    amount: number;
    description: string;
    financialEntryId?: number | null;
    settlementId?: number | null;
    sourceType?: string | null;
    sourceId?: number | null;
  }): Promise<void> {
    if (input.amount <= 0) throw new Error("O valor do movimento deve ser maior que zero.");
    await this.pool.query(
      `INSERT INTO financial_account_movements
        (financial_account_id, direction, amount, description, financial_entry_id, settlement_id, source_type, source_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [input.accountId, input.direction, input.amount, input.description, input.financialEntryId ?? null,
       input.settlementId ?? null, input.sourceType ?? null, input.sourceId ?? null]
    );
  }

  async consolidatedBalance(): Promise<number> {
    const result = await this.pool.query<{ total: string }>(
      `SELECT COALESCE(SUM(a.opening_balance),0) + COALESCE(SUM(CASE WHEN m.direction = 'IN' THEN m.amount ELSE -m.amount END),0) AS total
       FROM financial_accounts a LEFT JOIN financial_account_movements m ON m.financial_account_id = a.id
       WHERE a.active = TRUE`
    );
    return Number(result.rows[0].total ?? 0);
  }
}
