export type ClosingScenario = {
  name: string;
  expected: string;
};

/**
 * Cenários de fechamento do ERP.
 * Estas regras são agnósticas ao banco para poderem ser usadas pelos testes
 * de integração reais sem duplicar a lógica operacional.
 */
export const ERP_CLOSING_SCENARIOS: ClosingScenario[] = [
  { name: "compra", expected: "entrada aumenta estoque e gera conta a pagar" },
  { name: "venda", expected: "baixa estoque e reconhece receita" },
  { name: "venda_a_prazo", expected: "gera conta a receber sem entrada imediata no caixa" },
  { name: "recebimento", expected: "baixa parcela e movimenta Caixa/Banco" },
  { name: "devolucao", expected: "retorna estoque e gera crédito do cliente" },
  { name: "uso_credito", expected: "abate crédito e recebe somente a diferença" },
  { name: "ajuste_estoque", expected: "gera movimentação com motivo e rastreabilidade" },
  { name: "transferencia", expected: "move saldo entre contas sem gerar receita ou despesa" },
  { name: "dre", expected: "receita líquida menos CMV e despesas resulta no resultado operacional" },
  { name: "fluxo_caixa", expected: "entradas menos saídas representam o movimento financeiro do período" }
];

export function validateStockClosure(opening: number, purchases: number, sales: number, returns: number, adjustments: number, closing: number): boolean {
  return opening + purchases - sales + returns + adjustments === closing;
}

export function validateCashClosure(opening: number, income: number, expense: number, closing: number): boolean {
  return opening + income - expense === closing;
}

export function validateOperationalResult(netRevenue: number, cogs: number, expenses: number, result: number): boolean {
  return netRevenue - cogs - expenses === result;
}
