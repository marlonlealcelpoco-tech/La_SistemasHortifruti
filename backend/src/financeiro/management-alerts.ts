export type ManagementAlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export type ManagementAlert = {
  code: string;
  severity: ManagementAlertSeverity;
  title: string;
  description: string;
  source?: string;
  sourceId?: string;
};

export type AlertThresholds = {
  overdueReceivable?: number;
  overduePayable?: number;
  lowStockItems?: number;
};

export function buildManagementAlerts(
  metrics: { overdueReceivable: number; overduePayable: number; lowStockItems: number },
  thresholds: AlertThresholds = {}
): ManagementAlert[] {
  const alerts: ManagementAlert[] = [];
  const receivableLimit = thresholds.overdueReceivable ?? 0;
  const payableLimit = thresholds.overduePayable ?? 0;
  const lowStockLimit = thresholds.lowStockItems ?? 0;

  if (metrics.overdueReceivable > receivableLimit) {
    alerts.push({ code: 'RECEIVABLE_OVERDUE', severity: 'CRITICAL', title: 'Contas a receber vencidas', description: `Existem R$ ${metrics.overdueReceivable.toFixed(2)} em recebíveis vencidos.`, source: 'financial_receivables' });
  }
  if (metrics.overduePayable > payableLimit) {
    alerts.push({ code: 'PAYABLE_OVERDUE', severity: 'CRITICAL', title: 'Contas a pagar vencidas', description: `Existem R$ ${metrics.overduePayable.toFixed(2)} em obrigações vencidas.`, source: 'financial_payables' });
  }
  if (metrics.lowStockItems > lowStockLimit) {
    alerts.push({ code: 'LOW_STOCK', severity: 'WARNING', title: 'Estoque abaixo do mínimo', description: `${metrics.lowStockItems} produto(s) estão abaixo do estoque mínimo.`, source: 'inventory' });
  }
  return alerts;
}
