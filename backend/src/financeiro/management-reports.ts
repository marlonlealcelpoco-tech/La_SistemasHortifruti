export type CashFlowRow = {
  date: string;
  income: number;
  expense: number;
  net: number;
  balance: number;
};

export type DreReport = {
  grossRevenue: number;
  salesReturns: number;
  netRevenue: number;
  costOfGoodsSold: number;
  grossProfit: number;
  operatingExpenses: number;
  operatingResult: number;
};

export type DreInput = {
  grossRevenue: number;
  salesReturns?: number;
  costOfGoodsSold?: number;
  operatingExpenses?: number;
};

export function buildCashFlow(rows: Array<{ date: string; income: number; expense: number }>, openingBalance = 0): CashFlowRow[] {
  let balance = openingBalance;
  return rows.map((row) => {
    const income = Number(row.income || 0);
    const expense = Number(row.expense || 0);
    const net = income - expense;
    balance += net;
    return { date: row.date, income, expense, net, balance };
  });
}

/**
 * DRE gerencial: resultado econômico do período, separado do fluxo de caixa.
 * Receita e despesas são informadas pelas fontes operacionais; recebimento/pagamento
 * não deve ser somado novamente como receita/despesa.
 */
export function buildDre(input: DreInput): DreReport {
  const grossRevenue = Math.max(0, Number(input.grossRevenue || 0));
  const salesReturns = Math.max(0, Number(input.salesReturns || 0));
  const costOfGoodsSold = Math.max(0, Number(input.costOfGoodsSold || 0));
  const operatingExpenses = Math.max(0, Number(input.operatingExpenses || 0));
  const netRevenue = Math.max(0, grossRevenue - salesReturns);
  const grossProfit = netRevenue - costOfGoodsSold;

  return {
    grossRevenue,
    salesReturns,
    netRevenue,
    costOfGoodsSold,
    grossProfit,
    operatingExpenses,
    operatingResult: grossProfit - operatingExpenses
  };
}

export function dreMarginPercent(value: number, revenue: number): number {
  if (!revenue) return 0;
  return Number(((value / revenue) * 100).toFixed(2));
}
