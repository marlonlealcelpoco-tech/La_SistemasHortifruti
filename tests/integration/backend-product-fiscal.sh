#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
EMAIL="${ADMIN_EMAIL:-admin@example.com}"
PASSWORD="${ADMIN_PASSWORD:-Admin1234}"
STAMP="${GITHUB_RUN_ID:-local}-$(date +%s)"
CODE="FISCAL-${STAMP}"

login() {
  curl --fail --silent --show-error \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" \
    "$BASE_URL/auth/login"
}

request_status() {
  local method="$1" url="$2" body="$3" output="$4"
  curl -sS -o "$output" -w '%{http_code}' \
    -X "$method" \
    -H "Authorization: Bearer $TOKEN" \
    -H 'Content-Type: application/json' \
    -d "$body" \
    "$url"
}

echo "MÓDULO 2 — PRODUTO / ESTRUTURA FISCAL"

echo "1) Login administrativo"
LOGIN_JSON="$(login)"
TOKEN="$(jq -r '.token' <<<"$LOGIN_JSON")"
test -n "$TOKEN" && test "$TOKEN" != "null"

echo "2) Create product with fiscal data"
CREATE_BODY=$(cat <<JSON
{"code":"$CODE","name":"Produto Fiscal CI","unit":"UN","cost":1.25,"salePrice":2.49,"profitMarginPct":99.2,"ncm":"07096000","cest":"1700100","cfop":"5102","taxCodeType":"CST","taxCode":"060","origin":0,"gtin":"7891234567895","gtinTrib":"7891234567895","taxUnit":"UN","icmsRate":18,"pisCst":"01","pisRate":1.65,"cofinsCst":"01","cofinsRate":7.6}
JSON
)
CREATE_STATUS="$(request_status POST "$BASE_URL/products" "$CREATE_BODY" /tmp/product-fiscal-create.json)"
cat /tmp/product-fiscal-create.json
if [ "$CREATE_STATUS" != "201" ]; then
  echo "Create fiscal product failed: HTTP $CREATE_STATUS"
  exit 1
fi
PRODUCT_ID="$(jq -r '.product.id' /tmp/product-fiscal-create.json)"
test "$PRODUCT_ID" != "null"
jq -e '.product.ncm == "07096000" and .product.cest == "1700100" and .product.cfop == "5102" and .product.tax_code_type == "CST" and .product.tax_code == "060" and .product.origin == 0 and .product.gtin == "7891234567895" and .product.icms_rate == "18.0000" and .product.pis_cst == "01" and .product.cofins_cst == "01"' /tmp/product-fiscal-create.json >/dev/null

echo "3) Read fiscal data back from PostgreSQL through API"
curl --fail --silent --show-error \
  -H "Authorization: Bearer $TOKEN" \
  "$BASE_URL/products?search=$CODE" > /tmp/product-fiscal-list.json
cat /tmp/product-fiscal-list.json
jq -e ".products | length == 1 and .[0].ncm == \"07096000\" and .[0].cfop == \"5102\" and .[0].tax_code == \"060\"" /tmp/product-fiscal-list.json >/dev/null

echo "4) Update fiscal data"
UPDATE_BODY=$(cat <<JSON
{"code":"$CODE","name":"Produto Fiscal CI Atualizado","unit":"UN","cost":1.30,"salePrice":2.59,"profitMarginPct":99.23,"ncm":"08051000","cest":"1700200","cfop":"5102","taxCodeType":"CSOSN","taxCode":"102","origin":0,"gtin":"7891234567895","gtinTrib":"7891234567895","taxUnit":"UN","icmsRate":0,"pisCst":"01","pisRate":1.65,"cofinsCst":"01","cofinsRate":7.6}
JSON
)
UPDATE_STATUS="$(request_status PUT "$BASE_URL/products/$PRODUCT_ID" "$UPDATE_BODY" /tmp/product-fiscal-update.json)"
cat /tmp/product-fiscal-update.json
if [ "$UPDATE_STATUS" != "200" ]; then
  echo "Update fiscal product failed: HTTP $UPDATE_STATUS"
  exit 1
fi
jq -e '.product.ncm == "08051000" and .product.tax_code_type == "CSOSN" and .product.tax_code == "102" and .product.cfop == "5102"' /tmp/product-fiscal-update.json >/dev/null

echo "5) Invalid NCM must be rejected"
INVALID_STATUS="$(request_status PUT "$BASE_URL/products/$PRODUCT_ID" "{\"code\":\"$CODE\",\"name\":\"Produto Fiscal CI Atualizado\",\"unit\":\"UN\",\"cost\":1.30,\"salePrice\":2.59,\"profitMarginPct\":99.23,\"ncm\":\"123\"}" /tmp/product-fiscal-invalid.json)"
cat /tmp/product-fiscal-invalid.json
if [ "$INVALID_STATUS" != "400" ]; then
  echo "Invalid NCM was not rejected: HTTP $INVALID_STATUS"
  exit 1
fi

echo "6) CST/CSOSN without tax code must be rejected"
INVALID_TAX_STATUS="$(request_status PUT "$BASE_URL/products/$PRODUCT_ID" "{\"code\":\"$CODE\",\"name\":\"Produto Fiscal CI Atualizado\",\"unit\":\"UN\",\"cost\":1.30,\"salePrice\":2.59,\"profitMarginPct\":99.23,\"taxCodeType\":\"CST\"}" /tmp/product-fiscal-invalid-tax.json)"
cat /tmp/product-fiscal-invalid-tax.json
if [ "$INVALID_TAX_STATUS" != "400" ]; then
  echo "Missing tax code was not rejected: HTTP $INVALID_TAX_STATUS"
  exit 1
fi

echo "Produto fiscal: testes passaram."
