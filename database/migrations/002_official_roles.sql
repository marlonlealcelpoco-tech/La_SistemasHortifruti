-- LA-Sistemas ERP - Official role catalog
-- Idempotent seed for CI/runtime database initialization.
INSERT INTO roles (name)
SELECT role_name
FROM (VALUES
  ('ADMIN'),
  ('GERENTE'),
  ('SUPERVISOR'),
  ('VENDAS'),
  ('ESTOQUE'),
  ('FINANCEIRO')
) AS seed(role_name)
WHERE NOT EXISTS (
  SELECT 1 FROM roles r WHERE r.name = seed.role_name
);
