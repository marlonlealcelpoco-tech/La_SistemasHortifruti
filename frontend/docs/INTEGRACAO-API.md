# LA Sistemas ERP — Integração Frontend/API

## Princípios
1. O frontend consome as APIs oficiais do backend.
2. O frontend não implementa regras de negócio que pertençam ao backend.
3. O backend é a autoridade final para autenticação e autorização.
4. Dados do ERP não devem ser persistidos em `localStorage` como banco paralelo.
5. Antes de criar uma tela, conferir o contrato do endpoint correspondente.

## Cliente da API
- Arquivo: `frontend/js/api.js`
- Base padrão de desenvolvimento: `http://localhost:3000`.
- A URL pode ser sobrescrita antes do carregamento do cliente por `window.LA_API_BASE_URL`.
- O token JWT da sessão é enviado automaticamente como `Authorization: Bearer <token>`.
- O token e a sessão ficam em `sessionStorage` para a sessão do navegador; o frontend não utiliza `localStorage` como banco de dados.

## Autenticação — implementada
- `POST /auth/login` → autentica e retorna `{ user, token }`.
- `GET /auth/me` → consulta e confirma o usuário autenticado usando o JWT.
- O login salva o JWT em `sessionStorage`, confirma a sessão via `/auth/me` e somente então abre o App Shell.
- O App Shell exige um JWT; sem token, redireciona para `login.html`.
- Se `/auth/me` retornar `401`, a sessão é removida e o usuário retorna ao login.
- Logout remove token e sessão do `sessionStorage` e retorna ao login.

## Usuário e permissões
O endpoint `/auth/login` e `/auth/me` retornam `user.roles`. O frontend exibe os roles reais no cabeçalho. A montagem definitiva do menu por autorização será feita depois de mapear as permissões/roles efetivamente suportadas pelo backend, sem inventar regras no frontend.

## Usuários
- `GET /users`
- `POST /users`
- `PUT /users/:id/roles`
- `PATCH /users/:id/status`

## Cadastros
### Clientes
- `GET /customers`
- `POST /customers`
- `PUT /customers/:id`
- `PATCH /customers/:id/status`

### Fornecedores
- `GET /suppliers`
- `POST /suppliers`
- `PUT /suppliers/:id`
- `PATCH /suppliers/:id/status`

## Produtos e estoque
- `GET /products`
- `POST /products`
- `PUT /products/:id`
- `PATCH /products/:id/status`
- `PUT /products/:id/minimum-stock`
- `GET /products/:productId/movements`
- `POST /inventory/movements`

## Vendas / PDV
- `POST /sales`
- `POST /sales/:id/cancel`
- `POST /sales/:id/items/:itemId/cancel`
- `POST /sales/:id/discount/authorize`
- `POST /sales/:id/exchange/authorize`

## Caixa
- `POST /cash-sessions`
- `POST /cash-sessions/:id/transactions`
- `GET /cash-sessions/:id/report`
- `POST /cash-sessions/:id/close`
- `GET /cash-reports/daily`

## Compras
- `POST /purchases`
- `POST /purchases/xml/preview`
- `POST /purchases/import-xml`
- `POST /purchases/:id/confirm`

## Financeiro
- `GET /finance/payables`
- `POST /finance/payables`
- `POST /finance/payables/import-xml`
- `POST /finance/payables/:id/pay`
- `GET /finance/receivables`
- `POST /finance/receivables`
- `POST /finance/receivables/:id/receive`

## Atualização
Este documento deve ser atualizado quando uma tela passar de planejada para implementada ou quando um contrato de API utilizado pelo frontend mudar.

## Registro — 2026-08-15
A autenticação real do frontend foi conectada aos contratos existentes do backend. Nenhum endpoint novo foi criado e nenhuma regra de autenticação foi duplicada no frontend.
