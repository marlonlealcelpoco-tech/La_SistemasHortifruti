# LA Sistemas ERP — Mapa de Telas

| Módulo | Tela | Status | API principal |
|---|---|---|---|
| Autenticação | Login | ⏳ | `POST /auth/login` |
| Autenticação | Sessão/Meu usuário | ⏳ | `GET /auth/me` |
| Dashboard | Principal | ⏳ | múltiplas APIs |
| Vendas | PDV | ⏳ | `POST /sales` |
| Vendas | Histórico | ⏳ | endpoints de vendas |
| Vendas | Cancelamento | ⏳ | `POST /sales/:id/cancel` |
| Vendas | Trocas | ⏳ | autorização de troca |
| Caixa | Abrir caixa | ⏳ | `POST /cash-sessions` |
| Caixa | Movimentações | ⏳ | `POST /cash-sessions/:id/transactions` |
| Caixa | Relatório | ⏳ | `GET /cash-sessions/:id/report` |
| Caixa | Fechar caixa | ⏳ | `POST /cash-sessions/:id/close` |
| Estoque | Produtos | ⏳ | `/products` |
| Estoque | Movimentações | ⏳ | `/inventory/movements` |
| Estoque | Ajustes | ⏳ | `/inventory/movements` |
| Estoque | Estoque mínimo | ⏳ | `/products/:id/minimum-stock` |
| Cadastros | Clientes | ⏳ | `/customers` |
| Cadastros | Fornecedores | ⏳ | `/suppliers` |
| Cadastros | Usuários | ⏳ | `/users` |
| Compras | Compras | ⏳ | `/purchases` |
| Compras | Importação XML | ⏳ | `/purchases/xml/preview` |
| Financeiro | Contas a pagar | ⏳ | `/finance/payables` |
| Financeiro | Contas a receber | ⏳ | `/finance/receivables` |
| Financeiro | Fluxo | ⏳ | APIs financeiras |
| Financeiro | DRE | ⏳ | APIs financeiras |
| Relatórios | Relatórios operacionais | ⏳ | APIs dos módulos |
| Configurações | Usuários/Roles | ⏳ | `/users` |

## Legenda
- ⏳ Planejado
- 🚧 Em desenvolvimento
- ✅ Concluído
- 🧪 Aguardando testes
