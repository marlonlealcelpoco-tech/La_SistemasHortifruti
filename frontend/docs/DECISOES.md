# LA Sistemas ERP — Decisões Técnicas do Frontend

## 2026-08-15 — Fundação do frontend

### Projeto oficial
O desenvolvimento do frontend oficial acontece no repositório `LA-SistamasERP`.

### Branch de desenvolvimento
A etapa atual utiliza `feature/financeiro-completo`. O `main` permanece preservado.

### Backend como fonte de verdade
Roles, autorização, regras de negócio, validações e persistência existentes no backend devem ser respeitados pelo frontend. Não criar uma segunda matriz de permissões no frontend.

### Autenticação
Utilizar a autenticação real do backend. Não substituir por autenticação fictícia baseada apenas em `localStorage`.

### Persistência
`localStorage` pode ser usado somente para preferências de interface quando necessário. Não usar como banco paralelo para dados do ERP.

### Interface
A interface deve ser modular e preparada para consumir as APIs existentes. O App Shell será construído antes das telas de negócio.

### Continuidade
Toda etapa relevante deve atualizar `PROGRESSO.md`, `MAPA-TELAS.md` e, quando necessário, `INTEGRACAO-API.md`.
