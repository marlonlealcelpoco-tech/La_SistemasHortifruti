#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
RUN_ID="${GITHUB_RUN_ID:-local}"
KEY="${RUN_ID:0:20}"

login_admin() {
  local out=/tmp/clientes-functional-login.json
  curl --fail --silent --show-error \
    -H 'Content-Type: application/json' \
    -d '{"email":"admin@example.com","password":"Admin1234"}' \
    "$BASE_URL/auth/login" > "$out"
  AUTH="$(jq -r '.token' "$out")"
  test -n "$AUTH" && test "$AUTH" != "null"
}

expect_status() {
  local expected="$1" out="$2"; shift 2
  local status
  status=$(curl -sS -o "$out" -w '%{http_code}' "$@" || true)
  echo "HTTP $status"
  cat "$out"
  test "$status" = "$expected"
}

login_admin

echo "MÓDULO 2 — CLIENTES / FUNCIONALIDADES"

echo "1) CLIENTE — criação com todos os campos"
DOC="CLIENTE-CI-${KEY}"
EMAIL="cliente-ci-${KEY}@example.com"
expect_status 201 /tmp/cliente-ci-create.json \
  -X POST -H "Authorization: Bearer $AUTH" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Cliente CI $KEY\",\"document\":\"$DOC\",\"email\":\"$EMAIL\",\"phone\":\"21988881111\"}" \
  "$BASE_URL/customers"
ID="$(jq -r '.customer.id' /tmp/cliente-ci-create.json)"
test "$ID" != "null"


echo "2) CLIENTE — listagem e pesquisa"
curl --fail --silent -H "Authorization: Bearer $AUTH" "$BASE_URL/customers" > /tmp/cliente-ci-list.json
jq -e --arg id "$ID" '.customers | any(.[]; (.id|tostring) == $id)' /tmp/cliente-ci-list.json >/dev/null
for term in "Cliente%20CI" "$DOC" "$EMAIL"; do
  curl --fail --silent -H "Authorization: Bearer $AUTH" "$BASE_URL/customers?search=$term" > /tmp/cliente-ci-search.json
  jq -e --arg id "$ID" '.customers | any(.[]; (.id|tostring) == $id)' /tmp/cliente-ci-search.json >/dev/null
done


echo "3) CLIENTE — edição"
curl --fail --silent --show-error -X PUT \
  -H "Authorization: Bearer $AUTH" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Cliente CI Atualizado $KEY\",\"document\":\"${DOC}-2\",\"email\":\"cliente-ci-atualizado-${KEY}@example.com\",\"phone\":\"21977772222\"}" \
  "$BASE_URL/customers/$ID" > /tmp/cliente-ci-update.json
jq -e '.customer.name | startswith("Cliente CI Atualizado")' /tmp/cliente-ci-update.json >/dev/null
jq -e '.customer.phone == "21977772222"' /tmp/cliente-ci-update.json >/dev/null


echo "4) CLIENTE — desativar e reativar"
for active in false true; do
  curl --fail --silent --show-error -X PATCH \
    -H "Authorization: Bearer $AUTH" -H 'Content-Type: application/json' \
    -d "{\"active\":$active}" "$BASE_URL/customers/$ID/status" > /tmp/cliente-ci-status.json
  jq -e --argjson expected "$active" '.customer.active == $expected' /tmp/cliente-ci-status.json >/dev/null
done


echo "5) CLIENTE — validação de e-mail"
expect_status 400 /tmp/cliente-ci-invalid-email.json \
  -X POST -H "Authorization: Bearer $AUTH" -H 'Content-Type: application/json' \
  -d '{"name":"Cliente Validação","document":"CLIENTE-INVALIDO","email":"email-invalido","phone":"21900000000"}' \
  "$BASE_URL/customers"


echo "6) CLIENTE — validação de campo obrigatório"
expect_status 400 /tmp/cliente-ci-missing-name.json \
  -X POST -H "Authorization: Bearer $AUTH" -H 'Content-Type: application/json' \
  -d '{"document":"CLIENTE-SEM-NOME","email":"cliente-validacao@example.com","phone":"21900000000"}' \
  "$BASE_URL/customers"

echo "CLIENTES FUNCIONAIS — PASSED (id=$ID)"
