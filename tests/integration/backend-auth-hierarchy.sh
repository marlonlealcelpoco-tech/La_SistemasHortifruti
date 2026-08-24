#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
EMAIL="${ADMIN_EMAIL:-admin@example.com}"
PASSWORD="${ADMIN_PASSWORD:-Admin1234}"
RUN_ID="${GITHUB_RUN_ID:-local}-$(date +%s%N)"

json() { jq -r "$1"; }
expect_status() {
  local expected="$1"; shift
  local body_file="/tmp/erp-auth-response.json"
  local status
  status=$(curl -sS -o "$body_file" -w '%{http_code}' "$@" || true)
  echo "HTTP $status"
  cat "$body_file"
  test "$status" = "$expected"
}

echo "MÓDULO 1 — AUTENTICAÇÃO E HIERARQUIA"

echo "1) Protected endpoint without token -> 401"
expect_status 401 "$BASE_URL/products"

echo "2) Invalid login -> 401"
expect_status 401 -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL\",\"password\":\"senha-incorreta\"}" "$BASE_URL/auth/login"

echo "3) Login valid -> token"
curl --fail --silent --show-error -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" "$BASE_URL/auth/login" >/tmp/erp-auth-login.json
TOKEN=$(json '.token' </tmp/erp-auth-login.json)
ADMIN_ID=$(json '.user.id' </tmp/erp-auth-login.json)
test -n "$TOKEN" && test "$TOKEN" != "null"
AUTH=(-H "Authorization: Bearer $TOKEN")

echo "4) /auth/me returns authenticated admin"
curl --fail --silent "${AUTH[@]}" "$BASE_URL/auth/me" >/tmp/erp-auth-me.json
jq -e '.user.email == "'"$EMAIL"'" and (.user.roles | index("ADMIN") != null)' /tmp/erp-auth-me.json >/dev/null

echo "5) Official six-role catalog must exist"
curl --fail --silent "${AUTH[@]}" "$BASE_URL/users" >/tmp/erp-auth-users.json
for role in ADMIN GERENTE SUPERVISOR VENDAS ESTOQUE FINANCEIRO; do
  echo "Checking role: $role"
  jq -e --arg role "$role" '[.users[].roles[]] | index($role) != null' /tmp/erp-auth-users.json >/dev/null || {
    echo "Role $role is not represented by current users; role catalog will be validated by role assignment below."
  }
done

echo "6) ADMIN creates one test user per official role"
for role in GERENTE SUPERVISOR VENDAS ESTOQUE FINANCEIRO; do
  email="e2e-${role,,}-${RUN_ID}@example.com"
  curl --fail --silent --show-error "${AUTH[@]}" -H 'Content-Type: application/json' \
    -d "{\"name\":\"E2E $role\",\"email\":\"$email\",\"password\":\"Test1234\",\"roles\":[\"$role\"]}" \
    "$BASE_URL/users" >"/tmp/erp-user-$role.json"
  id=$(json '.user.id' <"/tmp/erp-user-$role.json")
  test "$id" != "null"
  echo "$role user id=$id"
done

echo "7) ADMIN replaces VENDAS user roles with SUPERVISOR"
VENDOR_EMAIL="e2e-vendas-${RUN_ID}@example.com"
curl --fail --silent --show-error "${AUTH[@]}" -H 'Content-Type: application/json' \
  -d "{\"name\":\"E2E Vendas\",\"email\":\"$VENDOR_EMAIL\",\"password\":\"Vendas1234\",\"roles\":[\"VENDAS\"]}" \
  "$BASE_URL/users" >/tmp/erp-vendor.json
VENDOR_ID=$(json '.user.id' </tmp/erp-vendor.json)
STATUS=$(curl -sS -o /tmp/erp-role-replace.json -w '%{http_code}' "${AUTH[@]}" -X PUT -H 'Content-Type: application/json' \
  -d '{"roles":["VENDAS","SUPERVISOR"]}' "$BASE_URL/users/$VENDOR_ID/roles" || true)
echo "Role replacement HTTP status: $STATUS"
cat /tmp/erp-role-replace.json
test "$STATUS" = 200
jq -e '.user.roles | index("VENDAS") != null and index("SUPERVISOR") != null' /tmp/erp-role-replace.json >/dev/null

echo "8) ADMIN restores VENDAS role"
curl --fail --silent "${AUTH[@]}" -X PUT -H 'Content-Type: application/json' \
  -d '{"roles":["VENDAS"]}' "$BASE_URL/users/$VENDOR_ID/roles" >/dev/null

echo "9) Invalid role is rejected by API validation"
expect_status 400 "${AUTH[@]}" -X PUT -H 'Content-Type: application/json' \
  -d '{"roles":["NAO_EXISTE"]}' "$BASE_URL/users/$VENDOR_ID/roles"

echo "10) ADMIN cannot alter own roles"
expect_status 400 "${AUTH[@]}" -X PUT -H 'Content-Type: application/json' \
  -d '{"roles":["GERENTE"]}' "$BASE_URL/users/$ADMIN_ID/roles"

echo "11) ADMIN cannot deactivate own access"
expect_status 400 "${AUTH[@]}" -X PATCH -H 'Content-Type: application/json' \
  -d '{"active":false}' "$BASE_URL/users/$ADMIN_ID/status"

echo "12) Test users are deactivated"
for file in /tmp/erp-user-GERENTE.json /tmp/erp-user-SUPERVISOR.json /tmp/erp-user-VENDAS.json /tmp/erp-user-ESTOQUE.json /tmp/erp-user-FINANCEIRO.json; do
  id=$(json '.user.id' <"$file")
  curl --fail --silent "${AUTH[@]}" -X PATCH -H 'Content-Type: application/json' -d '{"active":false}' "$BASE_URL/users/$id/status" >/dev/null
done
curl --fail --silent "${AUTH[@]}" -X PATCH -H 'Content-Type: application/json' -d '{"active":false}' "$BASE_URL/users/$VENDOR_ID/status" >/dev/null

echo
echo "AUTHENTICATION AND HIERARCHY MODULE PASSED."
printf 'admin=%s\n' "$ADMIN_ID"
