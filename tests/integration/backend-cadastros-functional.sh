#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
RUN_ID="${GITHUB_RUN_ID:-local}"
KEY="${RUN_ID:0:20}"
AUTH=""

login_admin() {
  local out=/tmp/cad-functional-login.json
  curl --fail --silent --show-error \
    -H 'Content-Type: application/json' \
    -d '{"email":"admin@example.com","password":"Admin1234"}' \
    "$BASE_URL/auth/login" > "$out"
  local token
  token=$(jq -r '.token' "$out")
  test -n "$token" && test "$token" != "null"
  AUTH="$token"
}

request_status() {
  local expected="$1" out="$2"; shift 2
  local status
  status=$(curl -sS -o "$out" -w '%{http_code}' "$@" || true)
  echo "HTTP $status"
  cat "$out"
  test "$status" = "$expected"
}

expect_400() {
  local out=/tmp/cad-functional-400.json
  request_status 400 "$out" "$@"
}

login_admin

echo "MÓDULO 2 — CADASTROS / FUNCIONALIDADES COMPLETAS"

echo "1) CLIENTE — criação com todos os campos"
CUSTOMER_DOC="FUNC-C-${KEY}"
CUSTOMER_EMAIL="cliente-${KEY}@example.com"
request_status 201 /tmp/cad-functional-customer.json \
  -X POST -H "Authorization: Bearer $AUTH" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Cliente Funcional $KEY\",\"document\":\"$CUSTOMER_DOC\",\"email\":\"$CUSTOMER_EMAIL\",\"phone\":\"21988881111\"}" \
  "$BASE_URL/customers"
CUSTOMER_ID=$(jq -r '.customer.id' /tmp/cad-functional-customer.json)
test "$CUSTOMER_ID" != "null"
jq -e '.customer.name == "Cliente Funcional '"$KEY"'" and .customer.document == "'"$CUSTOMER_DOC"'" and .customer.email == "'"$CUSTOMER_EMAIL"'" and .customer.phone == "21988881111" and .customer.active == true' /tmp/cad-functional-customer.json >/dev/null

echo "2) CLIENTE — listagem sem filtro"
curl --fail --silent -H "Authorization: Bearer $AUTH" "$BASE_URL/customers" > /tmp/cad-functional-customers.json
jq -e --arg id "$CUSTOMER_ID" '.customers | any(.[]; (.id|tostring) == $id)' /tmp/cad-functional-customers.json >/dev/null

echo "3) CLIENTE — pesquisa por nome, documento e e-mail"
for term in "Cliente%20Funcional" "$CUSTOMER_DOC" "$CUSTOMER_EMAIL"; do
  curl --fail --silent -H "Authorization: Bearer $AUTH" "$BASE_URL/customers?search=$term" > /tmp/cad-functional-customer-search.json
  jq -e --arg id "$CUSTOMER_ID" '.customers | any(.[]; (.id|tostring) == $id)' /tmp/cad-functional-customer-search.json >/dev/null
done

echo "4) CLIENTE — edição de todos os campos"
curl --fail --silent --show-error -X PUT -H "Authorization: Bearer $AUTH" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Cliente Funcional Atualizado $KEY\",\"document\":\"$CUSTOMER_DOC-2\",\"email\":\"cliente-atualizado-${KEY}@example.com\",\"phone\":\"21977772222\"}" \
  "$BASE_URL/customers/$CUSTOMER_ID" > /tmp/cad-functional-customer-update.json
jq -e '.customer.name | startswith("Cliente Funcional Atualizado")' /tmp/cad-functional-customer-update.json >/dev/null
jq -e '.customer.document != null and .customer.email != null and .customer.phone == "21977772222"' /tmp/cad-functional-customer-update.json >/dev/null

echo "5) CLIENTE — desativar e reativar"
for active in false true; do
  curl --fail --silent --show-error -X PATCH -H "Authorization: Bearer $AUTH" -H 'Content-Type: application/json' \
    -d "{\"active\":$active}" "$BASE_URL/customers/$CUSTOMER_ID/status" > /tmp/cad-functional-customer-status.json
  jq -e --argjson expected "$active" '.customer.active == $expected' /tmp/cad-functional-customer-status.json >/dev/null
done

echo "6) CLIENTE — validações"
expect_400 -X POST -H "Authorization: Bearer $AUTH" -H 'Content-Type: application/json' \
  -d '{"name":"X","document":"CAD-INVALID","email":"email-invalido","phone":"21900000000"}' "$BASE_URL/customers"
expect_400 -X POST -H "Authorization: Bearer $AUTH" -H 'Content-Type: application/json' \
  -d '{"name":"Cliente sem nome","email":"cliente-validacao@example.com"}' "$BASE_URL/customers" >/dev/null

echo "7) FORNECEDOR — criação com todos os campos"
SUPPLIER_DOC="FUNC-S-${KEY}"
SUPPLIER_EMAIL="fornecedor-${KEY}@example.com"
request_status 201 /tmp/cad-functional-supplier.json \
  -X POST -H "Authorization: Bearer $AUTH" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Fornecedor Funcional $KEY\",\"document\":\"$SUPPLIER_DOC\",\"email\":\"$SUPPLIER_EMAIL\",\"phone\":\"21988883333\"}" \
  "$BASE_URL/suppliers"
SUPPLIER_ID=$(jq -r '.supplier.id' /tmp/cad-functional-supplier.json)
test "$SUPPLIER_ID" != "null"
jq -e '.supplier.active == true and .supplier.email == "'"$SUPPLIER_EMAIL"'"' /tmp/cad-functional-supplier.json >/dev/null

echo "8) FORNECEDOR — listagem e pesquisas"
curl --fail --silent -H "Authorization: Bearer $AUTH" "$BASE_URL/suppliers" > /tmp/cad-functional-suppliers.json
jq -e --arg id "$SUPPLIER_ID" '.suppliers | any(.[]; (.id|tostring) == $id)' /tmp/cad-functional-suppliers.json >/dev/null
for term in "Fornecedor%20Funcional" "$SUPPLIER_DOC" "$SUPPLIER_EMAIL"; do
  curl --fail --silent -H "Authorization: Bearer $AUTH" "$BASE_URL/suppliers?search=$term" > /tmp/cad-functional-supplier-search.json
  jq -e --arg id "$SUPPLIER_ID" '.suppliers | any(.[]; (.id|tostring) == $id)' /tmp/cad-functional-supplier-search.json >/dev/null
done

echo "9) FORNECEDOR — edição e status"
curl --fail --silent --show-error -X PUT -H "Authorization: Bearer $AUTH" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Fornecedor Funcional Atualizado $KEY\",\"document\":\"$SUPPLIER_DOC-2\",\"email\":\"fornecedor-atualizado-${KEY}@example.com\",\"phone\":\"21966664444\"}" \
  "$BASE_URL/suppliers/$SUPPLIER_ID" > /tmp/cad-functional-supplier-update.json
jq -e '.supplier.name | startswith("Fornecedor Funcional Atualizado")' /tmp/cad-functional-supplier-update.json >/dev/null
for active in false true; do
  curl --fail --silent --show-error -X PATCH -H "Authorization: Bearer $AUTH" -H 'Content-Type: application/json' \
    -d "{\"active\":$active}" "$BASE_URL/suppliers/$SUPPLIER_ID/status" > /tmp/cad-functional-supplier-status.json
  jq -e --argjson expected "$active" '.supplier.active == $expected' /tmp/cad-functional-supplier-status.json >/dev/null
done

echo "10) FORNECEDOR — validações"
expect_400 -X POST -H "Authorization: Bearer $AUTH" -H 'Content-Type: application/json' \
  -d '{"name":"Fornecedor validação","email":"email-invalido"}' "$BASE_URL/suppliers"

echo "11) PRODUTO — criação comercial + fiscal + estoque"
PRODUCT_CODE="FUNC-P-${KEY}"
PRODUCT_JSON="{\"code\":\"$PRODUCT_CODE\",\"name\":\"Produto Funcional $KEY\",\"description\":\"Produto completo para teste\",\"unit\":\"UN\",\"cost\":8.5,\"salePrice\":12.75,\"profitMarginPct\":50,\"ncm\":\"07020000\",\"cest\":\"1700100\",\"cfop\":\"5102\",\"taxCodeType\":\"CST\",\"taxCode\":\"00\",\"origin\":0,\"gtin\":\"7891234567890\",\"gtinTrib\":\"7891234567890\",\"taxUnit\":\"UN\",\"icmsRate\":18,\"pisCst\":\"01\",\"pisRate\":1.65,\"cofinsCst\":\"01\",\"cofinsRate\":7.6}"
request_status 201 /tmp/cad-functional-product.json \
  -X POST -H "Authorization: Bearer $AUTH" -H 'Content-Type: application/json' \
  -d "$PRODUCT_JSON" "$BASE_URL/products"
PRODUCT_ID=$(jq -r '.product.id' /tmp/cad-functional-product.json)
test "$PRODUCT_ID" != "null"
jq -e '.product.code == "'"$PRODUCT_CODE"'" and .product.cost == "8.50" and .product.sale_price == "12.75" and .product.ncm == "07020000" and .product.cest == "1700100" and .product.cfop == "5102" and .product.gtin == "7891234567890" and .product.minimum_quantity == "0.000"' /tmp/cad-functional-product.json >/dev/null

echo "12) PRODUTO — listagem e pesquisa por código/nome"
curl --fail --silent -H "Authorization: Bearer $AUTH" "$BASE_URL/products" > /tmp/cad-functional-products.json
jq -e --arg id "$PRODUCT_ID" '.products | any(.[]; (.id|tostring) == $id)' /tmp/cad-functional-products.json >/dev/null
for term in "$PRODUCT_CODE" "Produto%20Funcional"; do
  curl --fail --silent -H "Authorization: Bearer $AUTH" "$BASE_URL/products?search=$term" > /tmp/cad-functional-product-search.json
  jq -e --arg id "$PRODUCT_ID" '.products | any(.[]; (.id|tostring) == $id)' /tmp/cad-functional-product-search.json >/dev/null
done

echo "13) PRODUTO — edição comercial e fiscal"
PRODUCT_JSON="{\"code\":\"$PRODUCT_CODE\",\"name\":\"Produto Funcional $KEY\",\"description\":\"Produto completo para teste atualizado\",\"unit\":\"UN\",\"cost\":9.25,\"salePrice\":14.50,\"profitMarginPct\":56.76,\"ncm\":\"08081000\",\"cest\":\"1700200\",\"cfop\":\"5101\",\"taxCodeType\":\"CST\",\"taxCode\":\"00\",\"origin\":0,\"gtin\":\"7891234567891\",\"gtinTrib\":\"7891234567891\",\"taxUnit\":\"UN\",\"icmsRate\":18,\"pisCst\":\"01\",\"pisRate\":1.65,\"cofinsCst\":\"01\",\"cofinsRate\":7.6}"
curl --fail --silent --show-error -X PUT -H "Authorization: Bearer $AUTH" -H 'Content-Type: application/json' \
  -d "$PRODUCT_JSON" "$BASE_URL/products/$PRODUCT_ID" > /tmp/cad-functional-product-update.json
jq -e '.product.name | startswith("Produto Funcional")' /tmp/cad-functional-product-update.json >/dev/null
jq -e '.product.cost == "9.25" and .product.sale_price == "14.50" and .product.ncm == "08081000" and .product.cfop == "5101"' /tmp/cad-functional-product-update.json >/dev/null

echo "14) PRODUTO — ativar/desativar"
for active in false true; do
  curl --fail --silent --show-error -X PATCH -H "Authorization: Bearer $AUTH" -H 'Content-Type: application/json' \
    -d "{\"active\":$active}" "$BASE_URL/products/$PRODUCT_ID/status" > /tmp/cad-functional-product-status.json
  jq -e --argjson expected "$active" '.product.active == $expected' /tmp/cad-functional-product-status.json >/dev/null
done

echo "15) PRODUTO — estoque mínimo"
curl --fail --silent --show-error -X PUT -H "Authorization: Bearer $AUTH" -H 'Content-Type: application/json' \
  -d '{"minimumQuantity":7.5}' "$BASE_URL/products/$PRODUCT_ID/minimum-stock" > /tmp/cad-functional-minimum.json
jq -e '.product.minimum_quantity == "7.500"' /tmp/cad-functional-minimum.json >/dev/null

echo "16) PRODUTO — validações fiscais e comerciais"
expect_400 -X POST -H "Authorization: Bearer $AUTH" -H 'Content-Type: application/json' \
  -d '{"code":"FUNC-INVALID-NCM","name":"Produto inválido","unit":"UN","cost":1,"salePrice":2,"profitMarginPct":100,"ncm":"123"}' "$BASE_URL/products"
expect_400 -X POST -H "Authorization: Bearer $AUTH" -H 'Content-Type: application/json' \
  -d '{"code":"FUNC-INVALID-CEST","name":"Produto inválido","unit":"UN","cost":1,"salePrice":2,"profitMarginPct":100,"cest":"123"}' "$BASE_URL/products"
expect_400 -X POST -H "Authorization: Bearer $AUTH" -H 'Content-Type: application/json' \
  -d '{"code":"FUNC-INVALID-CFOP","name":"Produto inválido","unit":"UN","cost":1,"salePrice":2,"profitMarginPct":100,"cfop":"12"}' "$BASE_URL/products"
expect_400 -X POST -H "Authorization: Bearer $AUTH" -H 'Content-Type: application/json' \
  -d '{"code":"FUNC-INVALID-GTIN","name":"Produto inválido","unit":"UN","cost":1,"salePrice":2,"profitMarginPct":100,"gtin":"123"}' "$BASE_URL/products"
expect_400 -X POST -H "Authorization: Bearer $AUTH" -H 'Content-Type: application/json' \
  -d '{"code":"FUNC-INVALID-TAX","name":"Produto inválido","unit":"UN","cost":1,"salePrice":2,"profitMarginPct":100,"taxCodeType":"CST"}' "$BASE_URL/products"

echo "17) PRODUTO — produto inexistente retorna 404"
expect_404=/tmp/cad-functional-404.json
request_status 404 "$expect_404" -X PUT -H "Authorization: Bearer $AUTH" -H 'Content-Type: application/json' \
  -d '{"code":"NAO-EXISTE","name":"Produto inexistente","unit":"UN","cost":1,"salePrice":2,"profitMarginPct":100}' "$BASE_URL/products/999999999"

echo "18) CADASTROS FUNCIONAIS — PASSED"
printf 'customer=%s supplier=%s product=%s\n' "$CUSTOMER_ID" "$SUPPLIER_ID" "$PRODUCT_ID"
