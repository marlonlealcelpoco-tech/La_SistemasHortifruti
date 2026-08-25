export type DrillDownType = 'PAYABLE' | 'RECEIVABLE' | 'SALE' | 'PURCHASE' | 'STOCK_MOVEMENT' | 'CASH_MOVEMENT' | 'BANK_MOVEMENT';

export type DrillDownReference = {
  type: DrillDownType;
  id: string;
  label: string;
  date: string;
  amount?: number;
  sourceId?: string;
};

export function createDrillDownReference(input: DrillDownReference): DrillDownReference {
  return { ...input };
}
