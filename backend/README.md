# API — LA-Sistemas ERP

## Início rápido

1. Na raiz do projeto, execute `docker compose up -d`.
2. Na pasta `backend`, crie `.env` a partir de `.env.example`.
3. Execute `npm install` e `npm run dev`.

A API estará em `http://localhost:3000`. Rotas autenticadas usam `Authorization: Bearer <token>`.

## Módulos disponíveis

| Recurso | Acesso |
| --- | --- |
| Usuários | ADMIN |
| Clientes e fornecedores | Conforme perfil |
| Produtos, estoque e compras | Conforme perfil |
| Vendas e caixa | ADMIN, VENDAS |
| Consolidado diário de caixas | ADMIN, FINANCEIRO |

## Caixas por vendedor, turno e computador

Uma abertura cria uma sessão de caixa independente. O sistema gera o número `CX-000001` a partir do identificador da sessão e armazena:

- computador/terminal (`terminalId`);
- vendedor;
- data, hora e valor de abertura;
- vendas e recebimentos por forma de pagamento;
- vendas a prazo;
- cancelamentos;
- sangrias, suprimentos e compras a prazo;
- valor de fechamento, diferença e relatório congelado.

Vários computadores e vendedores podem ter caixas abertos ao mesmo tempo. Para troca de vendedor, abra um novo caixa para o novo vendedor; os movimentos permanecem separados.

### Abrir caixa

```json
POST /cash-sessions

{
  "terminalId": "CAIXA-01",
  "openingAmount": 150.00
}
```

Um administrador pode abrir para outro vendedor ao incluir `sellerId`.

### Movimentos manuais

```json
POST /cash-sessions/1/transactions

{
  "type": "WITHDRAWAL",
  "amount": 100.00,
  "description": "Sangria para cofre"
}
```

Tipos: `SUPPLY` (suprimento), `WITHDRAWAL` (sangria), `CUSTOMER_RECEIPT` (recebimento de venda a prazo) e `PURCHASE_ON_CREDIT` (saída referente a compra a prazo).

### Fechar e consultar

- `GET /cash-sessions/:id/report`: relatório do caixa aberto ou fechado.
- `POST /cash-sessions/:id/close`: recebe `{ "closingAmount": 123.45 }`, encerra e grava o relatório.
- `GET /cash-reports/daily?date=2026-08-15&terminalId=CAIXA-01`: consolida todos os caixas do dia, com filtro opcional por computador.

O relatório inclui abertura, vendas por forma de pagamento, vendas a prazo, recebimentos a prazo, suprimentos, sangrias, compras a prazo, cancelamentos e valor esperado em dinheiro.

## Vendas

Uma venda exige caixa aberto do vendedor e baixa o estoque imediatamente. A soma dos pagamentos deve corresponder ao total dos itens.

```json
POST /sales

{
  "cashSessionId": 1,
  "customerId": 1,
  "items": [
    { "productId": 1, "quantity": 2, "unitPrice": 49.90 }
  ],
  "payments": [
    { "paymentMethod": "PIX", "amount": 50.00 },
    { "paymentMethod": "CASH", "amount": 49.80 }
  ]
}
```

Formas de pagamento: `CASH`, `PIX`, `DEBIT_CARD`, `CREDIT_CARD`, `TRANSFER` e `CREDIT`. Para `CREDIT` (venda a prazo), informe também `dueDate`.

Para cancelar, use `POST /sales/:id/cancel`. O estoque é estornado e o relatório do caixa recebe o cancelamento.

## Compras e XML

- `POST /purchases`: compra manual em rascunho.
- `POST /purchases/xml/preview`: identifica itens de NF-e e mostra comparação de preço.
- `POST /purchases/import-xml`: registra XML com decisão Vincular/Cadastrar por item.
- `POST /purchases/:id/confirm`: efetiva entrada, custo e alterações de venda aprovadas.

A documentação completa de XML está versionada junto desta página no histórico do repositório.

## Regras importantes

- Compras só alteram estoque e custo após confirmação.
- Vendas só são aceitas com caixa aberto do próprio vendedor.
- Saídas de estoque não permitem saldo negativo.
- O fechamento torna a sessão imutável para novos movimentos e preserva uma cópia do relatório.
