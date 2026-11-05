# 015 — Métricas, perfil e usuários no painel

| | |
|---|---|
| **Status** | Validado |
| **Fase** | 2 — Painel administrativo |
| **Depende de** | 010, 011 |
| **Dívidas atendidas** | DT-011, DT-015 |
| **ADRs relacionadas** | ADR-0003 |
| **Artefatos afetados** | Backend, Frontend, Orquestrador (docs e E2E) |
| **Planejado em** | 2026-11-05 |
| **Validado em** | 2026-11-05 por Ciro Macedo |
| **Executado em** | — |

---

## 1. Objetivo

Fechar o painel administrativo: dashboard com números reais do tour, tela de perfil para o
próprio usuário e tela de gestão de usuários para administradores. Depois deste plano,
nenhuma tarefa de rotina exige Swagger ou acesso ao banco.

## 2. Leia antes de começar

- `docs/03-artefato-backend.md`, `docs/04-artefato-frontend.md`, `docs/06-contrato-api.md`
- `docs/implementacoes-futuras/DT-011-dashboard-dados-reais.md`
- `docs/implementacoes-futuras/DT-015-gestao-usuarios-no-painel.md`

## 3. Estado esperado ao iniciar

Do código original (verificado em 2026-11-05):

- `services/backend/app/services/user_service.py:42-52` — `serialize_user` não devolve
  `id`.
- `services/backend/app/repositories/user_repository.py:26-72` — não há listagem,
  contagem nem busca por id.
- `services/backend/app/api/v1/routes/users.py:33-74` — `PUT /users/me` e
  `PUT /users/me/password` existem e estão testados, sem consumidor no painel.

Produzido por planos anteriores:

- **008** — `require_admin`, `ROLE_ADMIN`/`ROLE_USER` em `app/core/roles.py`;
  `POST /auth/register` exige admin.
- **010** — `GET /admin/metrics/overview` → `{points_total, points_published,
  visits_total, visits_last_7_days, visits_by_mode: {ar, vr}, top_points: [{slug, name,
  visits}]}`; `POST /public/points/{slug}/visits`.
- **011** — `AdminLayout`, `NAV_ITEMS`, `AuthContext` com `isAdmin` e `sessionNotice`,
  dashboard com cartão "As métricas do tour aparecerão aqui quando o plano 015 for
  concluído.", tipos gerados.
- **012** — `LoadingState`/`ErrorState`/`EmptyState`, `apiErrorMessage`.

## 4. Escopo

**Dentro:**

- backend: `GET /admin/users` (paginado) e `PATCH /admin/users/{user_id}`;
- painel: dashboard com `/admin/metrics/overview`;
- painel: `/perfil` (nome, username, troca de senha);
- painel: `/usuarios` (listar, criar, ativar/desativar, mudar papel);
- `AuthContext` expõe `updateUser` para refletir a edição do perfil.

**Fora:**

- excluir usuário — desativar basta e preserva histórico;
- convite por e-mail, recuperação de senha — sem servidor de e-mail;
- desabilitar `/docs` fora de desenvolvimento (DT-015, item 5) — registrar no DT como
  pendência remanescente;
- gráficos — números e lista bastam; sem biblioteca de gráfico.

## 5. Decisões tomadas no planejamento

| Questão | Decisão | Motivo |
|---|---|---|
| Listagem | `GET /admin/users?page=1&page_size=20` → `{items, total, page, page_size}`; `page_size` máx. 100; ordenado por `created_at` desc | Paginação desde o início (DT-015) |
| Item da listagem | `UserAdminResponse{id, email, username, full_name, role, is_active, created_at}` | Contrato fixado na visão macro |
| Alteração | `PATCH /admin/users/{user_id}` com `{is_active?, role?}`; corpo vazio → 400 | Uma rota para as duas ações |
| Autoproteção | Admin não pode desativar nem rebaixar a si mesmo → 400 "Você não pode remover o próprio acesso de administrador." | Evita ficar sem nenhum admin |
| `user_id` inválido ou inexistente | 404 "Usuário não encontrado." | Mesmo padrão dos pontos |
| Papel inválido | 422 pelo schema (`Literal["admin", "user"]`) | Validação declarativa |
| Criação | Formulário chama `POST /auth/register` (admin, plano 008); usuário nasce `user`; promoção pela tabela | Reaproveita rota existente; sem endpoint duplicado |
| Efeito de desativar | Imediato: `get_current_user` já recusa inativo com 403 | Comportamento existente (`deps.py:78-82`) |
| Efeito de mudar papel | Vale no próximo login (papel viaja no token) — aviso na tela | DT-008, nota |
| Perfil reflete no menu | `AuthContext.updateUser(user)` substitui o usuário após `PUT /users/me` | Sessão só via `useAuth()` |
| Senha no cliente | Mesma regra do backend: 8+ caracteres, letra e número; campo "Confirmar" | Feedback imediato |
| Menu | "Usuários" (`/usuarios`) e "Meu perfil" (`/perfil`) | Fecha o menu de DT-011 |

## 6. Passos de implementação

### Passo 1 — Schemas

**Repositório:** backend, branch `plano/015-metricas-perfil-usuarios`

**Arquivo:** `app/schemas/user.py` — acrescente:

```python
class UserAdminResponse(BaseModel):
    id: str
    email: EmailStr
    username: str | None
    full_name: str | None
    role: str
    is_active: bool
    created_at: datetime | None

class UserListResponse(BaseModel):
    items: list[UserAdminResponse]
    total: int
    page: int
    page_size: int

class UserAdminUpdate(BaseModel):
    is_active: bool | None = None
    role: Literal["admin", "user"] | None = None
```

Nenhum dos três tem campo de senha (convenção de segurança).

### Passo 2 — Repositório

**Arquivo:** `app/repositories/user_repository.py`

- `list_users(skip: int, limit: int) -> list[dict]` — `find({}).sort("created_at",
  -1).skip(skip).limit(limit)`.
- `count_users() -> int` — `count_documents({})`.
- `find_by_id(user_id: str) -> dict | None` — `ObjectId.is_valid` falso → `None`.
- `update_user_by_id(user_id: str, update_data: dict) -> dict | None`.

Todos traduzem `PyMongoError` em `ConnectionError`, como os existentes.

### Passo 3 — Serviço

**Arquivo:** `app/services/user_service.py`

- Constantes `DEFAULT_PAGE_SIZE = 20`, `MAX_PAGE_SIZE = 100`.
- `serialize_admin_user(doc)` → inclui `id = str(doc["_id"])`.
- `list_users(page, page_size)` → valida (`page >= 1`, `1 <= page_size <= 100`, senão
  `UserInputError`), devolve o dicionário de `UserListResponse`.
- `update_user_admin(current_user, user_id, payload)` → sem campos → `UserInputError`
  ("Nenhum campo valido para atualizacao."); alvo inexistente → `UserNotFoundError`; alvo
  é o próprio admin e (`is_active is False` ou `role == "user"`) → `UserInputError`
  (mensagem da seção 5); grava com `updated_at`.

### Passo 4 — Rotas

**Arquivo novo:** `app/api/v1/routes/admin_users.py` — `prefix="/admin/users"`,
`tags=["Admin - Usuarios"]`, ambas com `Depends(require_admin)`:

- `GET ""` → `UserListResponse`; query `page: int = 1`, `page_size: int = 20`.
- `PATCH "/{user_id}"` → `UserAdminResponse`.

Tradução: `UserInputError` → 400; `UserNotFoundError` → 404; `ConnectionError` →
`build_database_http_exception`. Registrar em `app/api/v1/router.py`.

### Passo 5 — Tipos e serviços no painel

**Repositório:** frontend, branch `plano/015-metricas-perfil-usuarios`

`npm run gen:types`; aliases em `src/types/index.ts`: `MetricsOverview`, `AdminUser`,
`UserList`, `UserAdminUpdate`, `UserUpdateMe`, `UserChangePassword`, `UserCreate`.

**Arquivos novos:**

- `src/services/metrics.ts` — `getMetricsOverview()`.
- `src/services/users.ts` — `listUsers(page, pageSize)`, `updateUserAdmin(id, payload)`,
  `createUser(payload)` (`POST /auth/register`).
- `src/services/profile.ts` — `updateMe(payload)`, `changeMyPassword(payload)`.
- `src/utils/validatePassword.ts` — regra da seção 5, mensagem "A senha deve ter pelo
  menos 8 caracteres e incluir letra e número."

### Passo 6 — `AuthContext.updateUser`

**Arquivo:** `src/contexts/AuthContext.tsx` — expõe `updateUser(user: User)` que faz
`setUser(user)`.

### Passo 7 — Dashboard com métricas reais

**Arquivos:** `src/pages/Dashboard.tsx`; novos `src/pages/dashboard/MetricCard.tsx`,
`src/pages/dashboard/MetricsGrid.tsx`, `src/pages/dashboard/TopPointsList.tsx`,
`src/hooks/useMetrics.ts`

- Remova o cartão provisório do 011.
- Cartões: "Pontos cadastrados", "Pontos publicados", "Visitas (total)", "Visitas nos
  últimos 7 dias", "Visitas AR / VR" (`ar` e `vr` lado a lado).
- "Pontos mais visitados": lista com nome e número; vazio → "Ainda não há visitas
  registradas.".
- Estados de carregando e erro; botão "Atualizar".
- Rótulos em `src/constants/metrics.ts`.

### Passo 8 — Perfil

**Arquivos novos:** `src/pages/profile/ProfilePage.tsx`, `ProfileForm.tsx`,
`PasswordForm.tsx`, `src/hooks/useProfileForm.ts`, `src/hooks/usePasswordForm.ts`

- `ProfileForm`: e-mail (somente leitura), nome completo, username; "Salvar" → `updateMe`
  → `updateUser(resposta)` → "Perfil atualizado.". `400` mostra o `detail` do backend.
- `PasswordForm`: senha atual, nova, confirmar; validação local; "Trocar senha" →
  `changeMyPassword` → limpa os campos e mostra "Senha atualizada com sucesso.". `400`
  ("Senha atual invalida.") aparece no campo senha atual.

### Passo 9 — Usuários

**Arquivos novos:** `src/pages/users/UsersPage.tsx`, `UsersTable.tsx`, `UserRow.tsx`,
`UserCreateForm.tsx`, `Pagination.tsx`, `src/hooks/useUsers.ts`

- Tabela: nome, e-mail, papel (`<select>` Administrador/Usuário), situação (selo
  "Ativo"/"Inativo") e botão "Desativar"/"Reativar".
- Na linha do próprio usuário: `select` e botão desabilitados, com a dica "Você".
- Mudança de papel: `confirm("Alterar o papel de <email>? A mudança vale no próximo
  login.")`.
- `UserCreateForm` (recolhível, botão "Novo usuário"): e-mail, nome, username, senha
  inicial; após criar, recarrega a lista e mostra "Usuário criado. Informe a senha inicial
  à pessoa.".
- `Pagination`: "Anterior"/"Próxima" e "Página X de Y", 20 por página.

### Passo 10 — Rotas e menu

`src/App.tsx`: `/perfil` e `/usuarios` dentro do `AdminLayout`. `NAV_ITEMS`:
`{ label: 'Usuários', to: '/usuarios', icon: Users, enabled: true }` e
`{ label: 'Meu perfil', to: '/perfil', icon: UserCircle, enabled: true }`.

### Passo 11 — E2E

**Repositório:** orquestrador. **Arquivo novo:** `e2e/tests/painel-gestao.spec.ts`

- `@golden dashboard conta a visita registrada` — cria e publica ponto pela API; lê
  "Visitas (total)" no dashboard; `POST /public/points/<slug>/visits` com `mode: "ar"`;
  clica "Atualizar"; o número aumenta em 1.
- `admin desativa usuário e ele não entra mais` — cria usuário pelo formulário; desativa;
  login com ele mostra erro de credenciais.
- `perfil atualiza o nome no menu` — troca o nome completo; a saudação do dashboard mostra
  o nome novo.

## 7. Testes

| Arquivo | Teste | Verifica |
|---|---|---|
| `tests/test_admin_users.py` | lista paginada (total, page, itens sem senha) | Listagem |
| `tests/test_admin_users.py` | `page_size=101` → 400; `page=0` → 400 | Limites |
| `tests/test_admin_users.py` | PATCH desativa outro usuário; PATCH promove a admin | Alteração |
| `tests/test_admin_users.py` | PATCH em si mesmo desativando/rebaixando → 400 | Autoproteção |
| `tests/test_admin_users.py` | id inválido → 404; corpo vazio → 400; role `"root"` → 422 | Erros |
| `tests/test_admin_users.py` | usuário comum → 403; sem token → 401; banco fora → 503 | Autorização e banco |
| `src/utils/validatePassword.test.ts` | curta, sem número, sem letra, válida | Regra |
| `src/pages/Dashboard.test.tsx` | mostra os 5 cartões com os valores; vazio de top pontos; erro | Métricas |
| `src/pages/profile/ProfilePage.test.tsx` | salvar chama `updateMe` e `updateUser`; senha divergente bloqueia; 400 no campo | Perfil |
| `src/pages/users/UsersPage.test.tsx` | lista; paginação muda a página; desativar chama o serviço; linha própria desabilitada; criar recarrega | Usuários |

Atualize o `Dashboard.test.tsx` do 011: ele deixa de procurar o cartão provisório.

```bash
cd services/backend && ruff check . && ruff format --check . && mypy app && pytest --cov=app --cov-fail-under=80
cd ../frontend && npm run lint && npm run format:check && npm run test:coverage && npm run build
cd ../.. && bash scripts/validate.sh
```

## 8. Documentação a atualizar

- [ ] `docs/06-contrato-api.md` — `GET /admin/users` e `PATCH /admin/users/{user_id}`,
      com exemplos e códigos
- [ ] `docs/03-artefato-backend.md` — novos métodos de repositório e serviço
- [ ] `docs/04-artefato-frontend.md` — rotas `/perfil` e `/usuarios`, dashboard real,
      tabela "fachada × real" sem itens ❌
- [ ] `docs/00-visao-geral.md` — estado: painel completo
- [ ] `docs/implementacoes-futuras/DT-011-...md` — `Resolvida` (plano 015)
- [ ] `docs/implementacoes-futuras/DT-015-...md` — `Resolvida`, com nota de que o item 5
      (desabilitar `/docs`) permanece como pendência
- [ ] `docs/implementacoes-futuras/README.md` — status no índice

## 9. Critérios de aceite

- [ ] Dashboard mostra contagens reais e reflete uma visita nova ao clicar "Atualizar"
- [ ] Usuário edita nome e username e troca a própria senha pelo painel
- [ ] Admin lista usuários com paginação, cria, desativa, reativa e muda papel
- [ ] Admin não consegue desativar nem rebaixar a si mesmo (botão desabilitado e 400 na API)
- [ ] Nenhuma resposta da API de usuários contém senha ou hash
- [ ] `bash scripts/validate.sh` passando com os 3 cenários E2E novos
- [ ] Documentação da seção 8 atualizada

## 10. Commits esperados

Backend:

```
feat(users): adiciona listagem e busca por id no repositorio de usuarios
feat(users): adiciona GET /admin/users paginado e PATCH /admin/users/{id}
```

Frontend:

```
feat(dashboard): exibe metricas reais do tour
feat(profile): cria tela de perfil com troca de senha
feat(users): cria tela de gestao de usuarios
feat(nav): adiciona Usuarios e Meu perfil ao menu
```

Orquestrador:

```
test(e2e): cobre metricas, gestao de usuarios e perfil
docs: documenta gestao de usuarios; resolve DT-011 e DT-015
```

## 11. Riscos e pontos de atenção

- **Admin se trancar fora:** a autoproteção precisa existir no backend, não só no botão.
- **Comparação "é o próprio usuário":** compare `str(current_user["_id"])` com `user_id`.
- **`created_at` ausente** em documentos antigos: o schema aceita `None`; a ordenação os
  coloca no fim.
- **Contagem de visitas no E2E** muda com outros testes: compare antes e depois, nunca um
  número absoluto.
- **Limites de lint:** a tela de usuários tende a crescer; mantenha a lógica em `useUsers`.

## 12. Verificação pelo aluno

1. `bash scripts/up.sh`, abra `http://localhost:3000` e entre como administrador.
2. O dashboard mostra números de pontos e visitas (podem ser zero) — nada de "124".
3. Clique em "Meu perfil", troque o nome completo e salve. A saudação do dashboard muda.
4. Clique em "Usuários" → "Novo usuário", crie um colega com uma senha como `senha1234`.
5. Na linha dele, clique "Desativar". Abra uma janela anônima e tente entrar com ele:
   não consegue.
6. Na sua própria linha, o botão aparece desabilitado com "Você".

---

## Prompt de delegação

Cole no Claude Code, na pasta `quest-project`, trocando o nome:

```text
Você é a sessão de EXECUÇÃO do projeto TourVR.
Execute o plano docs/tasks/015-metricas-perfil-usuarios.md.
Antes de qualquer ação, leia docs/tasks/protocolo-execucao.md e siga o "Prompt 1 — EXECUTAR" etapa por etapa.
Meu nome, para registrar no plano: <SEU NOME>
```
