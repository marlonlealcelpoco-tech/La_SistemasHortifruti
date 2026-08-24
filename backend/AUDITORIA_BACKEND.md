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

**Regra de negócio confirmada:** VENDAS pode operar venda a prazo e receber contas a prazo **exclusivamente através do Caixa**, sem receber acesso administrativo ao módulo Financeiro.

O VENDAS não possui, pela política atual, autoridade administrativa de supervisor, manutenção de clientes/produtos/compras/estoque, financeiro administrativo, relatórios de caixa ou visualização de custos.

### ESTOQUE — regra oficial atual

O código permite ao ESTOQUE (Estoquista):

- manutenção de estoque/inventário (`INVENTORY_MAINTENANCE`).

O ESTOQUE não possui, pela política atual, operações de caixa, PDV, autoridade de supervisor, manutenção de clientes/produtos/compras, financeiro administrativo, relatórios de caixa ou visualização de custos.

### ADMIN — regra oficial atual

ADMIN está presente em todas as políticas acima e representa o acesso administrativo total.

## REGRA FUNCIONAL OFICIAL — VENDA A PRAZO E RECEBIMENTO PELO CAIXA

Esta regra foi confirmada pelo projeto e passa a ser referência obrigatória para os testes.

### 1. A venda a prazo nasce no Caixa

Toda venda a prazo é criada **exclusivamente durante a operação de venda no Caixa**. Não existe fluxo separado para o vendedor ou para o Financeiro criar manualmente a conta a receber correspondente à venda.

Fluxo:

`Login do Vendedor → abertura do próprio Caixa → informar valor inicial → Nova Venda → selecionar cliente → produtos → pagamento A PRAZO → finalizar.`

Ao finalizar a venda a prazo, o backend deve criar automaticamente e manter vinculados:

- venda;
- itens da venda;
- cliente;
- vendedor responsável;
- caixa onde a venda ocorreu;
- valor total;
- prazo/vencimento;
- conta a receber originada da venda;
- documento/comprovante da operação.

### 2. Documento da venda a prazo

A venda a prazo deve gerar o comprovante/nota da operação para assinatura do cliente, conforme o processo operacional definido. O documento assinado fica destinado à conferência do Financeiro ao final do dia.

### 3. Recebimento acontece exclusivamente pelo Caixa

Quando o cliente retorna para pagar, o VENDEDOR não acessa o módulo Financeiro para fazer a baixa.

O VENDEDOR utiliza o Caixa que está aberto e funcionando normalmente:

`Caixa → Receber cliente → pesquisar pelo nome do cliente → localizar saldo em aberto → informar valor recebido → confirmar.`

O sistema deve permitir recebimento parcial.

Exemplo:

- conta original: R$ 100,00;
- cliente paga: R$ 50,00;
- saldo restante: R$ 50,00;
- status: `PARTIAL`.

### 4. Baixa automática no Financeiro

Ao confirmar o recebimento pelo Caixa, o backend deve realizar transacionalmente:

1. registrar o recebimento;
2. reduzir o saldo da conta a receber;
3. alterar o status da conta para `PARTIAL` ou `PAID` conforme o saldo;
4. gerar o movimento/evento correspondente no Caixa;
5. vincular o recebimento à conta, à venda, ao cliente, ao vendedor e ao caixa;
6. fazer o valor recebido participar da conferência e fechamento do Caixa.

**O VENDEDOR não precisa e não deve acessar a baixa administrativa do Financeiro.**

### 5. Rastro obrigatório do dinheiro

Cada recebimento deve permitir reconstruir o caminho:

`Cliente → Conta a Receber → Venda original → Recebimento → Caixa → Vendedor → Forma de pagamento → Fechamento.`

O recebimento não deve criar uma segunda dívida nem duplicar o lançamento financeiro. A conta a receber é a origem da obrigação e o recebimento pelo Caixa é a liquidação parcial/total dessa obrigação com reflexo no caixa.

### 6. Financeiro

O Financeiro pode acompanhar/conferir o resultado da operação e a situação da conta, mas o recebimento operacional da venda a prazo ocorre pelo Caixa.

O acesso administrativo do Financeiro continua conforme a matriz oficial acima.

### 7. Teste E2E obrigatório

Cenário mínimo:

`Vendedor login → abre caixa R$100 → vende R$100 a prazo → RECEIVABLE PENDING R$100 → cliente retorna → recebe R$50 no caixa → cash_event +R$50 → RECEIVABLE PARTIAL R$50 → fechamento comprova R$50 → cliente retorna → recebe R$50 restantes → RECEIVABLE PAID → caixa/fechamento coerentes.`

Também testar:

- pagamento integral de uma vez;
- pagamento parcial em várias vezes;
- tentativa de receber acima do saldo;
- tentativa de receber conta já quitada;
- vendedor sem caixa aberto;
- recebimento em caixa de outro vendedor;
- conta de outro cliente;
- rastreabilidade do recebimento;
- cancelamento/estorno, quando aplicável.

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
- A rota administrativa de contas a receber atualmente exige `ADMIN` ou `FINANCEIRO`; isso não substitui o fluxo operacional de recebimento pelo Caixa definido acima.

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

## Ponto funcional crítico

A rota administrativa `POST /finance/receivables/:id/receive` atualmente aceita `ADMIN`/`FINANCEIRO`. Isso é **separado** da regra operacional oficial agora definida: o VENDEDOR deve receber a conta a prazo **pelo Caixa**, com baixa automática e rastreabilidade.

**STATUS DA REGRA:** definida funcionalmente; comportamento E2E ainda precisa ser implementado/validado contra o fluxo operacional completo.

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

### G. Contas a receber / recebimento pelo Caixa
- [ ] criação automática pela venda a prazo
- [ ] conta vinculada à venda/cliente
- [ ] consulta da conta pelo Caixa
- [ ] recebimento parcial pelo Caixa
- [ ] recebimento total pelo Caixa
- [ ] baixa automática
- [ ] entrada no caixa
- [ ] fechamento comprova recebimento
- [ ] excesso de recebimento
- [ ] recebimento de conta já quitada
- [ ] recebimento em caixa de outro vendedor
- [ ] rastreabilidade completa
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
- Regra funcional consolidada: toda venda a prazo nasce no Caixa; o cliente pode pagar parcial ou totalmente posteriormente no Caixa; o recebimento gera entrada no caixa e baixa automática da conta a receber, sem conceder acesso administrativo ao Financeiro ao VENDEDOR.
