#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
EMAIL="${ADMIN_EMAIL:-admin@example.com}"
PASSWORD="${ADMIN_PASSWORD:-Admin1234}"
BOOTSTRAP_TOKEN="${BOOTSTRAP_TOKEN:?BOOTSTRAP_TOKEN must be set}"
RUN_ID="${GITHUB_RUN_ID:-local}-$(date +%s%N)"

json() { jq -r "$1"; }
expect_status() {
  local expected="$1"; shift
  local body_file="/tmp/erp-comprehensive-response.json"
  local status
  status=$(curl -sS -o "$body_file" -w '%{http_code}' "$@" || true)
  echo "HTTP $status"
  cat "$body_file"
  test "$status" = "$expected"
}

# Authentication and authorization boundaries
echo "1) Unauthenticated protected endpoint must be rejected"
expect_status 401 "$BASE_URL/products"

echo "2) Login"
curl --fail --silent --show-error -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" \
  "$BASE_URL/auth/login" > /tmp/erp-comprehensive-login.json
TOKEN=$(json '.token' < /tmp/erp-comprehensive-login.json)
ADMIN_ID=$(json '.user.id' < /tmp/erp-comprehensive-login.json)
AUTH=(-H "Authorization: Bearer $TOKEN")
test -n "$TOKEN" && test "$TOKEN" != "null"

# User administration
echo "3) List users"
curl --fail --silent "${AUTH[@]}" "$BASE_URL/users" > /tmp/erp-users.json
jq -e '.users | length >= 1' /tmp/erp-users.json >/dev/null

echo "4) Create VENDAS user"
USER_EMAIL="e2e-vendas-${RUN_ID}@example.com"
curl --fail --silent --show-error "${AUTH[@]}" -H 'Content-Type: application/json' \
  -d "{\"name\":\"E2E Vendedor\",\"email\":\"$USER_EMAIL\",\"password\":\"Vendas1234\",\"roles\":[\"VENDAS\"]}" \
  "$BASE_URL/users" > /tmp/erp-user-created.json
VENDOR_ID=$(json '.user.id' < /tmp/erp-user-created.json)
test "$VENDOR_ID" != "null"

echo "5) Replace user roles"
curl --fail --silent "${AUTH[@]}" -X PUT -H 'Content-Type: application/json' \
  -d '{"roles":["VENDAS","SUPERVISOR"]}' "$BASE_URL/users/$VENDOR_ID/roles" > /tmp/erp-user-roles.json
jq -e '.user.roles | index("SUPERVISOR") != null' /tmp/erp-user-roles.json >/dev/null

echo "6) Restore user role to VENDAS"
curl --fail --silent "${AUTH[@]}" -X PUT -H 'Content-Type: application/json' \
  -d '{"roles":["VENDAS"]}' "$BASE_URL/users/$VENDOR_ID/roles" >/dev/null

# Customers
echo "7) Customer CRUD/search/status"
CUSTOMER_EMAIL="cliente-${RUN_ID}@example.com"
curl --fail --silent --show-error "${AUTH[@]}" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Cliente E2E $RUN_ID\",\"document\":\"CLI-$RUN_ID\",\"email\":\"$CUSTOMER_EMAIL\",\"phone\":\"21988888888\"}" \
  "$BASE_URL/customers" > /tmp/erp-customer.json
CUSTOMER_ID=$(json '.customer.id' < /tmp/erp-customer.json)
test "$CUSTOMER_ID" != "null"
curl --fail --silent "${AUTH[@]}" "$BASE_URL/customers?search=Cliente%20E2E" > /tmp/erp-customers.json
jq -e '.customers | length >= 1' /tmp/erp-customers.json >/dev/null
curl --fail --silent "${AUTH[@]}" -X PUT -H 'Content-Type: application/json' \
  -d "{\"name\":\"Cliente E2E Atualizado $RUN_ID\",\"document\":\"CLI-$RUN_ID\",\"email\":\"$CUSTOMER_EMAIL\",\"phone\":\"21977777777\"}" \
  "$BASE_URL/customers/$CUSTOMER_ID" > /tmp/erp-customer-updated.json
jq -e '.customer.phone == "21977777777"' /tmp/erp-customer-updated.json >/dev/null
curl --fail --silent "${AUTH[@]}" -X PATCH -H 'Content-Type: application/json' \
  -d '{"active":false}' "$BASE_URL/customers/$CUSTOMER_ID/status" > /tmp/erp-customer-inactive.json
jq -e '.customer.active == false' /tmp/erp-customer-inactive.json >/dev/null
curl --fail --silent "${AUTH[@]}" -X PATCH -H 'Content-Type: application/json' \
  -d '{"active":true}' "$BASE_URL/customers/$CUSTOMER_ID/status" >/dev/null

# Supplier CRUD/search/status
echo "8) Supplier CRUD/search/status"
SUPPLIER_EMAIL="supplier-${RUN_ID}@example.com"
curl --fail --silent --show-error "${AUTH[@]}" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Fornecedor Completo $RUN_ID\",\"document\":\"SUP-$RUN_ID\",\"email\":\"$SUPPLIER_EMAIL\",\"phone\":\"21966666666\"}" \
  "$BASE_URL/suppliers" > /tmp/erp-supplier-comprehensive.json
SUPPLIER_ID=$(json '.supplier.id' < /tmp/erp-supplier-comprehensive.json)
test "$SUPPLIER_ID" != "null"
curl --fail --silent "${AUTH[@]}" "$BASE_URL/suppliers?search=Fornecedor%20Completo" > /tmp/erp-suppliers.json
jq -e '.suppliers | length >= 1' /tmp/erp-suppliers.json >/dev/null
curl --fail --silent "${AUTH[@]}" -X PUT -H 'Content-Type: application/json' \
  -d "{\"name\":\"Fornecedor Completo Atualizado $RUN_ID\",\"document\":\"SUP-$RUN_ID\",\"email\":\"$SUPPLIER_EMAIL\",\"phone\":\"21955555555\"}" \
  "$BASE_URL/suppliers/$SUPPLIER_ID" >/tmp/erp-supplier-updated.json
curl --fail --silent "${AUTH[@]}" -X PATCH -H 'Content-Type: application/json' \
  -d '{"active":false}' "$BASE_URL/suppliers/$SUPPLIER_ID/status" >/dev/null
curl --fail --silent "${AUTH[@]}" -X PATCH -H 'Content-Type: application/json' \
  -d '{"active":true}' "$BASE_URL/suppliers/$SUPPLIER_ID/status" >/dev/null

# Product maintenance
echo "9) Product list/update/status/minimum-stock"
PRODUCT_CODE="COMP-${RUN_ID:0:20}"
curl --fail --silent --show-error "${AUTH[@]}" -H 'Content-Type: application/json' \
  -d "{\"code\":\"$PRODUCT_CODE\",\"name\":\"Produto Completo $RUN_ID\",\"unit\":\"UN\",\"cost\":5,\"salePrice\":10,\"profitMarginPct\":100}" \
  "$BASE_URL/products" > /tmp/erp-product-comprehensive.json
PRODUCT_ID=$(json '.product.id' < /tmp/erp-product-comprehensive.json)
test "$PRODUCT_ID" != "null"
curl --fail --silent "${AUTH[@]}" "$BASE_URL/products?search=Produto%20Completo" > /tmp/erp-product-list.json
jq -e '.products | length >= 1' /tmp/erp-product-list.json >/dev/null
curl --fail --silent "${AUTH[@]}" -X PUT -H 'Content-Type: application/json' \
  -d "{\"code\":\"$PRODUCT_CODE\",\"name\":\"Produto Completo Atualizado $RUN_ID\",\"unit\":\"KG\",\"cost\":6,\"salePrice\":12,\"profitMarginPct\":100}" \
  "$BASE_URL/products/$PRODUCT_ID" > /tmp/erp-product-updated.json
jq -e '.product.unit == "KG" and (.product.sale_price | tonumber) == 12' /tmp/erp-product-updated.json >/dev/null
curl --fail --silent "${AUTH[@]}" -X PUT -H 'Content-Type: application/json' \
  -d '{"minimumQuantity":3}' "$BASE_URL/products/$PRODUCT_ID/minimum-stock" > /tmp/erp-minimum.json
jq -e '(.product.minimum_quantity | tonumber) == 3' /tmp/erp-minimum.json >/dev/null
curl --fail --silent "${AUTH[@]}" -X PATCH -H 'Content-Type: application/json' \
  -d '{"active":false}' "$BASE_URL/products/$PRODUCT_ID/status" >/dev/null
curl --fail --silent "${AUTH[@]}" -X PATCH -H 'Content-Type: application/json' \
  -d '{"active":true}' "$BASE_URL/products/$PRODUCT_ID/status" >/dev/null

# Inventory movements
echo "10) Inventory movement, insufficient stock and history"
curl --fail --silent --show-error "${AUTH[@]}" -H 'Content-Type: application/json' \
  -d "{\"productId\":$PRODUCT_ID,\"type\":\"ADJUSTMENT\",\"quantity\":10,\"reference\":\"E2E-ADJ\",\"notes\":\"Entrada de teste\"}" \
  "$BASE_URL/inventory/movements" > /tmp/erp-inventory-in.json
jq -e '(.quantity | tonumber) == 10' /tmp/erp-inventory-in.json >/dev/null
curl --fail --silent --show-error "${AUTH[@]}" -H 'Content-Type: application/json' \
  -d "{\"productId\":$PRODUCT_ID,\"type\":\"DAMAGE\",\"quantity\":2,\"notes\":\"Avaria E2E\"}" \
  "$BASE_URL/inventory/movements" >/tmp/erp-inventory-damage.json
jq -e '(.quantity | tonumber) == 8' /tmp/erp-inventory-damage.json >/dev/null
expect_status 409 "${AUTH[@]}" -H 'Content-Type: application/json' -d "{\"productId\":$PRODUCT_ID,\"type\":\"EXIT\",\"quantity\":999}" "$BASE_URL/inventory/movements"
curl --fail --silent "${AUTH[@]}" "$BASE_URL/products/$PRODUCT_ID/movements" > /tmp/erp-movements.json
jq -e '.movements | length >= 2' /tmp/erp-movements.json >/dev/null

# Purchase validation and XML parser error path
echo "11) Purchase validation and XML error path"
expect_status 400 "${AUTH[@]}" -H 'Content-Type: application/json' -d '{"xml":"not-valid-xml-12345678901234567890"}' "$BASE_URL/purchases/xml/preview"
expect_status 400 "${AUTH[@]}" -H 'Content-Type: application/json' -d '{"xml":"not-valid-xml-12345678901234567890","supplierId":1,"items":[]}' "$BASE_URL/purchases/import-xml"

# Cash report endpoints using the closed session created by the main battery
echo "12) Cash report endpoints"
TODAY=$(date +%F)
curl --fail --silent "${AUTH[@]}" "$BASE_URL/cash-reports/daily?date=$TODAY" > /tmp/erp-daily-cash.json
jq -e '.consolidated.expectedCash >= 0' /tmp/erp-daily-cash.json >/dev/null

# Sale schema validation: credit requires customer/due date, and totals must balance
echo "13) Sales validation rules"
# Use an impossible session ID: schema validation happens before repository access for malformed payloads.
expect_status 400 "${AUTH[@]}" -H 'Content-Type: application/json' \
  -d '{"cashSessionId":1,"items":[{"productId":1,"quantity":1,"unitPrice":10}],"payments":[{"paymentMethod":"CREDIT","amount":10}]}' \
  "$BASE_URL/sales"
expect_status 400 "${AUTH[@]}" -H 'Content-Type: application/json' \
  -d '{"cashSessionId":1,"items":[{"productId":1,"quantity":1,"unitPrice":10}],"payments":[{"paymentMethod":"CASH","amount":9}]}' \
  "$BASE_URL/sales"

# Self-protection rules
echo "14) Admin self-modification protections"
expect_status 400 "${AUTH[@]}" -X PUT -H 'Content-Type: application/json' \
  -d '{"roles":["ADMIN"]}' "$BASE_URL/users/$ADMIN_ID/roles"
expect_status 400 "${AUTH[@]}" -X PATCH -H 'Content-Type: application/json' \
  -d '{"active":false}' "$BASE_URL/users/$ADMIN_ID/status"

# Cleanup: deactivate temporary user without deleting production data.
echo "15) Deactivate temporary test user"
curl --fail --silent "${AUTH[@]}" -X PATCH -H 'Content-Type: application/json' \
  -d '{"active":false}' "$BASE_URL/users/$VENDOR_ID/status" >/dev/null

printf '\nCOMPREHENSIVE BACKEND API BATTERY PASSED.\n'
printf 'customer=%s supplier=%s product=%s temporary_user=%s\n' "$CUSTOMER_ID" "$SUPPLIER_ID" "$PRODUCT_ID" "$VENDOR_ID"
