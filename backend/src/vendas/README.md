# Vendas / PDV

Módulo ativo migrado de `src/sales` para `src/vendas`.

## Regras implementadas

- Venda vinculada ao usuário/caixa aberto.
- Validação e baixa de estoque dentro da mesma transação da venda.
- Venda à vista gera movimento no caixa.
- Venda a prazo gera Conta a Receber.
- Recebimentos podem ser parciais e são feitos pelo caixa, atualizando simultaneamente Conta a Receber, caixa e financeiro.
- A venda pode escolher documento `FISCAL` ou `GERENCIAL`.
- NFC-e é desacoplada do financeiro: a venda continua confirmada mesmo se a NFC-e for rejeitada.
- Rejeições fiscais ficam pendentes com código, mensagem e tentativas para retransmissão pelo emissor fiscal.
- Fechamento do caixa mantém conferência, sangria, suprimentos e diferença entre saldo esperado e contado.

A emissão efetiva junto à SEFAZ permanece como integração externa; o backend já possui o estado e o histórico necessários para a retransmissão sem duplicar a venda ou os movimentos financeiros.
