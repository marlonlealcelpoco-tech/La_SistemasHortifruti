# LA Sistemas ERP — Identidade Visual do Frontend

## Referência visual oficial

**Arquivo oficial:** `frontend/docs/sistemaerp.pdf`

O arquivo `sistemaerp.pdf` é a **referência visual oficial e permanente do frontend** do LA Sistemas ERP. Ele deve ser consultado sempre que houver uma decisão relacionada à aparência, identidade visual ou composição do App Shell e das telas futuras.

### Regra de uso da referência
O PDF/PowerPoint fornecido pelo projeto é utilizado **exclusivamente como referência de identidade visual**.

### O que deve ser preservado da referência
- Logo LA-SISTEMAS no cabeçalho, com tratamento colorido conforme a referência.
- Marca d'água/logo LA na área principal da aplicação.
- Linguagem visual corporativa, limpa e organizada.
- Proporções, espaçamentos, hierarquia visual e composição geral inspiradas na referência.
- Aparência consistente entre as telas futuras.
- Sempre que possível, consultar diretamente `sistemaerp.pdf` antes de decidir mudanças visuais relevantes.

### O que NÃO deve ser copiado da referência
Os botões, módulos, ações e funcionalidades mostrados no material visual **não são especificação funcional do ERP**.

A existência de um botão ou tela no PDF não autoriza a criação de uma funcionalidade que não esteja prevista nas regras e contratos reais do backend.

### Fonte funcional
As funcionalidades, menus, ações, permissões, validações e fluxos devem seguir exclusivamente os contratos e regras do backend existentes no branch `feature/financeiro-completo`.

**Regra resumida:**

> **PDF = aparência. Backend = comportamento.**

### App Shell
O App Shell é a estrutura visual base sobre a qual serão encaixadas as telas reais do ERP. A identidade visual do `sistemaerp.pdf` deve ser preservada enquanto as funcionalidades e opções de navegação são construídas conforme o backend.

### Continuidade
Qualquer alteração relevante na identidade visual ou no App Shell deve ser registrada em `PROGRESSO.md` e, quando afetar a estrutura de navegação/telas, em `MAPA-TELAS.md`.

Em caso de retomada do projeto após uma interrupção, consultar primeiro:
1. `REGRAS-DESENVOLVIMENTO.md`
2. `PROGRESSO.md`
3. `IDENTIDADE-VISUAL.md`
4. `sistemaerp.pdf`
5. `APP-SHELL-VISUAL.md`

Essa ordem evita que a referência visual seja confundida com regra funcional.
