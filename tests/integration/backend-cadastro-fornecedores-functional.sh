#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
RUN_ID="${GITHUB_RUN_ID:-local}"
KEY="${RUN_ID:0:20}"

login_admin() {
  local out=/tmp/fornecedores-functional-login.json
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

echo "MÓDULO 2 — FORNECEDORES / FUNCIONALIDADES"

echo "1) FORNECEDOR — criação com todos os campos"
DOC="FORNECEDOR-CI-${KEY}"
EMAIL="fornecedor-ci-${KEY}@example.com"
expect_status 201 /tmp/fornecedor-ci-create.json \
  -X POST -H "Authorization: Bearer $AUTH" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Fornecedor CI $KEY\",\"document\":\"$DOC\",\"email\":\"$EMAIL\",\"phone\":\"21988883333\"}" \
  "$BASE_URL/suppliers"
ID="$(jq -r '.supplier.id' /tmp/fornecedor-ci-create.json)"
test "$ID" != "null"


echo "2) FORNECEDOR — listagem e pesquisa"
curl --fail --silent -H "Authorization: Bearer $AUTH" "$BASE_URL/suppliers" > /tmp/fornecedor-ci-list.json
jq -e --arg id "$ID" '.suppliers | any(.[]; (.id|tostring) == $id)' /tmp/fornecedor-ci-list.json >/dev/null
for term in "Fornecedor%20CI" "$DOC" "$EMAIL"; do
  curl --fail --silent -H "Authorization: Bearer $AUTH" "$BASE_URL/suppliers?search=$term" > /tmp/fornecedor-ci-search.json
  jq -e --arg id "$ID" '.suppliers | any(.[]; (.id|tostring) == $id)' /tmp/fornecedor-ci-search.json >/dev/null
done


echo "3) FORNECEDOR — edição"
curl --fail --silent --show-error -X PUT \
  -H "Authorization: Bearer $AUTH" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Fornecedor CI Atualizado $KEY\",\"document\":\"${DOC}-2\",\"email\":\"fornecedor-ci-atualizado-${KEY}@example.com\",\"phone\":\"21966664444\"}" \
  "$BASE_URL/suppliers/$ID" > /tmp/fornecedor-ci-update.json
jq -e '.supplier.name | startswith("Fornecedor CI Atualizado")' /tmp/fornecedor-ci-update.json >/dev/null
jq -e '.supplier.phone == "21966664444"' /tmp/fornecedor-ci-update.json >/dev/null


echo "4) FORNECEDOR — desativar e reativar"
for active in false true; do
  curl --fail --silent --show-error -X PATCH \
    -H "Authorization: Bearer $AUTH" -H 'Content-Type: application/json' \
    -d "{\"active\":$active}" "$BASE_URL/suppliers/$ID/status" > /tmp/fornecedor-ci-status.json
  jq -e --argjson expected "$active" '.supplier.active == $expected' /tmp/fornecedor-ci-status.json >/dev/null
done


echo "5) FORNECEDOR — validação de e-mail"
expect_status 400 /tmp/fornecedor-ci-invalid-email.json \
  -X POST -H "Authorization: Bearer $AUTH" -H 'Content-Type: application/json' \
  -d '{"name":"Fornecedor Validação","document":"FORNECEDOR-INVALIDO","email":"email-invalido","phone":"21900000000"}' \
  "$BASE_URL/suppliers"


echo "6) FORNECEDOR — validação de campo obrigatório"
expect_status 400 /tmp/fornecedor-ci-missing-name.json \
  -X POST -H "Authorization: Bearer $AUTH" -H 'Content-Type: application/json' \
  -d '{"document":"FORNECEDOR-SEM-NOME","email":"fornecedor-validacao@example.com","phone":"21900000000"}' \
  "$BASE_URL/suppliers"

echo "FORNECEDORES FUNCIONAIS — PASSED (id=$ID)"
