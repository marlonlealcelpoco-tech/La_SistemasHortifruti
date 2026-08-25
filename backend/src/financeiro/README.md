# Financeiro

Módulo financeiro migrado da estrutura legada `src/finance` para `src/financeiro`.

A implementação ativa é registrada pelo `app.ts` através de `FinanceRepository` e `registerFinanceRoutes`.

O diretório legado `src/finance` permanece preservado durante a fase de validação e só deve ser removido após typecheck, testes, CI e verificação final de dependências.

CI migration validation marker: 2026-08-25