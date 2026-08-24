-- LA-Sistemas ERP - Official role catalog
-- Idempotent seed for CI/runtime database initialization.
-- The base schema defines roles.id as BIGINT PRIMARY KEY without an identity,
-- so this migration assigns deterministic new ids above the current maximum.
WITH seed(role_name) AS (
  VALUES
    ('ADMIN'),
    ('GERENTE'),
    ('SUPERVISOR'),
    ('VENDAS'),
    ('ESTOQUE'),
    ('FINANCEIRO')
),
missing AS (
  SELECT s.role_name,
         ROW_NUMBER() OVER (ORDER BY s.role_name) AS rn
  FROM seed s
  WHERE NOT EXISTS (
    SELECT 1 FROM roles r WHERE r.name = s.role_name
  )
),
base AS (
  SELECT COALESCE(MAX(id), 0) AS max_id FROM roles
)
INSERT INTO roles (id, name)
SELECT base.max_id + missing.rn, missing.role_name
FROM missing
CROSS JOIN base;
