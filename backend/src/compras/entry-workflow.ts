export type PurchaseEntryMode = "MANUAL" | "XML";
export type PurchaseEntryItemDraft = { productId: number | null; code: string; description: string; quantity: number; unitCost: number };
export type PurchaseEntryPayment = { installmentNumber: number; dueDate: string; amount: number };
export type PurchaseEntryDraft = { mode: PurchaseEntryMode; supplierId: number; documentNumber?: string | null; series?: string | null; documentDate: string; entryDate: string; xmlAccessKey?: string | null; items: PurchaseEntryItemDraft[]; total: number; payments: PurchaseEntryPayment[]; installmentPlanConfirmed: boolean };
export function validatePurchaseEntryBeforeConfirmation(entry: PurchaseEntryDraft): void {
  if (!entry.supplierId) throw new Error("Fornecedor é obrigatório.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.documentDate)) throw new Error("Data da nota inválida.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.entryDate)) throw new Error("Data de entrada inválida.");
  if (!entry.items.length) throw new Error("A entrada precisa ter pelo menos um item.");
  if (!Number.isFinite(entry.total) || entry.total <= 0) throw new Error("Total da entrada inválido.");
  if (!entry.payments.length) throw new Error("Informe a condição de pagamento.");
  if (!entry.installmentPlanConfirmed) throw new Error("Confirme as condições e datas do financeiro antes de lançar a entrada.");
  const itemsTotal = entry.items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
  const paymentsTotal = entry.payments.reduce((sum, item) => sum + item.amount, 0);
  if (Math.abs(itemsTotal - entry.total) > 0.005) throw new Error("O total dos itens não corresponde ao total da entrada.");
  if (Math.abs(paymentsTotal - entry.total) > 0.005) throw new Error("O parcelamento não corresponde ao total da entrada.");
  for (const item of entry.items) { if (!item.code.trim() || !item.description.trim()) throw new Error("Código e descrição são obrigatórios para todos os itens."); if (!Number.isFinite(item.quantity) || item.quantity <= 0) throw new Error(`Quantidade inválida para ${item.description}.`); if (!Number.isFinite(item.unitCost) || item.unitCost < 0) throw new Error(`Custo inválido para ${item.description}.`); if (item.productId === null) throw new Error(`Cadastre/vincule o produto ${item.description} antes de confirmar a entrada.`); }
  for (const payment of entry.payments) { if (!Number.isInteger(payment.installmentNumber) || payment.installmentNumber < 1) throw new Error("Número de parcela inválido."); if (!/^\d{4}-\d{2}-\d{2}$/.test(payment.dueDate) || payment.amount <= 0) throw new Error("Parcela financeira inválida."); }
}
