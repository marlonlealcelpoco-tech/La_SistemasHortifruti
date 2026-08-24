-- Estrutura fiscal do cadastro de produtos para futura NF-e/NFC-e.
-- Todos os campos são opcionais nesta etapa; a obrigatoriedade será aplicada
-- conforme o tipo de operação e o regime tributário no módulo fiscal.
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS ncm VARCHAR(8),
  ADD COLUMN IF NOT EXISTS cest VARCHAR(7),
  ADD COLUMN IF NOT EXISTS cfop VARCHAR(4),
  ADD COLUMN IF NOT EXISTS tax_code_type VARCHAR(5),
  ADD COLUMN IF NOT EXISTS tax_code VARCHAR(4),
  ADD COLUMN IF NOT EXISTS origin SMALLINT,
  ADD COLUMN IF NOT EXISTS gtin VARCHAR(14),
  ADD COLUMN IF NOT EXISTS gtin_trib VARCHAR(14),
  ADD COLUMN IF NOT EXISTS tax_unit VARCHAR(20),
  ADD COLUMN IF NOT EXISTS icms_rate DECIMAL(7,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pis_cst VARCHAR(2),
  ADD COLUMN IF NOT EXISTS pis_rate DECIMAL(7,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cofins_cst VARCHAR(2),
  ADD COLUMN IF NOT EXISTS cofins_rate DECIMAL(7,4) NOT NULL DEFAULT 0;

ALTER TABLE products
  DROP CONSTRAINT IF EXISTS products_fiscal_ncm_digits,
  DROP CONSTRAINT IF EXISTS products_fiscal_cest_digits,
  DROP CONSTRAINT IF EXISTS products_fiscal_cfop_digits,
  DROP CONSTRAINT IF EXISTS products_fiscal_tax_code_type,
  DROP CONSTRAINT IF EXISTS products_fiscal_origin,
  DROP CONSTRAINT IF EXISTS products_fiscal_gtin_digits,
  DROP CONSTRAINT IF EXISTS products_fiscal_gtin_trib_digits,
  DROP CONSTRAINT IF EXISTS products_fiscal_rates;

ALTER TABLE products
  ADD CONSTRAINT products_fiscal_ncm_digits CHECK (ncm IS NULL OR ncm ~ '^[0-9]{8}$'),
  ADD CONSTRAINT products_fiscal_cest_digits CHECK (cest IS NULL OR cest ~ '^[0-9]{7}$'),
  ADD CONSTRAINT products_fiscal_cfop_digits CHECK (cfop IS NULL OR cfop ~ '^[0-9]{4}$'),
  ADD CONSTRAINT products_fiscal_tax_code_type CHECK (tax_code_type IS NULL OR tax_code_type IN ('CST', 'CSOSN')),
  ADD CONSTRAINT products_fiscal_origin CHECK (origin IS NULL OR origin BETWEEN 0 AND 8),
  ADD CONSTRAINT products_fiscal_gtin_digits CHECK (gtin IS NULL OR gtin ~ '^[0-9]{8,14}$'),
  ADD CONSTRAINT products_fiscal_gtin_trib_digits CHECK (gtin_trib IS NULL OR gtin_trib ~ '^[0-9]{8,14}$'),
  ADD CONSTRAINT products_fiscal_rates CHECK (
    icms_rate BETWEEN 0 AND 100 AND pis_rate BETWEEN 0 AND 100 AND cofins_rate BETWEEN 0 AND 100
  );

CREATE INDEX IF NOT EXISTS idx_products_ncm ON products(ncm);
CREATE INDEX IF NOT EXISTS idx_products_gtin ON products(gtin);
