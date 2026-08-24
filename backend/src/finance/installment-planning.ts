export type InstallmentDraft = {
  installmentNumber: number;
  dueDate: string;
  amount: number;
};

export type InstallmentPlan = {
  baseDate: string;
  installments: InstallmentDraft[];
  confirmed: boolean;
};

/**
 * Builds a suggested schedule without persisting anything.
 * The caller must show it to the operator and only persist it after confirmation.
 */
export function buildSuggestedInstallments(
  baseDate: string,
  totalAmount: number,
  count: number,
  intervalDays = 30
): InstallmentPlan {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(baseDate)) throw new Error("Data base inválida.");
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) throw new Error("Valor total inválido.");
  if (!Number.isInteger(count) || count < 1) throw new Error("Quantidade de parcelas inválida.");
  if (!Number.isInteger(intervalDays) || intervalDays < 1) throw new Error("Intervalo de vencimento inválido.");

  const totalCents = Math.round(totalAmount * 100);
  const baseCents = Math.floor(totalCents / count);
  const remainder = totalCents - baseCents * count;
  const installments: InstallmentDraft[] = [];

  for (let i = 1; i <= count; i += 1) {
    const date = new Date(`${baseDate}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + intervalDays * i);
    const amountCents = baseCents + (i <= remainder ? 1 : 0);
    installments.push({
      installmentNumber: i,
      dueDate: date.toISOString().slice(0, 10),
      amount: amountCents / 100
    });
  }

  return { baseDate, installments, confirmed: false };
}

export function confirmInstallmentPlan(
  plan: InstallmentPlan,
  confirmedInstallments: InstallmentDraft[]
): InstallmentPlan {
  if (confirmedInstallments.length !== plan.installments.length) {
    throw new Error("A quantidade de parcelas confirmadas não corresponde ao plano.");
  }
  const total = confirmedInstallments.reduce((sum, item) => sum + item.amount, 0);
  const expected = plan.installments.reduce((sum, item) => sum + item.amount, 0);
  if (Math.abs(total - expected) > 0.005) throw new Error("O total das parcelas não corresponde ao total do documento.");
  for (const item of confirmedInstallments) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(item.dueDate) || item.amount <= 0) {
      throw new Error("Parcela inválida.");
    }
  }
  return { ...plan, installments: confirmedInstallments, confirmed: true };
}
