# Auditoria Funcional do Backend — LA-Sistemas Hortifruti

**Data:** 2026-08-24  
**Objetivo:** validar o backend funcionalmente, regra por regra, antes de iniciar novos trabalhos no frontend.

## Regra de trabalho

1. Catalogar o código existente e suas funcionalidades.
2. Separar cada regra em um caso de teste individual.
3. Testar primeiro o comportamento atual, sem mascarar falhas.
4. Corrigir somente quando houver divergência entre código/regra oficial e comportamento esperado.
5. Reexecutar os testes de regressão após cada correção.
6. Não considerar o backend concluído enquanto houver falha funcional conhecida.
7. Frontend somente após a bateria do backend estar verde.

## Módulos encontrados

- `auth` — autenticação, usuários, senha, autorização e política de roles.
- `cash` — abertura, movimentos, suprimento, sangria, fechamento e relatório de caixa.
- `customers` — crédito de loja do cliente.
- `finance` — contas a pagar, contas a receber, baixas, parcelas, relatórios e gestão financeira.
- `inventory` — estoque, ajustes, razão/movimentações.
- `operations` — regras operacionais centrais.
- `parties` — cadastros de clientes/fornecedores/partes.
- `products` — produtos, preços, estoque mínimo e dados fiscais.
- `purchases` — compras, entrada de mercadoria e XML/NF-e.
- `sales` — vendas, pagamentos, cancelamentos, ações de supervisor, trocas e crédito.
- `integration` — testes de fluxo real do PDV.
- `db` — conexão com PostgreSQL.

## Roles oficiais atualmente presentes no código/migration

A migration `backend/src/finance/migrations/002_official_roles.sql` cadastra:

- `ADMIN`
- `GERENTE`
- `SUPERVISOR`
- `VENDAS`
- `ESTOQUE`
- `FINANCEIRO`

## Módulo 2 — Cadastros / estado validado

O CI verde do teste `backend-cadastros-authorization.sh` valida a comunicação real API ↔ PostgreSQL e a matriz de autorização dos cadastros de clientes, fornecedores e produtos.

### Produto — estrutura comercial

O cadastro possui código, nome, descrição, unidade, custo, preço de venda, margem, ativo/inativo e estoque mínimo.

### Produto — estrutura fiscal adicionada

A migration `database/migrations/014_add_product_fiscal_data.sql` adiciona ao produto:

- `ncm` — NCM de 8 dígitos.
- `cest` — CEST de 7 dígitos, quando aplicável.
- `cfop` — CFOP de 4 dígitos.
- `tax_code_type` — tipo `CST` ou `CSOSN`.
- `tax_code` — código tributário correspondente.
- `origin` — origem da mercadoria de 0 a 8.
- `gtin` — GTIN/EAN do produto, quando aplicável.
- `gtin_trib` — GTIN/EAN da unidade tributável, quando aplicável.
- `tax_unit` — unidade tributável quando diferente da unidade comercial.
- `icms_rate` — alíquota de ICMS.
- `pis_cst` e `pis_rate` — CST e alíquota de PIS.
- `cofins_cst` e `cofins_rate` — CST e alíquota de COFINS.

Os campos fiscais são persistidos no PostgreSQL e retornados pela API. A validação de obrigatoriedade específica por operação/regime será responsabilidade do módulo fiscal, evitando obrigar dados que não sejam aplicáveis a todas as operações.

### Testes fiscais adicionados

`tests/integration/backend-product-fiscal.sh` valida:

1. criação de produto com dados fiscais;
2. persistência e leitura dos dados fiscais;
3. atualização dos dados fiscais;
4. rejeição de NCM inválido;
5. rejeição de CST/CSOSN sem código tributário;
6. integração do teste ao Backend CI.

**Status:** implementação concluída; validação final depende do próximo CI verde após a migration/API fiscal.
