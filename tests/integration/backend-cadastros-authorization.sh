#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@example.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-Admin1234}"
RUN_ID="${GITHUB_RUN_ID:-local}-$(date +%s%N)"

expect_status() {
  local expected="$1"; shift
  local body_file="/tmp/erp-cadastros-response.json"
  local status
  status=$(curl -sS -o "$body_file" -w '%{http_code}' "$@" || true)
  echo "HTTP $status"
  cat "$body_file"
  test "$status" = "$expected"
}

login() {
  local email="$1" password="$2" out="$3"
  curl --fail --silent --show-error -H 'Content-Type: application/json' \
    -d "{\"email\":\"$email\",\"password\":\"$password\"}" \
    "$BASE_URL/auth/login" > "$out"
  jq -e '.token != null and .token != ""' "$out" >/dev/null
}

create_user() {
  local role="$1" email="$2" password="$3" out="$4"
  curl --fail --silent --show-error "${ADMIN_AUTH[@]}" -H 'Content-Type: application/json' \
    -d "{\"name\":\"E2E $role\",\"email\":\"$email\",\"password\":\"$password\",\"roles\":[\"$role\"]}" \
    "$BASE_URL/users" > "$out"
  jq -e '.user.id != null' "$out" >/dev/null
}

ADMIN_JSON=/tmp/erp-cadastros-admin.json
login "$ADMIN_EMAIL" "$ADMIN_PASSWORD" "$ADMIN_JSON"
ADMIN_TOKEN=$(jq -r '.token' "$ADMIN_JSON")
ADMIN_AUTH=(-H "Authorization: Bearer $ADMIN_TOKEN")

echo "MÓDULO 2 — CADASTROS / AUTORIZAÇÃO POR PERFIL"
echo "1) Create test users for VENDAS, SUPERVISOR, ESTOQUE, FINANCEIRO and GERENTE"
VENDAS_EMAIL="cad-vendas-${RUN_ID}@example.com"
SUP_EMAIL="cad-supervisor-${RUN_ID}@example.com"
EST_EMAIL="cad-estoque-${RUN_ID}@example.com"
FIN_EMAIL="cad-financeiro-${RUN_ID}@example.com"
GER_EMAIL="cad-gerente-${RUN_ID}@example.com"
create_user VENDAS "$VENDAS_EMAIL" Vendas1234 /tmp/cad-vendas.json
create_user SUPERVISOR "$SUP_EMAIL" Supervisor1234 /tmp/cad-supervisor.json
create_user ESTOQUE "$EST_EMAIL" Estoque1234 /tmp/cad-estoque.json
create_user FINANCEIRO "$FIN_EMAIL" Financeiro1234 /tmp/cad-financeiro.json
create_user GERENTE "$GER_EMAIL" Gerente1234 /tmp/cad-gerente.json

echo "2) Admin creates probe customer, supplier and product"
CUSTOMER_EMAIL="cad-cliente-${RUN_ID}@example.com"
curl --fail --silent --show-error "${ADMIN_AUTH[@]}" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Cliente Cadastro $RUN_ID\",\"document\":\"CAD-$RUN_ID\",\"email\":\"$CUSTOMER_EMAIL\",\"phone\":\"21988880000\"}" \
  "$BASE_URL/customers" > /tmp/cad-customer.json
CUSTOMER_ID=$(jq -r '.customer.id' /tmp/cad-customer.json)

curl --fail --silent --show-error "${ADMIN_AUTH[@]}" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Fornecedor Cadastro $RUN_ID\",\"document\":\"SUP-$RUN_ID\",\"email\":\"sup-$RUN_ID@example.com\",\"phone\":\"21988880001\"}" \
  "$BASE_URL/suppliers" > /tmp/cad-supplier.json
SUPPLIER_ID=$(jq -r '.supplier.id' /tmp/cad-supplier.json)

curl --fail --silent --show-error "${ADMIN_AUTH[@]}" -H 'Content-Type: application/json' \
  -d "{\"code\":\"CAD-${GITHUB_RUN_ID:-local}\",\"name\":\"Produto Cadastro $RUN_ID\",\"unit\":\"UN\",\"cost\":5,\"salePrice\":10,\"profitMarginPct\":100}" \
  "$BASE_URL/products" > /tmp/cad-product.json
PRODUCT_ID=$(jq -r '.product.id' /tmp/cad-product.json)

test "$CUSTOMER_ID" != null
test "$SUPPLIER_ID" != null
test "$PRODUCT_ID" != null

declare -A TOKENS
for spec in \
  "VENDAS|$VENDAS_EMAIL|Vendas1234" \
  "SUPERVISOR|$SUP_EMAIL|Supervisor1234" \
  "ESTOQUE|$EST_EMAIL|Estoque1234" \
  "FINANCEIRO|$FIN_EMAIL|Financeiro1234" \
  "GERENTE|$GER_EMAIL|Gerente1234"; do
  IFS='|' read -r role email password <<< "$spec"
  login "$email" "$password" "/tmp/cad-login-$role.json"
  TOKENS[$role]=$(jq -r '.token' "/tmp/cad-login-$role.json")
done

for role in VENDAS SUPERVISOR ESTOQUE FINANCEIRO GERENTE; do
  eval "${role}_AUTH=(-H \"Authorization: Bearer ${TOKENS[$role]}\")"
done

echo "3) Customer query: all five non-admin roles can consult customers"
for role in VENDAS SUPERVISOR ESTOQUE FINANCEIRO GERENTE; do
  declare -n AUTH_REF="${role}_AUTH"
  curl --fail --silent "${AUTH_REF[@]}" "$BASE_URL/customers?search=Cliente%20Cadastro" > "/tmp/cad-customer-$role.json"
  jq -e '.customers | length >= 1' "/tmp/cad-customer-$role.json" >/dev/null
done

echo "4) Customer maintenance: VENDAS, SUPERVISOR and ESTOQUE must be denied"
for role in VENDAS SUPERVISOR ESTOQUE; do
  declare -n AUTH_REF="${role}_AUTH"
  expect_status 403 "${AUTH_REF[@]}" -X PUT -H 'Content-Type: application/json' \
    -d "{\"name\":\"Cliente bloqueado $RUN_ID\",\"document\":\"CAD-$RUN_ID\",\"email\":\"$CUSTOMER_EMAIL\",\"phone\":\"21900000000\"}" \
    "$BASE_URL/customers/$CUSTOMER_ID"
done

echo "5) Customer maintenance: FINANCEIRO and GERENTE must be allowed"
for role in FINANCEIRO GERENTE; do
  declare -n AUTH_REF="${role}_AUTH"
  curl --fail --silent --show-error "${AUTH_REF[@]}" -X PUT -H 'Content-Type: application/json' \
    -d "{\"name\":\"Cliente $role $RUN_ID\",\"document\":\"CAD-$RUN_ID\",\"email\":\"$CUSTOMER_EMAIL\",\"phone\":\"21977770000\"}" \
    "$BASE_URL/customers/$CUSTOMER_ID" >/dev/null
done

echo "6) Supplier query: only FINANCEIRO and GERENTE are allowed among non-admin roles"
for role in VENDAS SUPERVISOR ESTOQUE; do
  declare -n AUTH_REF="${role}_AUTH"
  expect_status 403 "${AUTH_REF[@]}" "$BASE_URL/suppliers?search=Fornecedor%20Cadastro"
done
for role in FINANCEIRO GERENTE; do
  declare -n AUTH_REF="${role}_AUTH"
  curl --fail --silent "${AUTH_REF[@]}" "$BASE_URL/suppliers?search=Fornecedor%20Cadastro" > "/tmp/cad-supplier-$role.json"
  jq -e '.suppliers | length >= 1' "/tmp/cad-supplier-$role.json" >/dev/null
done

echo "7) Supplier maintenance: only FINANCEIRO and GERENTE are allowed"
for role in VENDAS SUPERVISOR ESTOQUE; do
  declare -n AUTH_REF="${role}_AUTH"
  expect_status 403 "${AUTH_REF[@]}" -X PUT -H 'Content-Type: application/json' \
    -d "{\"name\":\"Fornecedor bloqueado $RUN_ID\",\"document\":\"SUP-$RUN_ID\",\"email\":\"sup-$RUN_ID@example.com\",\"phone\":\"21900000001\"}" \
    "$BASE_URL/suppliers/$SUPPLIER_ID"
done
for role in FINANCEIRO GERENTE; do
  declare -n AUTH_REF="${role}_AUTH"
  curl --fail --silent --show-error "${AUTH_REF[@]}" -X PUT -H 'Content-Type: application/json' \
    -d "{\"name\":\"Fornecedor $role $RUN_ID\",\"document\":\"SUP-$RUN_ID\",\"email\":\"sup-$RUN_ID@example.com\",\"phone\":\"21955550000\"}" \
    "$BASE_URL/suppliers/$SUPPLIER_ID" >/dev/null
done

echo "8) Product query: all five roles can list products"
for role in VENDAS SUPERVISOR ESTOQUE FINANCEIRO GERENTE; do
  declare -n AUTH_REF="${role}_AUTH"
  curl --fail --silent "${AUTH_REF[@]}" "$BASE_URL/products?search=Produto%20Cadastro" > "/tmp/cad-product-$role.json"
  jq -e '.products | length >= 1' "/tmp/cad-product-$role.json" >/dev/null
done

echo "9) Product cost visibility: VENDAS, SUPERVISOR and ESTOQUE must not receive cost"
for role in VENDAS SUPERVISOR ESTOQUE; do
  jq -e '.products | all(.[]; has("cost") | not)' "/tmp/cad-product-$role.json" >/dev/null
done

echo "10) Product cost visibility: FINANCEIRO and GERENTE must receive cost"
for role in FINANCEIRO GERENTE; do
  jq -e '.products | any(.[]; has("cost"))' "/tmp/cad-product-$role.json" >/dev/null
done

echo "11) Product maintenance: VENDAS, SUPERVISOR and ESTOQUE must be denied"
for role in VENDAS SUPERVISOR ESTOQUE; do
  declare -n AUTH_REF="${role}_AUTH"
  expect_status 403 "${AUTH_REF[@]}" -X PUT -H 'Content-Type: application/json' \
    -d "{\"code\":\"CAD-${GITHUB_RUN_ID:-local}\",\"name\":\"Produto bloqueado $RUN_ID\",\"unit\":\"UN\",\"cost\":6,\"salePrice\":12,\"profitMarginPct\":100}" \
    "$BASE_URL/products/$PRODUCT_ID"
done

echo "12) Product maintenance: FINANCEIRO and GERENTE must be allowed"
for role in FINANCEIRO GERENTE; do
  declare -n AUTH_REF="${role}_AUTH"
  curl --fail --silent --show-error "${AUTH_REF[@]}" -X PUT -H 'Content-Type: application/json' \
    -d "{\"code\":\"CAD-${GITHUB_RUN_ID:-local}\",\"name\":\"Produto $role $RUN_ID\",\"unit\":\"UN\",\"cost\":6,\"salePrice\":12,\"profitMarginPct\":100}" \
    "$BASE_URL/products/$PRODUCT_ID" >/dev/null
done

echo "13) Product minimum-stock maintenance follows PRODUCT_MAINTENANCE"
for role in VENDAS SUPERVISOR ESTOQUE; do
  declare -n AUTH_REF="${role}_AUTH"
  expect_status 403 "${AUTH_REF[@]}" -X PUT -H 'Content-Type: application/json' \
    -d '{"minimumQuantity":5}' "$BASE_URL/products/$PRODUCT_ID/minimum-stock"
done
for role in FINANCEIRO GERENTE; do
  declare -n AUTH_REF="${role}_AUTH"
  curl --fail --silent --show-error "${AUTH_REF[@]}" -X PUT -H 'Content-Type: application/json' \
    -d '{"minimumQuantity":5}' "$BASE_URL/products/$PRODUCT_ID/minimum-stock" >/dev/null
done

echo "14) Cadastros authorization matrix PASSED"
printf 'customer=%s supplier=%s product=%s\n' "$CUSTOMER_ID" "$SUPPLIER_ID" "$PRODUCT_ID"
