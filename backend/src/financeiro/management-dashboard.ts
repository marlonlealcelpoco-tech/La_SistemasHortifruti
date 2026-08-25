import type { Pool } from "pg";
import { buildManagementAlerts, type ManagementAlert } from "./management-alerts";
import { createDrillDownReference, type DrillDownReference } from "./management-drilldown";
import { FinancialMovementRepository } from "./financial-movement-repository";

export type ManagementDashboard = {
  cashAndBanks: number;
  cashFlow: { income: number; expense: number; net: number; closingBalance: number };
  receivablesOpen: number;
  receivablesOverdue: number;
  payablesOpen: number;
  payablesOverdue: number;
  salesPeriod: number;
  purchasesPeriod: number;
  stockValue: number;
};

export type ManagementDashboardResult = ManagementDashboard & { alerts: ManagementAlert[] };

export class ManagementDashboardRepository {
  private readonly movements: FinancialMovementRepository;

  constructor(private readonly pool: Pool) { this.movements = new FinancialMovementRepository(pool); }

  async summary(from: string, to: string): Promise<ManagementDashboardResult> {
    const [accounts, sales, purchases, stock, movementRows] = await Promise.all([
      this.pool.query<{ cash_banks: string; receivables_open: string; receivables_overdue: string; payables_open: string; payables_overdue: string }>(`
        SELECT
          COALESCE((SELECT SUM(balance) FROM financial_accounts WHERE active = TRUE),0)::numeric AS cash_banks,
          COALESCE((SELECT SUM(amount-settled_amount) FROM financial_installments fi JOIN financial_entries fe ON fe.id=fi.financial_entry_id WHERE fe.type='RECEIVABLE' AND fi.status IN ('PENDING','PARTIAL')),0)::numeric AS receivables_open,
          COALESCE((SELECT SUM(amount-settled_amount) FROM financial_installments fi JOIN financial_entries fe ON fe.id=fi.financial_entry_id WHERE fe.type='RECEIVABLE' AND fi.status IN ('PENDING','PARTIAL') AND fi.due_date < CURRENT_DATE),0)::numeric AS receivables_overdue,
          COALESCE((SELECT SUM(amount-settled_amount) FROM financial_installments fi JOIN financial_entries fe ON fe.id=fi.financial_entry_id WHERE fe.type='PAYABLE' AND fi.status IN ('PENDING','PARTIAL')),0)::numeric AS payables_open,
          COALESCE((SELECT SUM(amount-settled_amount) FROM financial_installments fi JOIN financial_entries fe ON fe.id=fi.financial_entry_id WHERE fe.type='PAYABLE' AND fi.status IN ('PENDING','PARTIAL') AND fi.due_date < CURRENT_DATE),0)::numeric AS payables_overdue`),
      this.pool.query<{ total: string }>("SELECT COALESCE(SUM(total),0)::numeric AS total FROM sales WHERE status='CONFIRMED' AND created_at::date BETWEEN $1::date AND $2::date", [from, to]),
      this.pool.query<{ total: string }>("SELECT COALESCE(SUM(total),0)::numeric AS total FROM purchase_entries WHERE status='CONFIRMED' AND entry_date::date BETWEEN $1::date AND $2::date", [from, to]),
      this.pool.query<{ value: string }>("SELECT COALESCE(SUM(s.quantity * COALESCE(p.cost,0)),0)::numeric AS value FROM stock s JOIN products p ON p.id=s.product_id"),
      this.movements.list(from, to)
    ]);
    const a = accounts.rows[0];
    const income = movementRows.filter((m) => m.amount > 0).reduce((sum, m) => sum + m.amount, 0);
    const expense = movementRows.filter((m) => m.amount < 0).reduce((sum, m) => sum + Math.abs(m.amount), 0);
    const net = income - expense;
    const closingBalance = Number(a.cash_banks);
    const summary = {
      cashAndBanks: closingBalance,
      cashFlow: { income: Number(income.toFixed(2)), expense: Number(expense.toFixed(2)), net: Number(net.toFixed(2)), closingBalance },
      receivablesOpen: Number(a.receivables_open), receivablesOverdue: Number(a.receivables_overdue),
      payablesOpen: Number(a.payables_open), payablesOverdue: Number(a.payables_overdue),
      salesPeriod: Number(sales.rows[0].total), purchasesPeriod: Number(purchases.rows[0].total), stockValue: Number(stock.rows[0].value)
    };
    return { ...summary, alerts: buildManagementAlerts({ overdueReceivable: summary.receivablesOverdue, overduePayable: summary.payablesOverdue, lowStockItems: 0 }) };
  }

  async overdueDrillDown(kind: "PAYABLE" | "RECEIVABLE"): Promise<DrillDownReference[]> {
    const result = await this.pool.query<{ id: string; due_date: string; outstanding: string }>(`
      SELECT fi.id::text AS id, fi.due_date::date AS due_date, (fi.amount - fi.settled_amount)::numeric AS outstanding
      FROM financial_installments fi JOIN financial_entries fe ON fe.id = fi.financial_entry_id
      WHERE fe.type = $1 AND fi.status IN ('PENDING','PARTIAL') AND fi.due_date < CURRENT_DATE
      ORDER BY fi.due_date ASC`, [kind]);
    return result.rows.map((row) => createDrillDownReference({ type: kind, id: row.id, label: `${kind === 'RECEIVABLE' ? 'Receber' : 'Pagar'} em atraso`, date: row.due_date, amount: Number(row.outstanding), sourceId: row.id }));
  }
}
