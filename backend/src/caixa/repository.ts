import type { Pool } from "pg";

export const CASH_EVENT_TYPES = ["SUPPLY", "WITHDRAWAL", "CUSTOMER_RECEIPT", "PURCHASE_ON_CREDIT"] as const;
export type CashEventType = (typeof CASH_EVENT_TYPES)[number];

export type CashSession = {
  id: number;
  terminal_id: string;
  seller_id: number;
  seller_name?: string;
  status: "OPEN" | "CLOSED";
  opening_amount: string;
  opened_at: Date;
  closed_at: Date | null;
  closing_amount: string | null;
  report_snapshot: unknown | null;
};

type CashEvent = {
  type: string;
  payment_method: string | null;
  amount: string;
};

type CashReport = {
  session: CashSession;
  salesByPaymentMethod: Record<string, number>;
  totals: {
    opening: number;
    customerReceipts: number;
    supplies: number;
    withdrawals: number;
    purchasesOnCredit: number;
    creditSales: number;
    cancellations: number;
    expectedCash: number;
  };
};

export class CashRepository {
  constructor(private readonly pool: Pool) {}

  async open(terminalId: string, sellerId: number, openingAmount: number): Promise<CashSession | "already_open"> {
    const existing = await this.pool.query<{ id: number }>(
      "SELECT id FROM cash_sessions WHERE terminal_id = $1 AND status = 'OPEN' LIMIT 1",
      [terminalId]
    );
    if (existing.rows[0]) return "already_open";

    const result = await this.pool.query<CashSession>(
      `INSERT INTO cash_sessions (terminal_id, seller_id, opening_amount)
       VALUES ($1, $2, $3)
       RETURNING id, terminal_id, seller_id, status, opening_amount, opened_at, closed_at, closing_amount, report_snapshot`,
      [terminalId.trim(), sellerId, openingAmount]
    );
    const session = result.rows[0];
    await this.pool.query(
      `INSERT INTO cash_events (cash_session_id, type, amount, description)
       VALUES ($1, 'OPENING', $2, 'Abertura de caixa')`,
      [session.id, openingAmount]
    );
    return session;
  }

  async find(id: number): Promise<CashSession | undefined> {
    const result = await this.pool.query<CashSession>(
      `SELECT cash_sessions.id, terminal_id, seller_id, users.name AS seller_name, status,
        opening_amount, opened_at, closed_at, closing_amount, report_snapshot
       FROM cash_sessions INNER JOIN users ON users.id = cash_sessions.seller_id
       WHERE cash_sessions.id = $1`,
      [id]
    );
    return result.rows[0];
  }

  async list(date?: string, terminalId?: string): Promise<CashSession[]> {
    const result = await this.pool.query<CashSession>(
      `SELECT cash_sessions.id, terminal_id, seller_id, users.name AS seller_name, status,
        opening_amount, opened_at, closed_at, closing_amount, report_snapshot
       FROM cash_sessions INNER JOIN users ON users.id = cash_sessions.seller_id
       WHERE ($1::date IS NULL OR cash_sessions.opened_at::date = $1::date)
         AND ($2::text IS NULL OR terminal_id = $2)
       ORDER BY opened_at DESC`,
      [date ?? null, terminalId ?? null]
    );
    return result.rows;
  }

  async addEvent(sessionId: number, type: CashEventType, amount: number, description?: string): Promise<boolean> {
    const session = await this.pool.query<{ id: number }>(
      "SELECT id FROM cash_sessions WHERE id = $1 AND status = 'OPEN'",
      [sessionId]
    );
    if (!session.rows[0]) return false;

    await this.pool.query(
      "INSERT INTO cash_events (cash_session_id, type, amount, description) VALUES ($1, $2, $3, $4)",
      [sessionId, type, amount, description ?? null]
    );
    return true;
  }

  async report(sessionId: number): Promise<CashReport | undefined> {
    const session = await this.find(sessionId);
    if (!session) return undefined;

    const events = await this.pool.query<CashEvent>(
      "SELECT type, payment_method, amount FROM cash_events WHERE cash_session_id = $1 ORDER BY id",
      [sessionId]
    );
    const paymentTotals: Record<string, number> = {};
    const totals = {
      opening: Number(session.opening_amount),
      customerReceipts: 0,
      supplies: 0,
      withdrawals: 0,
      purchasesOnCredit: 0,
      creditSales: 0,
      cancellations: 0,
      expectedCash: 0
    };

    for (const event of events.rows) {
      const amount = Number(event.amount);
      const method = event.payment_method ?? "UNSPECIFIED";

      if (event.type === "SALE_PAYMENT") {
        paymentTotals[method] = Number(((paymentTotals[method] ?? 0) + amount).toFixed(2));
      }
      if (event.type === "CREDIT_SALE") totals.creditSales += amount;
      if (event.type === "CANCELLATION") {
        if (method === "CREDIT") {
          totals.creditSales += amount;
        } else {
          paymentTotals[method] = Number(((paymentTotals[method] ?? 0) + amount).toFixed(2));
        }
        totals.cancellations += Math.abs(amount);
      }
      if (event.type === "CUSTOMER_RECEIPT") totals.customerReceipts += amount;
      if (event.type === "SUPPLY") totals.supplies += amount;
      if (event.type === "WITHDRAWAL") totals.withdrawals += amount;
      if (event.type === "PURCHASE_ON_CREDIT") totals.purchasesOnCredit += amount;
    }

    const cashSales = paymentTotals.CASH ?? 0;
    totals.expectedCash = Number((
      totals.opening + cashSales + totals.customerReceipts + totals.supplies
      - totals.withdrawals - totals.purchasesOnCredit
    ).toFixed(2));

    return { session, salesByPaymentMethod: paymentTotals, totals };
  }

  async close(sessionId: number, closingAmount: number): Promise<Record<string, unknown> | "not_found" | "already_closed"> {
    const session = await this.find(sessionId);
    if (!session) return "not_found";
    if (session.status !== "OPEN") return "already_closed";

    const report = await this.report(sessionId);
    if (!report) return "not_found";

    await this.pool.query(
      `UPDATE cash_sessions
       SET status = 'CLOSED', closed_at = CURRENT_TIMESTAMP, closing_amount = $2, report_snapshot = $3
       WHERE id = $1 AND status = 'OPEN'`,
      [sessionId, closingAmount, report]
    );
    return {
      ...report,
      closingAmount,
      difference: Number((closingAmount - report.totals.expectedCash).toFixed(2))
    };
  }
}
