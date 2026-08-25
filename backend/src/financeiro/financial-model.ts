export const FINANCIAL_ENTRY_TYPES = ["PAYABLE", "RECEIVABLE"] as const;
export type FinancialEntryType = (typeof FINANCIAL_ENTRY_TYPES)[number];

export const FINANCIAL_STATUS = [
  "PENDING",
  "PARTIAL",
  "PAID",
  "RECEIVED",
  "CANCELLED"
] as const;
export type FinancialStatus = (typeof FINANCIAL_STATUS)[number];

export type FinancialSource = "MANUAL" | "SALE" | "PURCHASE" | "XML" | "IMPORT";

export type FinancialAccount = {
  id: number;
  code: string;
  name: string;
  type: "BANK" | "CASH" | "DIGITAL" | "OTHER";
  active: boolean;
};

export type FinancialCategory = {
  id: number;
  code: string;
  name: string;
  kind: "INCOME" | "EXPENSE" | "BOTH";
  active: boolean;
};

export type CostCenter = {
  id: number;
  code: string;
  name: string;
  active: boolean;
};

export type FinancialInstallment = {
  id: number;
  financialEntryId: number;
  installmentNumber: number;
  dueDate: string;
  amount: number;
  settledAmount: number;
  status: "PENDING" | "PARTIAL" | "PAID" | "RECEIVED" | "CANCELLED";
};

export type FinancialSettlement = {
  id: number;
  financialEntryId: number;
  accountId: number | null;
  cashSessionId: number | null;
  paymentMethod: string;
  amount: number;
  settledAt: Date;
  notes: string | null;
};

export type FinancialEntry = {
  id: number;
  type: FinancialEntryType;
  description: string;
  amount: number;
  settledAmount: number;
  dueDate: string | null;
  status: FinancialStatus;
  customerId: number | null;
  supplierId: number | null;
  source: FinancialSource;
  documentNumber: string | null;
  saleId: number | null;
  purchaseId: number | null;
  categoryId: number | null;
  costCenterId: number | null;
  accountId: number | null;
  createdAt: Date;
};
