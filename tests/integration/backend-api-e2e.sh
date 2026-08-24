#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
EMAIL="${ADMIN_EMAIL:-admin@example.com}"
PASSWORD="${ADMIN_PASSWORD:-Admin1234}"
BOOTSTRAP_TOKEN="${BOOTSTRAP_TOKEN:?BOOTSTRAP_TOKEN must be set}"
RUN_ID="${GITHUB_RUN_ID:-local}-$(date +%s%N)"
PRODUCT_CODE="E2E-${RUN_ID:0:20}"
PRODUCT_NAME="Produto Integração E2E ${RUN_ID:0:12}"
SUPPLIER_DOC="E2E-${RUN_ID:0:20}"

api() { curl -sS --fail-with-body "$@"; }
json() { jq -r "$1"; }
num() { awk '{print $1+0}' <<< "$1"; }

echo "1) Health check"
api "$BASE_URL/health" | tee /tmp/erp-health.json
jq -e '.status == "ok"' /tmp/erp-health.json >/dev/null

echo "2) Verify/bootstrap administrator"
SETUP_STATUS=$(curl -sS -o /tmp/erp-setup.json -w '%{http_code}' -H 'Content-Type: application/json' -d "{\"name\":\"Integration Admin\",\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"bootstrapToken\":\"$BOOTSTRAP_TOKEN\"}" "$BASE_URL/auth/setup" || true)
cat /tmp/erp-setup.json
[[ "$SETUP_STATUS" == "200" || "$SETUP_STATUS" == "201" || "$SETUP_STATUS" == "409" ]]

echo "3) Login"
api -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" "$BASE_URL/auth/login" > /tmp/erp-login.json
cat /tmp/erp-login.json
AUTH_TOKEN=$(json '.token' < /tmp/erp-login.json)
test -n "$AUTH_TOKEN" && test "$AUTH_TOKEN" != "null"
AUTH=(-H "Authorization: Bearer $AUTH_TOKEN")
ADMIN_USER_ID=$(json '.user.id' < /tmp/erp-login.json)
test "$ADMIN_USER_ID" != "null"

echo "4) Create supplier"
SUPPLIER_STATUS=$(curl -sS -o /tmp/erp-supplier.json -w '%{http_code}' "${AUTH[@]}" -H 'Content-Type: application/json' -d "{\"name\":\"Fornecedor Integração E2E $RUN_ID\",\"document\":\"$SUPPLIER_DOC\",\"email\":\"fornecedor-e2e-$RUN_ID@example.com\",\"phone\":\"21999999999\"}" "$BASE_URL/suppliers" || true)
cat /tmp/erp-supplier.json
echo "Supplier HTTP status: $SUPPLIER_STATUS"
if [[ "$SUPPLIER_STATUS" != "200" && "$SUPPLIER_STATUS" != "201" ]]; then exit 1; fi
SUPPLIER_ID=$(json '.supplier.id' < /tmp/erp-supplier.json)
test "$SUPPLIER_ID" != "null"

echo "5) Create product"
PRODUCT_STATUS=$(curl -sS -o /tmp/erp-product.json -w '%{http_code}' "${AUTH[@]}" -H 'Content-Type: application/json' -d "{\"code\":\"$PRODUCT_CODE\",\"name\":\"$PRODUCT_NAME\",\"unit\":\"UN\",\"cost\":8,\"salePrice\":12,\"profitMarginPct\":50}" "$BASE_URL/products" || true)
cat /tmp/erp-product.json
echo "Product HTTP status: $PRODUCT_STATUS"
if [[ "$PRODUCT_STATUS" != "201" ]]; then echo "Create product failed; response above is the actual backend error."; exit 1; fi
PRODUCT_ID=$(json '.product.id' < /tmp/erp-product.json)
test "$PRODUCT_ID" != "null"
jq -e '(.product.quantity | tonumber) == 0' /tmp/erp-product.json >/dev/null

echo '6) Create purchase draft: 10 units at R$8'
api "${AUTH[@]}" -H 'Content-Type: application/json' -d "{\"supplierId\":$SUPPLIER_ID,\"items\":[{\"productId\":$PRODUCT_ID,\"quantity\":10,\"unitCost\":8}]}" "$BASE_URL/purchases" > /tmp/erp-purchase.json
cat /tmp/erp-purchase.json
PURCHASE_ID=$(json '.purchase.id' < /tmp/erp-purchase.json)
test "$PURCHASE_ID" != "null"
jq -e '.purchase.status == "DRAFT" and (.purchase.total | tonumber) == 80' /tmp/erp-purchase.json >/dev/null
PURCHASE_ITEM_ID=$(json '.items[0].id' < /tmp/erp-purchase.json)
test "$PURCHASE_ITEM_ID" != "null"

echo "7) Confirm purchase and enter stock"
api "${AUTH[@]}" -H 'Content-Type: application/json' -d '{"salePriceUpdates":[]}' "$BASE_URL/purchases/$PURCHASE_ID/confirm" > /tmp/erp-purchase-confirm.json
cat /tmp/erp-purchase-confirm.json
jq -e '.purchase.status == "CONFIRMED"' /tmp/erp-purchase-confirm.json >/dev/null
STOCK_AFTER_PURCHASE=$(psql "$DATABASE_URL" -tAc "SELECT quantity FROM stock WHERE product_id = $PRODUCT_ID;" | xargs)
COST_AFTER_PURCHASE=$(psql "$DATABASE_URL" -tAc "SELECT cost FROM products WHERE id = $PRODUCT_ID;" | xargs)
[[ "$(num "$STOCK_AFTER_PURCHASE")" == "10" ]]
[[ "$(num "$COST_AFTER_PURCHASE")" == "8" ]]
PAYABLE_COUNT=$(psql "$DATABASE_URL" -tAc "SELECT COUNT(*) FROM financial_entries WHERE purchase_id = $PURCHASE_ID AND type = 'PAYABLE';" | xargs)
test "$PAYABLE_COUNT" = "1"

echo '8) Open cash with R$100 for the authenticated admin seller'
api "${AUTH[@]}" -H 'Content-Type: application/json' -d "{\"terminalId\":\"E2E-TERMINAL\",\"openingAmount\":100,\"sellerId\":$ADMIN_USER_ID}" "$BASE_URL/cash-sessions" > /tmp/erp-cash-open.json
cat /tmp/erp-cash-open.json
CASH_SESSION_ID=$(json '.cashSession.id' < /tmp/erp-cash-open.json)
test "$CASH_SESSION_ID" != "null"

echo '9) Sell 6 units for R$12 each = R$72 cash'
SALE_STATUS=$(curl -sS -o /tmp/erp-sale.json -w '%{http_code}' "${AUTH[@]}" -H 'Content-Type: application/json' -d "{\"cashSessionId\":$CASH_SESSION_ID,\"items\":[{\"productId\":$PRODUCT_ID,\"quantity\":6,\"unitPrice\":12}],\"payments\":[{\"paymentMethod\":\"CASH\",\"amount\":72}]}" "$BASE_URL/sales" || true)
cat /tmp/erp-sale.json
echo "Sale HTTP status: $SALE_STATUS"
if [[ "$SALE_STATUS" != "200" && "$SALE_STATUS" != "201" ]]; then echo "Create sale failed; response above is the actual backend error."; exit 1; fi
SALE_ID=$(json '.sale.id' < /tmp/erp-sale.json)
test "$SALE_ID" != "null"
STOCK_AFTER_SALE=$(psql "$DATABASE_URL" -tAc "SELECT quantity FROM stock WHERE product_id = $PRODUCT_ID;" | xargs)
[[ "$(num "$STOCK_AFTER_SALE")" == "4" ]]
SALE_EVENT_COUNT=$(psql "$DATABASE_URL" -tAc "SELECT COUNT(*) FROM cash_events WHERE cash_session_id = $CASH_SESSION_ID AND sale_id = $SALE_ID AND type = 'SALE_PAYMENT';" | xargs)
test "$SALE_EVENT_COUNT" = "1"

echo '10) Cancel sale as supervisor/admin and restore stock/cash'
api "${AUTH[@]}" -X POST "$BASE_URL/sales/$SALE_ID/cancel" > /tmp/erp-sale-cancel.json
cat /tmp/erp-sale-cancel.json
jq -e '.sale.status == "CANCELLED"' /tmp/erp-sale-cancel.json >/dev/null
STOCK_AFTER_CANCEL=$(psql "$DATABASE_URL" -tAc "SELECT quantity FROM stock WHERE product_id = $PRODUCT_ID;" | xargs)
[[ "$(num "$STOCK_AFTER_CANCEL")" == "10" ]]
CANCELLATION_EVENT_COUNT=$(psql "$DATABASE_URL" -tAc "SELECT COUNT(*) FROM cash_events WHERE cash_session_id = $CASH_SESSION_ID AND sale_id = $SALE_ID AND type = 'CANCELLATION';" | xargs)
test "$CANCELLATION_EVENT_COUNT" = "1"

echo '11) Close cash at opening amount R$100'
api "${AUTH[@]}" -H 'Content-Type: application/json' -d '{"closingAmount":100}' "$BASE_URL/cash-sessions/$CASH_SESSION_ID/close" > /tmp/erp-cash-close.json
cat /tmp/erp-cash-close.json
jq -e '.report.totals.expectedCash == 100 or (.report.totals.expectedCash | tonumber) == 100' /tmp/erp-cash-close.json >/dev/null
CASH_STATUS=$(psql "$DATABASE_URL" -tAc "SELECT status FROM cash_sessions WHERE id = $CASH_SESSION_ID;" | xargs)
test "$CASH_STATUS" = "CLOSED"

echo "12) Final financial/stock invariants"
PAYABLE_COUNT=$(psql "$DATABASE_URL" -tAc "SELECT COUNT(*) FROM financial_entries WHERE purchase_id = $PURCHASE_ID AND type = 'PAYABLE';" | xargs)
test "$PAYABLE_COUNT" = "1"
RECEIVABLE_COUNT=$(psql "$DATABASE_URL" -tAc "SELECT COUNT(*) FROM financial_entries WHERE sale_id = $SALE_ID AND type = 'RECEIVABLE';" | xargs)
test "$RECEIVABLE_COUNT" = "0"

printf '\nERP real API integration battery PASSED.\n'
printf 'purchase=%s product=%s sale=%s cash_session=%s stock_final=%s\n' "$PURCHASE_ID" "$PRODUCT_ID" "$SALE_ID" "$CASH_SESSION_ID" "$STOCK_AFTER_CANCEL"
