import type { PoolClient } from "pg";
import type { InstallmentDraft, InstallmentPlan } from "./installment-planning.js";

export async function persistConfirmedInstallments(
  client: PoolClient,
  financialEntryId: number,
  plan: InstallmentPlan
): Promise<void> {
  if (!plan.confirmed) throw new Error("O parcelamento precisa ser confirmado antes do lançamento financeiro.");
  if (!plan.installments.length) throw new Error("O parcelamento precisa ter pelo menos uma parcela.");

  const total = plan.installments.reduce((sum, item) => sum + item.amount, 0);
  const entry = await client.query<{ amount: string }>(
    "SELECT amount FROM financial_entries WHERE id = $1 FOR UPDATE",
    [financialEntryId]
  );
  if (!entry.rows[0]) throw new Error("Conta financeira não encontrada.");
  if (Math.abs(Number(entry.rows[0].amount) - total) > 0.005) {
    throw new Error("A soma das parcelas não corresponde ao valor da conta.");
  }

  await client.query("DELETE FROM financial_installments WHERE financial_entry_id = $1", [financialEntryId]);
  for (const item of plan.installments) {
    validateInstallment(item);
    await client.query(
      `INSERT INTO financial_installments
        (financial_entry_id, installment_number, due_date, amount, settled_amount, status)
       VALUES ($1, $2, $3, $4, 0, 'PENDING')`,
      [financialEntryId, item.installmentNumber, item.dueDate, item.amount]
    );
  }
}

function validateInstallment(item: InstallmentDraft): void {
  if (!Number.isInteger(item.installmentNumber) || item.installmentNumber < 1) throw new Error("Número de parcela inválido.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(item.dueDate)) throw new Error("Data de vencimento inválida.");
  if (!Number.isFinite(item.amount) || item.amount <= 0) throw new Error("Valor da parcela inválido.");
}
