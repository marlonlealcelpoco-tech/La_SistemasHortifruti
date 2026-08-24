# Reestruturação do Backend — LA Sistemas Hortifruti

## Objetivo

Reorganizar o backend por módulos de negócio, preservando integralmente as regras já implementadas e validadas no `main`. A reestruturação acontece exclusivamente na branch `refactor/backend-modular` até que todos os testes e o CI estejam verdes.

## Regra de segurança

- O `main` não deve ser alterado durante esta transição.
- Nenhuma regra de negócio deve ser recriada sem necessidade.
- O código existente deve ser reaproveitado e apenas reorganizado/refatorado quando necessário.
- Cada etapa deve ter typecheck e testes antes da próxima etapa.
- O código antigo só deve ser removido depois que o novo caminho estiver validado.

## Arquitetura-alvo

```text
backend/src/
├── auth/
├── cadastro/
│   ├── usuarios/
│   ├── clientes/
│   ├── fornecedores/
│   └── produtos/
├── compras/
│   ├── compras/
│   ├── notas/
│   └── xml/
├── vendas/
│   ├── pdv/
│   ├── vendas/
│   ├── devolucoes/
│   └── contas-a-prazo/
├── caixa/
│   ├── abertura/
│   ├── movimentos/
│   ├── sangria/
│   ├── recebimentos/
│   └── fechamento/
├── estoque/
│   ├── entradas/
│   ├── saidas/
│   ├── ajustes/
│   ├── avarias/
│   └── inventario/
├── financeiro/
│   ├── contas-pagar/
│   ├── contas-receber/
│   ├── fluxo-caixa/
│   ├── dre/
│   └── conciliacao/
├── fiscal/
│   ├── nfe/
│   ├── nfce/
│   └── tributacao/
├── relatorios/
├── shared/
│   ├── database/
│   ├── errors/
│   ├── auth/
│   ├── audit/
│   └── utils/
└── server.ts
```

## Mapeamento atual → destino

| Código atual | Destino planejado | Situação |
|---|---|---|
| `auth/` | `auth/` | Preservar inicialmente |
| `users/` | `cadastro/usuarios/` | A migrar |
| `customers/` | `cadastro/clientes/` | A migrar; preservar regras de crédito |
| `parties/` | `cadastro/clientes/` e `cadastro/fornecedores/` | Separar responsabilidades |
| `products/` | `cadastro/produtos/` | A migrar; preservar dados fiscais |
| `purchases/` | `compras/` | Preservar e reorganizar internamente |
| `inventory/` | `estoque/` | A migrar |
| `sales/` | `vendas/` | A migrar |
| `cash/` | `caixa/` | A migrar |
| `finance/` | `financeiro/` | A migrar |
| regras fiscais | `fiscal/` | A mapear/separar sem perder integrações |
| `operations/` | Conforme responsabilidade encontrada | A mapear |
| `integration/` | `shared/` ou módulo específico | A mapear |
| `db/` | `shared/database/` | A migrar quando seguro |

## Regras de negócio que devem ser preservadas

### Autenticação e hierarquia

- Login e JWT.
- `/auth/me`.
- Catálogo oficial de perfis.
- Autorização por perfil.
- ADMIN com gerenciamento de usuários e perfis.
- Testes já validados do Módulo 1.

### Cadastro

- Clientes: criação, listagem, pesquisa, edição, ativação/desativação e validações.
- Crédito do cliente e regras de venda a prazo.
- Fornecedores: criação, listagem, pesquisa, edição e status.
- Produtos: cadastro, preço de venda, custo, estoque mínimo e status.
- Dados fiscais do produto necessários para emissão fiscal, incluindo os campos já existentes no código.

### Compras e entrada de mercadoria

Uma entrada pode ser feita por:

1. XML de NF-e; ou
2. Nota/manual de compra quando não houver XML.

A nota deve permanecer armazenada para rastreabilidade histórica.

Ao confirmar uma compra, a operação deve manter o fluxo existente e planejado:

```text
Nota de compra
    ↓
Produtos da nota
    ↓
Entrada no estoque
    ↓
Atualização da quantidade existente
    ↓
Financeiro / conta a pagar quando aplicável
    ↓
Auditoria
```

Essas alterações devem ser transacionais para evitar estoque atualizado sem o respectivo financeiro, ou vice-versa.

### Vendas e contas a prazo

- Venda a prazo nasce no caixa através da venda.
- Cliente deve possuir autorização/crédito conforme regra existente.
- Venda gera a obrigação do cliente.
- Cliente pode pagar parcialmente ou integralmente.
- Recebimento ocorre no caixa aberto.
- O valor recebido entra na sessão do caixa.
- A baixa da conta a receber é automática.
- Deve ficar registrado quem recebeu, em qual caixa, quando e quanto.

### Caixa

- Abertura de caixa.
- Valor inicial.
- Movimentos.
- Sangria.
- Recebimentos.
- Fechamento.
- Suporte a múltiplos caixas simultâneos através de sessões independentes, sem duplicar código para Caixa 1/Caixa 2.

### Estoque

- Entradas.
- Saídas.
- Ajustes.
- Avarias/perdas.
- Inventário.
- Histórico e rastreabilidade da origem da entrada.

### Financeiro

- Contas a pagar.
- Contas a receber.
- Fluxo de caixa.
- DRE.
- Conciliação.
- Integração automática com as operações que geram obrigações ou recebimentos.

## Checkpoints da transição

### Checkpoint 0 — Proteção

- [x] Criar branch `refactor/backend-modular`.
- [x] Manter `main` intacto.
- [x] Definir arquitetura-alvo.
- [x] Criar este documento de continuidade.

### Checkpoint 1 — Inventário e estrutura

- [x] Mapear módulos atuais principais.
- [ ] Criar estrutura de diretórios-alvo.
- [ ] Documentar dependências entre módulos.
- [ ] Não alterar comportamento funcional.
- [ ] Rodar typecheck.
- [ ] Rodar CI.

### Checkpoint 2 — Auth e usuários

- [ ] Migrar `users/` para `cadastro/usuarios/`.
- [ ] Manter `auth/` estável.
- [ ] Ajustar imports.
- [ ] Reexecutar testes do Módulo 1.
- [ ] CI verde.

### Checkpoint 3 — Clientes e fornecedores

- [ ] Separar `parties/`.
- [ ] Integrar `customers/` e regras de crédito em `cadastro/clientes/`.
- [ ] Criar `cadastro/fornecedores/`.
- [ ] Preservar autorização por perfil.
- [ ] Testes funcionais.
- [ ] CI verde.

### Checkpoint 4 — Produtos e fiscal

- [ ] Migrar `products/` para `cadastro/produtos/`.
- [ ] Preservar campos fiscais.
- [ ] Preservar regras de preço/custo/margem.
- [ ] Separar responsabilidades fiscais sem quebrar produtos.
- [ ] Testes fiscais e funcionais.
- [ ] CI verde.

### Checkpoint 5 — Compras

- [ ] Reorganizar `purchases/` em `compras/`.
- [ ] Preservar compra manual.
- [ ] Preservar importação XML.
- [ ] Preservar nota histórica.
- [ ] Preservar vinculação produto/fornecedor.
- [ ] Garantir entrada de estoque e geração financeira de forma transacional.
- [ ] Testes de compra/XML.
- [ ] CI verde.

### Checkpoint 6 — Estoque

- [ ] Migrar `inventory/` para `estoque/`.
- [ ] Preservar entradas, saídas, ajustes, avarias e inventário.
- [ ] Validar rastreabilidade da origem das entradas.
- [ ] Testes.
- [ ] CI verde.

### Checkpoint 7 — Vendas e caixa

- [ ] Migrar `sales/` para `vendas/`.
- [ ] Migrar `cash/` para `caixa/`.
- [ ] Preservar abertura/fechamento/sangria.
- [ ] Preservar venda a prazo.
- [ ] Preservar recebimento parcial/integral.
- [ ] Validar dois caixas simultâneos.
- [ ] Testes.
- [ ] CI verde.

### Checkpoint 8 — Financeiro

- [ ] Migrar `finance/` para `financeiro/`.
- [ ] Validar integração com compras.
- [ ] Validar integração com vendas a prazo.
- [ ] Validar recebimentos do caixa.
- [ ] Testes.
- [ ] CI verde.

### Checkpoint 9 — Shared e infraestrutura

- [ ] Consolidar banco em `shared/database/`.
- [ ] Consolidar erros comuns.
- [ ] Consolidar auditoria.
- [ ] Consolidar autenticação compartilhada sem duplicar `auth/`.
- [ ] Consolidar utilitários.
- [ ] Remover somente arquivos antigos já comprovadamente substituídos.
- [ ] Typecheck.
- [ ] CI completo verde.

### Checkpoint 10 — Finalização

- [ ] Comparar branch com `main`.
- [ ] Confirmar que nenhuma regra de negócio foi perdida.
- [ ] Executar todos os testes de integração.
- [ ] Executar testes fiscais.
- [ ] Executar testes de cadastro.
- [ ] Executar testes de autenticação/hierarquia.
- [ ] Executar testes de compras/XML.
- [ ] Executar testes de estoque.
- [ ] Executar testes de vendas/caixa.
- [ ] Executar testes financeiros.
- [ ] CI totalmente verde.
- [ ] Revisar este documento e registrar resultado final.
- [ ] Criar PR da `refactor/backend-modular` para `main` somente após aprovação.

## Como continuar em outro dia

Antes de iniciar qualquer nova alteração:

1. Abrir este arquivo.
2. Verificar o último checkpoint marcado.
3. Conferir o CI mais recente da branch.
4. Não iniciar uma etapa nova se a etapa anterior estiver vermelha.
5. Continuar exatamente do primeiro item `[ ]` do checkpoint atual.
6. Atualizar este arquivo após cada alteração relevante.
7. Registrar o commit/CI relacionado quando disponível.

## Estado atual

**Branch:** `refactor/backend-modular`

**Situação:** reestruturação iniciada; código original preservado; inventário inicial realizado.

**Próxima ação:** Checkpoint 1 — criar a estrutura de diretórios-alvo e preparar a migração sem alterar as regras de negócio.

## Regra para conclusão

A reestruturação só será considerada concluída quando o backend modular estiver funcionalmente equivalente ao backend atual, todos os testes relevantes estiverem verdes e o CI completo estiver verde.
