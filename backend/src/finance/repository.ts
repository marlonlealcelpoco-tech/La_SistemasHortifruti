import type { Pool } from "pg";

export const FINANCIAL_TYPES = ["PAYABLE", "RECEIVABLE"] as const;
export type FinancialType = (typeof FINANCIAL_TYPES)[number];

export type FinancialEntry = {
  id: number;
  type: FinancialType;
  description: string;
  amount: string;
  settled_amount: string;
  due_date: string | null;
  paid_at: Date | null;
  status: string;
  customer_id: number | null;
  supplier_id: number | null;
  source: string;
  document_number: string | null;
  sale_id: number | null;
  purchase_id: number | null;
  created_at: Date;
};

export type FinancialEntryInput = {
  type: FinancialType;
  description: string;
  amount: number;
  dueDate?: string | null;
  customerId?: number | null;
  supplierId?: number | null;
  source?: "MANUAL" | "XML" | "SALE" | "PURCHASE" | "IMPORT";
  documentNumber?: string | null;
  xmlRaw?: string | null;
  saleId?: number | null;
  purchaseId?: number | null;
};

export class FinanceRepository {
  constructor(private readonly pool: Pool) {}

  async create(input: FinancialEntryInput): Promise<FinancialEntry> {
    const result = await this.pool.query<FinancialEntry>(
      `INSERT INTO financial_entries (
        type, description, amount, due_date, customer_id, supplier_id, source,
        document_number, xml_raw, sale_id, purchase_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id, type, description, amount, settled_amount, due_date, paid_at, status,
        customer_id, supplier_id, source, document_number, sale_id, purchase_id, created_at`,
      [
        input.type, input.description, input.amount, input.dueDate ?? null,
        input.customerId ?? null, input.supplierId ?? null, input.source ?? "MANUAL",
        input.documentNumber ?? null, input.xmlRaw ?? null, input.saleId ?? null, input.purchaseId ?? null
      ]
    );
    return result.rows[0];
  }

  async list(type: FinancialType, status?: string): Promise<FinancialEntry[]> {
    const result = await this.pool.query<FinancialEntry>(
      `SELECT id, type, description, amount, settled_amount, due_date, paid_at, status,
        customer_id, supplier_id, source, document_number, sale_id, purchase_id, created_at
       FROM financial_entries
       WHERE type = $1 AND ($2::text IS NULL OR status = $2)
       ORDER BY due_date NULLS LAST, created_at DESC`,
      [type, status ?? null]
    );
    return result.rows;
  }

  async settle(
    entryId: number,
    type: FinancialType,
    amount: number,
    paymentMethod: string,
    cashSessionId?: number | null,
    financialAccountId?: number | null,
    notes?: string | null
  ): Promise<"not_found" | "already_settled" | "exceeds_remaining" | FinancialEntry> {
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("O valor da baixa deve ser maior que zero.");

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      const entry = await client.query<FinancialEntry>(
        `SELECT id, type, description, amount, settled_amount, due_date, paid_at, status,
          customer_id, supplier_id, source, document_number, sale_id, purchase_id, created_at
         FROM financial_entries WHERE id = $1 AND type = $2 FOR UPDATE`,
        [entryId, type]
      );
      const record = entry.rows[0];
      if (!record) { await client.query("ROLLBACK"); return "not_found"; }

      const remaining = Number(record.amount) - Number(record.settled_amount);
      if (remaining <= 0) { await client.query("ROLLBACK"); return "already_settled"; }
      if (amount - remaining > 0.005) { await client.query("ROLLBACK"); return "exceeds_remaining"; }

      if (cashSessionId) {
        const session = await client.query<{ id: number }>(
          "SELECT id FROM cash_sessions WHERE id = $1 AND status = 'OPEN' FOR UPDATE",
          [cashSessionId]
        );
        if (!session.rows[0]) throw new Error("O caixa informado não está aberto.");
      }

      if (financialAccountId) {
        const account = await client.query<{ id: number; active: boolean }>(
          "SELECT id, active FROM financial_accounts WHERE id = $1 FOR UPDATE",
          [financialAccountId]
        );
        if (!account.rows[0] || !account.rows[0].active) throw new Error("A conta financeira informada não está disponível.");
      }

      if (!cashSessionId && !financialAccountId) {
        throw new Error("Informe o caixa ou a conta financeira de destino/origem.");
      }

      await client.query(
        `INSERT INTO financial_settlements (
          financial_entry_id, cash_session_id, financial_account_id, payment_method, amount, notes
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [entryId, cashSessionId ?? null, financialAccountId ?? null, paymentMethod, amount, notes ?? null]
      );

      if (cashSessionId) {
        const eventType = type === "PAYABLE" ? "PAYABLE_PAYMENT" : "CUSTOMER_RECEIPT";
        await client.query(
          `INSERT INTO cash_events (cash_session_id, type, payment_method, amount, description)
           VALUES ($1, $2, $3, $4, $5)`,
          [cashSessionId, eventType, paymentMethod, type === "PAYABLE" ? -Math.abs(amount) : Math.abs(amount),
            type === "PAYABLE" ? `Pagamento: ${record.description}` : `Recebimento: ${record.description}`]
        );
      }

      if (financialAccountId) {
        const signedAmount = type === "PAYABLE" ? -Math.abs(amount) : Math.abs(amount);
        await client.query(
          `INSERT INTO financial_account_transactions
             (financial_account_id, financial_entry_id, amount, transaction_type, payment_method, description)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [financialAccountId, entryId, signedAmount, type === "PAYABLE" ? "EXPENSE" : "INCOME", paymentMethod,
            type === "PAYABLE" ? `Pagamento: ${record.description}` : `Recebimento: ${record.description}`]
        );
      }

      const finalAmount = Number((Number(record.settled_amount) + amount).toFixed(2));
      const isFinal = Math.abs(Number(record.amount) - finalAmount) < 0.005;
      const status = isFinal ? (type === "PAYABLE" ? "PAID" : "RECEIVED") : "PARTIAL";
      const updated = await client.query<FinancialEntry>(
        `UPDATE financial_entries
         SET settled_amount = $2, status = $3, paid_at = CASE WHEN $4 THEN CURRENT_TIMESTAMP ELSE paid_at END
         WHERE id = $1
         RETURNING id, type, description, amount, settled_amount, due_date, paid_at, status,
           customer_id, supplier_id, source, document_number, sale_id, purchase_id, created_at`,
        [entryId, finalAmount, status, isFinal]
      );

      await client.query("COMMIT");
      return updated.rows[0];
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
