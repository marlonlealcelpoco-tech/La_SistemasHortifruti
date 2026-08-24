export type CashFlowPoint = {
  date: string;
  income: number;
  expense: number;
  balance: number;
};

export type FinancialSummary = {
  payableOpen: number;
  receivableOpen: number;
  overduePayable: number;
  overdueReceivable: number;
  receivedPeriod: number;
  paidPeriod: number;
  projectedBalance: number;
};

export type ManagementReport = {
  periodStart: string;
  periodEnd: string;
  summary: FinancialSummary;
  cashFlow: CashFlowPoint[];
  expensesByCategory: Array<{ category: string; amount: number }>;
  incomeByCategory: Array<{ category: string; amount: number }>;
  salesTotal: number;
  purchasesTotal: number;
  grossMargin: number;
};
