export type SaleContext = {
  customerId?: number | null;
  hasCreditSale: boolean;
  hasStoreCreditUse: boolean;
};

export type ReturnContext = {
  customerId?: number | null;
  generatesStoreCredit: boolean;
};

export type CashCloseContext = {
  expectedAmount: number;
  countedAmount: number;
};

export function validateSaleCustomer(context: SaleContext): void {
  if ((context.hasCreditSale || context.hasStoreCreditUse) && !context.customerId) {
    throw new Error("Cliente identificado é obrigatório para venda a prazo ou utilização de crédito de troca.");
  }
}

export function validateReturnCustomer(context: ReturnContext): void {
  if (context.generatesStoreCredit && !context.customerId) {
    throw new Error("Cliente identificado é obrigatório para gerar crédito de troca/devolução.");
  }
}

export function calculateCashDifference(context: CashCloseContext): number {
  return Number((context.countedAmount - context.expectedAmount).toFixed(2));
}

export function validateCashTransaction(amount: number, reason?: string): void {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Valor da movimentação de caixa deve ser maior que zero.");
  if (!reason || reason.trim().length < 2) throw new Error("Motivo da movimentação de caixa é obrigatório.");
}

export function validateStockAdjustment(quantity: number, reason?: string): void {
  if (!Number.isFinite(quantity) || quantity === 0) throw new Error("Ajuste de estoque deve possuir quantidade diferente de zero.");
  if (!reason || reason.trim().length < 2) throw new Error("Motivo do ajuste de estoque é obrigatório.");
}
