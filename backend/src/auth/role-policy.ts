import type { UserRole } from "./user-repository.js";

export const ROLE_POLICY = {
  ADMIN: ["ADMIN"] as UserRole[],
  MANAGER: ["ADMIN", "GERENTE"] as UserRole[],
  FINANCE: ["ADMIN", "FINANCEIRO"] as UserRole[],
  CASH_OPERATORS: ["ADMIN", "GERENTE", "SUPERVISOR", "VENDAS"] as UserRole[],
  CASH_REPORTS: ["ADMIN", "FINANCEIRO"] as UserRole[],
  CUSTOMER_MAINTENANCE: ["ADMIN", "GERENTE", "FINANCEIRO"] as UserRole[],
  PRODUCT_MAINTENANCE: ["ADMIN", "GERENTE", "FINANCEIRO"] as UserRole[],
  PURCHASE_MAINTENANCE: ["ADMIN", "GERENTE", "FINANCEIRO"] as UserRole[],
  INVENTORY_MAINTENANCE: ["ADMIN", "GERENTE", "ESTOQUE"] as UserRole[],
  PDV: ["ADMIN", "GERENTE", "SUPERVISOR", "VENDAS"] as UserRole[],
  SUPERVISOR_AUTHORITY: ["ADMIN", "GERENTE", "SUPERVISOR"] as UserRole[],
  COST_VIEW: ["ADMIN", "GERENTE", "FINANCEIRO"] as UserRole[]
} as const;

export function hasAnyRole(userRoles: UserRole[], allowedRoles: readonly UserRole[]): boolean {
  return allowedRoles.some((role) => userRoles.includes(role));
}
