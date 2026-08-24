# Arquitetura do Backend

## Stack adotada

- **Node.js 22 + TypeScript**
- **Fastify**
- **PostgreSQL**
- **SQL com `pg`**
- **JWT + bcrypt**
- **Zod**
- **fast-xml-parser** para XML de NF-e

A interface será criada posteriormente a partir do modelo PowerPoint.

## Implementado

- Autenticação, perfis, clientes, fornecedores, produtos e estoque
- Compras manuais e por XML, com revisão de preço
- Vendas com múltiplas formas de pagamento e baixa de estoque
- Sessões de caixa independentes por terminal, vendedor e turno
- Sangria, suprimento, recebimento a prazo, compra a prazo e cancelamento
- Fechamento com relatório salvo e consolidado diário por computador
- Autorizações por perfil e operações de estoque transacionais

## Organização

```text
backend/src/
├── auth/        # identidade e autorização
├── cash/        # sessões, eventos e relatórios de caixa
├── inventory/   # saldo e movimentos
├── parties/     # clientes e fornecedores
├── products/    # catálogo, preços e margem
├── purchases/   # compra manual e XML
├── sales/       # venda, pagamentos e cancelamento
└── users/       # usuários e perfis
```

O próximo módulo é financeiro: contas a receber das vendas a prazo, contas a pagar e conciliação dos movimentos de caixa.
