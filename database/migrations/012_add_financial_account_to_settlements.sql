-- Compatibilidade do fluxo de recebimento com a conta financeira utilizada na liquidação.
-- financial_accounts ainda não possui uma entidade própria neste schema, portanto a referência
-- permanece opcional até a modelagem do cadastro de contas financeiras.
ALTER TABLE financial_settlements
  ADD COLUMN financial_account_id BIGINT;

CREATE INDEX idx_financial_settlements_account
  ON financial_settlements(financial_account_id, settled_at);
