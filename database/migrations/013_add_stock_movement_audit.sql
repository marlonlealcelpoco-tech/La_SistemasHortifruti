-- Campos de rastreabilidade utilizados pelo fluxo de devolução/troca.
ALTER TABLE stock_movements
  ADD COLUMN IF NOT EXISTS performed_by BIGINT REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS previous_quantity DECIMAL(15,3),
  ADD COLUMN IF NOT EXISTS resulting_quantity DECIMAL(15,3);

CREATE INDEX IF NOT EXISTS idx_stock_movements_performed_by
  ON stock_movements(performed_by);
