# Regras Permanentes de Desenvolvimento do Frontend

## Regra obrigatória de continuidade
Toda implementação feita no frontend deve deixar um registro permanente dentro de `frontend/docs/`.

Nenhuma etapa deve ser considerada concluída sem atualizar a documentação correspondente.

## O registro de cada etapa deve conter
1. Data da implementação.
2. Objetivo.
3. Funcionalidades desenvolvidas.
4. Arquivos criados, alterados ou removidos.
5. APIs/endpoints utilizados.
6. Regras do backend respeitadas.
7. Testes executados e resultado.
8. Problemas encontrados e correções.
9. Commit(s) relacionados.
10. Status atual.
11. Próximo passo recomendado.
12. Observações necessárias para uma futura retomada.

## Regra de retomada
No início de qualquer nova sessão de desenvolvimento, consultar obrigatoriamente:
- `PROGRESSO.md`
- `MAPA-TELAS.md`
- `INTEGRACAO-API.md`
- `DECISOES.md`
- este arquivo

Depois da consulta, continuar a partir do último item registrado como pendente ou em desenvolvimento.

## Regra de branch
O frontend desta etapa deve ser desenvolvido em `feature/financeiro-completo`. O `main` permanece preservado até existir uma decisão explícita de integração.

## Regra de backend
O backend é a fonte oficial de verdade para autenticação, autorização, roles, validações, regras de negócio e persistência. O frontend não deve criar uma regra paralela para substituir a API.

## Regra de integração
Toda tela nova deve ser relacionada ao endpoint real correspondente e registrada em `INTEGRACAO-API.md` e `MAPA-TELAS.md`.

## Regra de qualidade
Antes de marcar uma etapa como concluída, verificar build, testes aplicáveis, navegação e integração com a API quando disponível.
