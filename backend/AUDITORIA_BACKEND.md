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
- `products` — produtos e cadastro/preços.
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

**Observação:** a regra funcional usa os conceitos VENDEDOR e ESTOQUISTA. No código os nomes são `VENDAS` e `ESTOQUE`.

## MATRIZ OFICIAL DE PERMISSÕES — BASEADA NO CÓDIGO ATUAL

Esta seção é a referência rápida da auditoria. **Não alterar esta matriz sem decisão explícita de negócio.** Ela representa exatamente as políticas atualmente definidas em `backend/src/auth/role-policy.ts`.

| Política / Área | GERENTE | FINANCEIRO | SUPERVISOR | VENDAS (Vendedor) | ESTOQUE (Estoquista) | ADMIN |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| `MANAGER` / gestão | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `FINANCE` / financeiro administrativo | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ |
| `CASH_OPERATORS` / operações de caixa | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ |
| `CASH_REPORTS` / relatórios de caixa | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ |
| `CUSTOMER_MAINTENANCE` / clientes | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| `PRODUCT_MAINTENANCE` / produtos | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| `PURCHASE_MAINTENANCE` / compras | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| `INVENTORY_MAINTENANCE` / estoque | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ |
| `PDV` / vendas | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ |
| `SUPERVISOR_AUTHORITY` / autoridade de supervisor | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ |
| `COST_VIEW` / visualizar custos | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |

### GERENTE — regra oficial atual

O código permite ao GERENTE:

- gestão (`MANAGER`);
- operações de caixa;
- manutenção de clientes;
- manutenção de produtos;
- manutenção de compras;
- manutenção de estoque/inventário;
- PDV/vendas;
- autoridade de supervisor;
- visualização de custos.

O GERENTE **não** está incluído nas políticas `FINANCE` e `CASH_REPORTS`.

**Regra de negócio confirmada pelo projeto:** manter exatamente este parâmetro atual para GERENTE.

### FINANCEIRO — regra oficial atual

O código permite ao FINANCEIRO:

- financeiro administrativo (`FINANCE`);
- relatórios de caixa (`CASH_REPORTS`);
- manutenção de clientes;
- manutenção de produtos;
- manutenção de compras;
- visualização de custos.

O FINANCEIRO **não** está incluído nas políticas de:

- operações de caixa (`CASH_OPERATORS`);
- PDV (`PDV`);
- estoque (`INVENTORY_MAINTENANCE`);
- autoridade de supervisor (`SUPERVISOR_AUTHORITY`);
- gestão (`MANAGER`).

**Regra de negócio confirmada pelo projeto:** manter exatamente este parâmetro atual para FINANCEIRO.

### SUPERVISOR — regra oficial atual

O código permite ao SUPERVISOR:

- operações de caixa (`CASH_OPERATORS`);
- PDV/vendas (`PDV`);
- autoridade de supervisor (`SUPERVISOR_AUTHORITY`).

O SUPERVISOR não possui, pela política atual, manutenção administrativa de clientes, produtos ou compras, manutenção de estoque, financeiro administrativo, relatórios de caixa ou visualização de custos.

### VENDAS — regra oficial atual

O código permite ao VENDAS (Vendedor):

- operações de caixa (`CASH_OPERATORS`);
- PDV/vendas (`PDV`).

O VENDAS não possui, pela política atual, autoridade de supervisor, manutenção de clientes/produtos/compras/estoque, financeiro administrativo, relatórios de caixa ou visualização de custos.

### ESTOQUE — regra oficial atual

O código permite ao ESTOQUE (Estoquista):

- manutenção de estoque/inventário (`INVENTORY_MAINTENANCE`).

O ESTOQUE não possui, pela política atual, operações de caixa, PDV, autoridade de supervisor, manutenção de clientes/produtos/compras, financeiro administrativo, relatórios de caixa ou visualização de custos.

### ADMIN — regra oficial atual

ADMIN está presente em todas as políticas acima e representa o acesso administrativo total.

## Regras já confirmadas no código

### Vendas

- Venda exige caixa aberto.
- Venda deve ser registrada no caixa do próprio vendedor.
- Venda exige pelo menos um item.
- Quantidade deve ser positiva.
- Preço não pode ser negativo.
- Soma dos pagamentos deve ser igual ao total da venda.
- Venda a prazo exige cliente identificado.
- Venda a prazo exige data de vencimento.
- Venda a prazo cria `financial_entries` do tipo `RECEIVABLE` e uma parcela `PENDING`.
- Pagamentos não a prazo entram em `cash_events`.
- Venda reduz estoque de forma transacional.
- Estoque insuficiente impede a venda.
- Cancelamento restaura estoque.
- Cancelamento gera evento de caixa reverso para pagamentos aplicáveis.
- Cancelamento marca a conta a receber da venda como `CANCELLED`.
- Cancelamento duplicado retorna conflito.

### Caixa

- A sessão de caixa possui vendedor (`seller_id`).
- Venda é vinculada ao `cash_session_id`.
- O caixa precisa estar aberto para venda.
- O fechamento produz relatório com vendas, recebimentos, suprimentos, sangrias e diferença.

### Financeiro

- Existem endpoints para contas a pagar.
- Existem endpoints para contas a receber.
- Existe criação manual de conta a receber.
- Existe recebimento/baixa de conta a receber.
- Existe baixa de conta a pagar.
- Baixa exige valor e forma de pagamento.
- A baixa exige caixa ou conta financeira.
- Não permite baixar acima do saldo restante.
- Não permite baixar conta já totalmente baixada.
- Atualmente as rotas administrativas de contas a receber exigem `ADMIN` ou `FINANCEIRO`.

### Compras

- Existem fluxo de compra/entrada.
- Compra possui itens e custo unitário.
- Confirmação da compra integra entrada no estoque.
- Existe importação/parsing de XML de NF-e.
- Compras podem gerar obrigação financeira.

### Estoque

- Existem ajustes.
- Existe razão/ledger de estoque.
- Venda gera saída de estoque.
- Cancelamento de venda gera entrada de estorno.
- Compra confirmada gera entrada.

### Autorização

- Existe middleware de autenticação.
- Existem políticas de roles e testes unitários da matriz de autorização.
- Existem roles oficiais semeadas por migration.
- A autorização deve ser testada por endpoint e por role, incluindo negativas.

## Ponto funcional crítico encontrado nesta auditoria

O código atual cria corretamente a conta a receber quando uma venda usa `CREDIT`, porém o endpoint de recebimento administrativo (`POST /finance/receivables/:id/receive`) está protegido por `ADMIN`/`FINANCEIRO`.

Isso não comprova ainda a regra operacional desejada de que o VENDEDOR possa receber a prazo no próprio caixa e que esse recebimento dê baixa automática no Contas a Receber e seja comprovado no fechamento do caixa.

**STATUS: PENDENTE DE VALIDAÇÃO/IMPLEMENTAÇÃO FUNCIONAL**

Teste obrigatório:

`Venda a prazo -> RECEIVABLE PENDING -> vendedor recebe no caixa -> baixa automática -> cash_event -> saldo esperado do caixa -> fechamento.`

Também devem ser testados pagamentos parciais e quitação total.

## Bateria de testes a executar

### A. Infraestrutura
- [ ] health
- [ ] configuração/env
- [ ] conexão DB
- [ ] migrations
- [ ] inicialização do administrador

### B. Autenticação/autorização
- [ ] login válido
- [ ] senha inválida
- [ ] endpoint protegido sem token
- [ ] token inválido
- [ ] usuário inativo
- [ ] criação de usuário
- [ ] troca de roles
- [ ] cada role positiva/negativa por módulo
- [ ] validar exatamente a matriz oficial acima

### C. Cadastros
- [ ] clientes
- [ ] fornecedores
- [ ] produtos
- [ ] edição
- [ ] desativação
- [ ] validações e duplicidades

### D. Compras/estoque
- [ ] compra rascunho
- [ ] item/custo
- [ ] confirmação
- [ ] entrada estoque
- [ ] saldo
- [ ] movimento
- [ ] ajuste positivo
- [ ] ajuste negativo
- [ ] avaria/perda
- [ ] inventário/ledger
- [ ] XML/NF-e
- [ ] obrigação financeira da compra

### E. Caixa
- [ ] abertura
- [ ] abertura duplicada
- [ ] suprimento
- [ ] sangria
- [ ] vendas por forma de pagamento
- [ ] recebimentos de clientes
- [ ] fechamento
- [ ] diferença
- [ ] caixa de vendedor diferente

### F. Vendas/PDV
- [ ] venda à vista
- [ ] PIX
- [ ] débito
- [ ] crédito cartão
- [ ] transferência
- [ ] venda a prazo
- [ ] venda a prazo sem cliente
- [ ] venda a prazo sem vencimento
- [ ] pagamento incompatível com total
- [ ] estoque insuficiente
- [ ] cancelamento
- [ ] cancelamento de item
- [ ] desconto autorizado
- [ ] troca autorizada
- [ ] estornos e invariantes

### G. Contas a receber
- [ ] criação manual
- [ ] criação automática pela venda a prazo
- [ ] listagem
- [ ] recebimento parcial
- [ ] recebimento total
- [ ] baixa automática
- [ ] entrada no caixa
- [ ] fechamento comprova recebimento
- [ ] excesso de recebimento
- [ ] recebimento de conta já quitada
- [ ] cancelamento/estorno

### H. Contas a pagar
- [ ] criação
- [ ] listagem
- [ ] pagamento parcial
- [ ] pagamento total
- [ ] XML
- [ ] integração com compra
- [ ] excesso/duplicidade

### I. Relatórios/gestão
- [ ] fluxo financeiro
- [ ] DRE
- [ ] contas a pagar
- [ ] contas a receber
- [ ] dashboard
- [ ] drilldown
- [ ] alertas
- [ ] fechamento/invariantes

### J. Integridade/transações
- [ ] rollback em falha de venda
- [ ] rollback em falha de compra
- [ ] rollback financeiro
- [ ] concorrência/locks essenciais
- [ ] estoque nunca negativo
- [ ] caixa sem movimento órfão
- [ ] conta financeira sem baixa indevida

## Critério de conclusão do backend

O backend será considerado **OK** somente quando:

- todos os testes acima estiverem verdes;
- as regras de negócio estiverem coerentes com a matriz funcional definida;
- nenhuma rota protegida retornar 500 para erro de validação/autorização esperado;
- os invariantes de estoque, caixa e financeiro estiverem comprovados;
- a bateria E2E e a bateria de autorização estiverem verdes;
- somente então iniciaremos a auditoria/implementação do frontend.

## Histórico inicial

- CI #28: bateria E2E principal passou.
- CI #29: bateria abrangente encontrou primeiro erro de autenticação sem token; corrigido para 401.
- CI seguinte: troca de roles revelou role inexistente; a migration oficial confirma o catálogo de roles.
- Auditoria atual: venda a prazo já cria `RECEIVABLE`, mas o recebimento operacional pelo VENDEDOR ainda precisa ser comprovado contra a regra desejada.
