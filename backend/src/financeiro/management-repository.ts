import type { Pool } from "pg";
import { FinancialMovementRepository } from "./financial-movement-repository";
import { buildDre } from "./management-reports";

export class FinancialManagementRepository {
  private readonly movements: FinancialMovementRepository;

  constructor(private readonly pool: Pool) {
    this.movements = new FinancialMovementRepository(pool);
  }

  async summary(startDate: string, endDate: string) {
    const result = await this.pool.query(`
      SELECT
        COALESCE(SUM(CASE WHEN type='PAYABLE' AND status IN ('PENDING','PARTIAL') THEN amount-settled_amount ELSE 0 END),0) AS payable_open,
        COALESCE(SUM(CASE WHEN type='RECEIVABLE' AND status IN ('PENDING','PARTIAL') THEN amount-settled_amount ELSE 0 END),0) AS receivable_open,
        COALESCE(SUM(CASE WHEN type='PAYABLE' AND status IN ('PENDING','PARTIAL') AND due_date < CURRENT_DATE THEN amount-settled_amount ELSE 0 END),0) AS overdue_payable,
        COALESCE(SUM(CASE WHEN type='RECEIVABLE' AND status IN ('PENDING','PARTIAL') AND due_date < CURRENT_DATE THEN amount-settled_amount ELSE 0 END),0) AS overdue_receivable,
        COALESCE(SUM(CASE WHEN type='RECEIVABLE' AND paid_at::date BETWEEN $1::date AND $2::date THEN settled_amount ELSE 0 END),0) AS received_period,
        COALESCE(SUM(CASE WHEN type='PAYABLE' AND paid_at::date BETWEEN $1::date AND $2::date THEN settled_amount ELSE 0 END),0) AS paid_period
      FROM financial_entries`, [startDate, endDate]);
    return result.rows[0];
  }

  async cashFlow(startDate: string, endDate: string) {
    const movements = await this.movements.list(startDate, endDate);
    const byDate = new Map<string, { income: number; expense: number }>();

    for (const movement of movements) {
      const date = new Date(movement.date).toISOString().slice(0, 10);
      const current = byDate.get(date) ?? { income: 0, expense: 0 };
      if (movement.amount >= 0) current.income += movement.amount;
      else current.expense += Math.abs(movement.amount);
      byDate.set(date, current);
    }

    let balance = 0;
    return [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, values]) => {
      balance += values.income - values.expense;
      return {
        date,
        income: Number(values.income.toFixed(2)),
        expense: Number(values.expense.toFixed(2)),
        balance: Number(balance.toFixed(2))
      };
    });
  }

  async dre(startDate: string, endDate: string) {
    const [sales, returns, cogs, expenses] = await Promise.all([
      this.pool.query<{ amount: string }>(`
        SELECT COALESCE(SUM(total),0)::numeric AS amount
        FROM sales
        WHERE status = 'CONFIRMED'
          AND created_at::date BETWEEN $1::date AND $2::date`, [startDate, endDate]),
      this.pool.query<{ amount: string }>(`
        SELECT COALESCE(SUM(sr.amount),0)::numeric AS amount
        FROM sales_returns sr
        JOIN sales s ON s.id = sr.sale_id
        WHERE s.created_at::date BETWEEN $1::date AND $2::date`, [startDate, endDate]),
      this.pool.query<{ amount: string }>(`
        SELECT COALESCE(SUM(si.quantity * p.cost),0)::numeric AS amount
        FROM sale_items si
        JOIN sales s ON s.id = si.sale_id
        JOIN products p ON p.id = si.product_id
        WHERE s.status = 'CONFIRMED'
          AND s.created_at::date BETWEEN $1::date AND $2::date`, [startDate, endDate]),
      this.pool.query<{ amount: string }>(`
        SELECT COALESCE(SUM(fe.amount),0)::numeric AS amount
        FROM financial_entries fe
        LEFT JOIN financial_categories fc ON fc.id = fe.category_id
        WHERE fe.type = 'PAYABLE'
          AND fe.status <> 'CANCELLED'
          AND fe.created_at::date BETWEEN $1::date AND $2::date
          AND COALESCE(fc.code, '') NOT IN ('COMPRAS')`, [startDate, endDate])
    ]);

    return buildDre({
      grossRevenue: Number(sales.rows[0].amount),
      salesReturns: Number(returns.rows[0].amount),
      costOfGoodsSold: Number(cogs.rows[0].amount),
      operatingExpenses: Number(expenses.rows[0].amount)
    });
  }

  async totalsByCategory(startDate: string, endDate: string, kind: "INCOME" | "EXPENSE") {
    const result = await this.pool.query(`
      SELECT COALESCE(c.name, 'Sem categoria') AS category,
        COALESCE(SUM(e.settled_amount),0) AS amount
      FROM financial_entries e
      LEFT JOIN financial_categories c ON c.id = e.category_id
      WHERE e.paid_at::date BETWEEN $1::date AND $2::date
        AND (($3='INCOME' AND e.type='RECEIVABLE') OR ($3='EXPENSE' AND e.type='PAYABLE'))
      GROUP BY c.name ORDER BY amount DESC`, [startDate, endDate, kind]);
    return result.rows;
  }
}
