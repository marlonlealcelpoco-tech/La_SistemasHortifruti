-- LA-Sistemas ERP - Financial foundation
-- Idempotent migration. Execute inside the application's PostgreSQL database.

CREATE TABLE IF NOT EXISTS financial_accounts (
  id BIGSERIAL PRIMARY KEY,
  code VARCHAR(30) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('BANK','CASH','DIGITAL','OTHER')),
  bank_name VARCHAR(120),
  bank_code VARCHAR(20),
  agency VARCHAR(30),
  account_number VARCHAR(50),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  opening_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS financial_categories (
  id BIGSERIAL PRIMARY KEY,
  code VARCHAR(30) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  kind VARCHAR(10) NOT NULL CHECK (kind IN ('INCOME','EXPENSE','BOTH')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cost_centers (
  id BIGSERIAL PRIMARY KEY,
  code VARCHAR(30) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE financial_entries
  ADD COLUMN IF NOT EXISTS category_id BIGINT REFERENCES financial_categories(id),
  ADD COLUMN IF NOT EXISTS cost_center_id BIGINT REFERENCES cost_centers(id),
  ADD COLUMN IF NOT EXISTS financial_account_id BIGINT REFERENCES financial_accounts(id),
  ADD COLUMN IF NOT EXISTS installment_count INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS financial_installments (
  id BIGSERIAL PRIMARY KEY,
  financial_entry_id BIGINT NOT NULL REFERENCES financial_entries(id) ON DELETE CASCADE,
  installment_number INTEGER NOT NULL,
  due_date DATE NOT NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  settled_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (settled_amount >= 0),
  status VARCHAR(15) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','PARTIAL','PAID','RECEIVED','CANCELLED')),
  UNIQUE(financial_entry_id, installment_number)
);

ALTER TABLE financial_settlements
  ADD COLUMN IF NOT EXISTS financial_account_id BIGINT REFERENCES financial_accounts(id),
  ADD COLUMN IF NOT EXISTS installment_id BIGINT REFERENCES financial_installments(id),
  ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS financial_account_movements (
  id BIGSERIAL PRIMARY KEY,
  financial_account_id BIGINT NOT NULL REFERENCES financial_accounts(id),
  direction VARCHAR(3) NOT NULL CHECK (direction IN ('IN','OUT')),
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  movement_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  description VARCHAR(255) NOT NULL,
  financial_entry_id BIGINT REFERENCES financial_entries(id),
  settlement_id BIGINT REFERENCES financial_settlements(id),
  source_type VARCHAR(30),
  source_id BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_financial_entries_type_status_due
  ON financial_entries(type, status, due_date);
CREATE INDEX IF NOT EXISTS idx_financial_installments_due
  ON financial_installments(due_date, status);
CREATE INDEX IF NOT EXISTS idx_financial_movements_account_date
  ON financial_account_movements(financial_account_id, movement_date);

INSERT INTO financial_accounts (code, name, type)
VALUES ('CAIXA', 'Caixa físico', 'CASH')
ON CONFLICT (code) DO NOTHING;

INSERT INTO financial_categories (code, name, kind)
VALUES
  ('VENDAS', 'Vendas', 'INCOME'),
  ('COMPRAS', 'Compras', 'EXPENSE'),
  ('DESPESAS', 'Despesas gerais', 'EXPENSE'),
  ('SERVICOS', 'Serviços', 'EXPENSE'),
  ('OUTRAS_RECEITAS', 'Outras receitas', 'INCOME')
ON CONFLICT (code) DO NOTHING;
