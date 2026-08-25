# Vendas / PDV

Módulo ativo em `src/vendas`; o legado `src/sales` foi removido após validação do CI.

## Regras
- Venda vinculada ao usuário/caixa aberto.
- Validação e baixa de estoque na mesma transação.
- Venda à vista movimenta caixa.
- Venda a prazo gera Conta a Receber.
- Recebimentos parciais são feitos pelo caixa e atualizam Conta a Receber, caixa e financeiro.
- A venda pode ser fiscal ou gerencial sem alterar o fluxo financeiro.
- NFC-e rejeitada permanece pendente com histórico para retransmissão, sem duplicar venda ou movimentos.
- Caixa contempla abertura, sangria, suprimento, fechamento e conferência.

A emissão efetiva junto à SEFAZ permanece como integração externa.