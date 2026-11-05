# 011 — Base do painel

| | |
|---|---|
| **Status** | Validado |
| **Fase** | 2 — Painel administrativo |
| **Depende de** | 008 |
| **Dívidas atendidas** | DT-010, DT-011 (etapa imediata), DT-012 |
| **ADRs relacionadas** | ADR-0003 (JWT), ADR-0007 |
| **Artefatos afetados** | Frontend, Orquestrador (docs e E2E) |
| **Planejado em** | 2026-11-05 |
| **Validado em** | 2026-11-05 por Ciro Macedo |
| **Executado em** | — |

---

## 1. Objetivo

Preparar o painel para receber as telas de gestão do tour: layout com menu que navega de
verdade, sessão que reage a token expirado, acesso restrito a administradores, tipos da API
gerados do OpenAPI e um dashboard que não exibe números falsos. Todas as telas dos planos
012 a 015 se apoiam nesta base.

## 2. Leia antes de começar

- `docs/04-artefato-frontend.md`
- `docs/06-contrato-api.md`
- `docs/implementacoes-futuras/DT-010-tratamento-global-erros-frontend.md`
- `docs/implementacoes-futuras/DT-011-dashboard-dados-reais.md`
- `docs/implementacoes-futuras/DT-012-contrato-api-tipado.md`

## 3. Estado esperado ao iniciar

Do código original (verificado em 2026-11-05):

- `src/services/api.ts:26-34` — só existe interceptor de **request**; nenhum
  `interceptors.response`.
- `src/services/api.ts:3` — chave de armazenamento `@OculosVR:token`.
- `src/types/index.ts:1-9` — `User` escrito à mão, sem `is_verified`.
- `src/pages/Dashboard.tsx:5-15` — itens de menu como `<div>` sem rota e métricas
  literais (`'124'`, `'12'`, `'89'`).
- `src/pages/Login.tsx:65-79` — aviso "Primeiro acesso ao MVP? ... /docs - POST
  /auth/register".
- `index.html:6`, `Login.tsx:61`, `Dashboard.tsx:31` — nome "OculosVR".

Produzido por planos anteriores:

- **004** — `strict: true`, ESLint `strictTypeChecked` com `max-lines` 200 e
  `max-lines-per-function` 60, Prettier, Vitest com cobertura mínima de 80%; `Login.tsx` e
  `Dashboard.tsx` já decompostos em componentes menores; scripts `lint`, `format:check`,
  `test`, `test:coverage`, `build`.
- **005** — `bash scripts/validate.sh`, E2E em `e2e/` com `tests/login.spec.ts` (`@golden`)
  e `support/api.ts`.
- **008** — `POST /auth/register` exige papel `admin`; `python -m app.cli create-admin`;
  rotas `/admin/...` respondem `403` a quem não é admin. O helper de E2E já cria o admin
  pela CLI.

Se a decomposição feita no 004 tiver nomes de arquivo diferentes dos citados nos passos
abaixo, localize o componente equivalente e aplique a mudança nele — a mudança é a mesma.

## 4. Escopo

**Dentro:**

- interceptor de resposta para `401` com aviso de sessão expirada;
- acesso ao painel só para `role === "admin"`;
- `AdminLayout` com menu `NavLink` e rotas aninhadas;
- tipos gerados do OpenAPI (`src/types/api.d.ts`) e script `gen:types`;
- dashboard honesto (sem números inventados);
- troca do nome "OculosVR" por "TourVR Admin";
- remoção do aviso de cadastro via `/docs`.

**Fora:**

- telas de pontos (012), mídia (013), QR (014), métricas reais, perfil e usuários (015);
- refresh token e cookie `httpOnly` (DT-007, fora de escopo da visão macro);
- verificação em CI de que os tipos gerados estão atualizados — o arquivo gerado é
  versionado e qualquer diferença aparece no diff do PR, o que basta nesta fase;
- mudar a chave do `localStorage` (`@OculosVR:token`): trocar derrubaria a sessão de todos
  sem ganho; fica como está.

## 5. Decisões tomadas no planejamento

| Questão | Decisão | Motivo |
|---|---|---|
| Como o interceptor avisa o React | `api.ts` exporta `setUnauthorizedHandler(fn)`; o `AuthProvider` registra o handler no `useEffect` | DT-010: não acoplar o módulo HTTP ao React |
| Quais `401` disparam o handler | Todos, **exceto** os da própria `POST /auth/login` | Credencial errada no login deve mostrar a mensagem do backend |
| `403` | Não desloga; quem trata é a tela que chamou | `403` em `/admin` significa papel insuficiente, não sessão expirada |
| Aviso de sessão expirada | `AuthContext` expõe `sessionNotice: string \| null`; `Login` exibe e limpa | Sem biblioteca de toast; estado local + Context |
| Usuário logado sem papel admin | `ProtectedRoute` renderiza `AccessDenied` ("Acesso restrito a administradores.") com botão "Sair" | O token é válido; só não serve para o painel |
| Gerador de tipos | `openapi-typescript` (devDependency), saída `src/types/api.d.ts`, versionada | Garante o contrato sem escrever tipos à mão |
| Aliases legíveis | `src/types/index.ts` reexporta `User = components['schemas']['UserMeResponse']` etc. | Componentes não precisam conhecer a estrutura do OpenAPI |
| Itens de menu de telas futuras | Aparecem desabilitados (cinza, `aria-disabled`, sem link) com rótulo "em breve" | DT-011: menu ou navega, ou está visivelmente desabilitado |
| Métricas no dashboard | Removidas; um cartão "Métricas chegam no plano 015" | Nenhum número falso até haver dado real |

## 6. Passos de implementação

Todos no submódulo `services/frontend`, branch `plano/011-base-do-painel`, salvo indicação.

### Passo 1 — Interceptor de resposta

**Arquivo:** `src/services/api.ts`

Acrescente, abaixo do interceptor de request:

```ts
type UnauthorizedHandler = () => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  unauthorizedHandler = handler;
}

const LOGIN_PATH = '/auth/login';
const HTTP_UNAUTHORIZED = 401;

api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error)) {
      const isLogin = error.config?.url === LOGIN_PATH;
      if (error.response?.status === HTTP_UNAUTHORIZED && !isLogin) {
        clearAuthToken();
        unauthorizedHandler?.();
      }
    }
    return Promise.reject(error);
  },
);
```

Remova `API_DOCS_URL` (deixa de ser usado no passo 5).

### Passo 2 — `AuthContext` reage ao `401`

**Arquivo:** `src/contexts/AuthContext.tsx`

- Novo estado `sessionNotice` e função `clearSessionNotice`, expostos no contexto.
- `useEffect` que registra `setUnauthorizedHandler(() => { setUser(null);
  setSessionNotice('Sua sessão expirou. Entre novamente.'); })` e o remove no cleanup
  (`setUnauthorizedHandler(null)`).
- Novo campo derivado `isAdmin: user?.role === 'admin'`.
- Constantes de texto em `src/constants/messages.ts` (`SESSION_EXPIRED_MESSAGE`,
  `ACCESS_DENIED_MESSAGE = 'Acesso restrito a administradores.'`).

### Passo 3 — Guard de papel

**Arquivos:** `src/components/ProtectedRoute.tsx`, novo `src/components/AccessDenied.tsx`

`ProtectedRoute`: carregando → `FullScreenLoader`; sem sessão → `Navigate` para `/login`;
com sessão e `!isAdmin` → `<AccessDenied />`; admin → `<Outlet />`.

`AccessDenied`: título "Acesso restrito a administradores.", texto "Peça a um
administrador do TourVR para liberar seu acesso.", botão "Sair" que chama `signOut()`.

### Passo 4 — Layout com menu

**Arquivos novos:** `src/layouts/AdminLayout.tsx`, `src/layouts/SidebarNav.tsx`,
`src/constants/navigation.ts`

`navigation.ts`:

```ts
export interface NavItem { label: string; to: string; icon: LucideIcon; enabled: boolean }

export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard, enabled: true },
  { label: 'Pontos', to: '/pontos', icon: MapPin, enabled: false },
];
```

Os planos 012, 014 e 015 trocam `enabled` para `true` e acrescentam itens. `SidebarNav`
renderiza `NavLink` para itens habilitados (classe ativa `bg-indigo-50 text-indigo-700`) e
`<span aria-disabled="true">` com o texto "em breve" para os demais. `AdminLayout`:
barra lateral (título "TourVR Admin", `SidebarNav`, botão "Sair do sistema") e `<main>`
com `<Outlet />`. Reaproveite o markup da barra lateral que o 004 extraiu do `Dashboard`
e apague a cópia antiga.

**Arquivo:** `src/App.tsx`

```tsx
<Route element={<ProtectedRoute />}>
  <Route element={<AdminLayout />}>
    <Route path="/dashboard" element={<Dashboard />} />
  </Route>
</Route>
```

### Passo 5 — Login sem aviso de `/docs` e com aviso de sessão

**Arquivo:** a página `Login` e seus subcomponentes (decompostos no 004)

- Remova o bloco "Primeiro acesso ao MVP?" inteiro. No lugar, texto pequeno: "Não tem
  acesso? Fale com um administrador do TourVR."
- Se `sessionNotice` existir, exiba-o em caixa amarela acima do formulário e chame
  `clearSessionNotice()` ao enviar o formulário.
- Títulos: "TourVR" e "Painel administrativo".

### Passo 6 — Dashboard honesto

**Arquivo:** `src/pages/Dashboard.tsx` (e subcomponentes)

- Remova `dashboardMetrics` e os cartões de números.
- Mantenha a saudação com o nome.
- Um cartão informativo: "As métricas do tour aparecerão aqui quando o plano 015 for
  concluído." (texto em `src/constants/messages.ts`).
- Remova o bloco JSON de `/users/me` (era ferramenta de depuração).
- A barra lateral sai do `Dashboard` (já está no `AdminLayout`).

### Passo 7 — Tipos gerados do OpenAPI

```bash
npm install -D openapi-typescript
```

**Arquivo novo:** `scripts/gen-types.mjs` (na raiz do submódulo)

```js
// Gera os tipos TypeScript a partir do OpenAPI do backend.
// Script em Node (e nao em sintaxe de shell) porque o npm no Windows roda scripts pelo cmd.exe.
import { execSync } from 'node:child_process';

const base = process.env.VITE_API_URL ?? 'http://localhost:8000';
execSync(`npx openapi-typescript ${base}/openapi.json -o src/types/api.d.ts`, { stdio: 'inherit' });
```

**Arquivo:** `package.json` — script:

```json
"gen:types": "node scripts/gen-types.mjs"
```

Com o backend rodando (`bash scripts/up.sh` no orquestrador), rode `npm run gen:types` e
**versione** `src/types/api.d.ts`. Acrescente `src/types/api.d.ts` ao `ignores` do ESLint
e ao `.prettierignore` (arquivo gerado).

**Arquivo:** `src/types/index.ts`

```ts
import type { components } from './api';

type Schemas = components['schemas'];
export type User = Schemas['UserMeResponse'];
export type AuthResponse = Schemas['TokenResponse'];
export type LoginPayload = Schemas['UserLogin'];
```

Confira os nomes exatos dos schemas no arquivo gerado. `User` passa a ter `is_verified`.
Corrija o que o `tsc` apontar.

### Passo 8 — Nome do produto

`index.html:6` → `<title>TourVR Admin</title>`. Procure `OculosVR` em `src/` e troque
por `TourVR` (exceto a chave do `localStorage`, ver seção 4).

### Passo 9 — E2E

**Repositório:** orquestrador, branch `plano/011-base-do-painel`

**Arquivo novo:** `e2e/tests/painel-base.spec.ts`

- `@golden admin entra e vê o layout com menu` — cria admin pelo helper, faz login, vê
  "TourVR Admin" e o link "Dashboard".
- `usuário comum vê acesso restrito` — com o admin, cria usuário comum via `POST
  /auth/register`; entra com ele; vê "Acesso restrito a administradores.".
- `token inválido leva ao login com aviso` — após login, troca o token no
  `localStorage` por `"invalido"`, recarrega e navega; espera a tela de login.

## 7. Testes

| Arquivo | Teste | Verifica |
|---|---|---|
| `src/services/api.test.ts` | 401 chama o handler e limpa o token | Interceptor |
| `src/services/api.test.ts` | 401 de `/auth/login` **não** chama o handler | Exceção do login |
| `src/services/api.test.ts` | 403 e 500 não chamam o handler | Escopo do interceptor |
| `src/contexts/AuthContext.test.tsx` | handler registrado zera o usuário e define `sessionNotice` | Integração com o contexto |
| `src/components/ProtectedRoute.test.tsx` | não-admin vê `AccessDenied`; admin vê o conteúdo | Guard de papel |
| `src/layouts/SidebarNav.test.tsx` | item habilitado é link; desabilitado tem `aria-disabled` e "em breve" | Menu honesto |
| `src/pages/Login.test.tsx` | exibe `sessionNotice`; não exibe mais "/docs" | Aviso e remoção |
| `src/pages/Dashboard.test.tsx` | não contém "124", "12", "89" | Sem números falsos |

Para testar o interceptor, sem dependência nova: chame diretamente o *rejected handler*
registrado em `api.interceptors.response` com um `AxiosError` construído no teste.

No `AuthProvider`, declare o `useEffect` que registra o handler **antes** do `useEffect`
de restauração de sessão, para que um `401` em `GET /users/me` na recarga já encontre o
handler registrado.

```bash
cd services/frontend && npm run lint && npm run format:check && npm run test:coverage && npm run build
cd ../.. && bash scripts/validate.sh
```

## 8. Documentação a atualizar

- [ ] `docs/04-artefato-frontend.md` — estrutura (`layouts/`, `constants/`, `types/api.d.ts`),
      rotas, fluxo de 401, guard de papel, script `gen:types`, tabela "fachada × real"
- [ ] `docs/07-convencoes.md` — seção Frontend: "tipos da API vêm de `npm run gen:types`;
      não escrever interface de contrato à mão"
- [ ] `docs/implementacoes-futuras/DT-010-...md` e `DT-012-...md` — `Resolvida` (plano 011)
- [ ] `docs/implementacoes-futuras/DT-011-...md` — anotar que a etapa imediata foi feita no
      011; continua `Aberta` até o 015
- [ ] `docs/implementacoes-futuras/README.md` — status no índice

## 9. Critérios de aceite

- [ ] Token expirado ou inválido leva ao `/login` com "Sua sessão expirou. Entre novamente."
- [ ] Senha errada no login continua mostrando a mensagem do backend, sem aviso de sessão
- [ ] Usuário sem papel admin não acessa nenhuma tela do painel
- [ ] Menu navega ou está visivelmente desabilitado
- [ ] Nenhum número fictício na interface
- [ ] `src/types/api.d.ts` gerado e versionado; `User` inclui `is_verified`
- [ ] Nenhuma ocorrência de "OculosVR" visível ao usuário
- [ ] `bash scripts/validate.sh` passando, com os 3 cenários E2E novos
- [ ] Documentação da seção 8 atualizada

## 10. Commits esperados

Frontend:

```
feat(api): adiciona interceptor de 401 com handler registravel
feat(auth): avisa sessao expirada e restringe o painel a administradores
feat(layout): cria AdminLayout com menu de navegacao real
fix(dashboard): remove metricas ficticias e aviso de cadastro via /docs
build: gera tipos da API a partir do OpenAPI
chore: renomeia OculosVR para TourVR na interface
```

Orquestrador:

```
test(e2e): cobre layout, acesso restrito e sessao expirada
docs: atualiza frontend e convencoes; resolve DT-010 e DT-012
```

## 11. Riscos e pontos de atenção

- **`gen:types` exige backend no ar.** Suba a pilha com `bash scripts/up.sh` antes.
- **Nomes de schema no OpenAPI** podem ter sufixos (`UserMeResponse-Output`). Use os nomes
  que aparecerem em `api.d.ts`; não renomeie schemas no backend neste plano.
- **Loop de redirecionamento:** o handler não deve chamar `navigate`; zerar o `user` basta
  para o `ProtectedRoute` mandar ao `/login`.
- **StrictMode** monta efeitos duas vezes em desenvolvimento: o cleanup do `useEffect` que
  registra o handler é obrigatório.

## 12. Verificação pelo aluno

1. Rode `bash scripts/up.sh` no terminal e abra `http://localhost:3000`.
2. A tela de login mostra "TourVR" e **não** fala mais em `/docs`.
3. Entre com o administrador (o agente informa o e-mail e a senha que criou). Aparece um
   menu à esquerda com "Dashboard" e "Pontos (em breve)".
4. O dashboard não mostra mais "124", "12" nem "89".
5. Aperte F12 → aba *Application* → *Local Storage* → apague a chave `@OculosVR:token` e
   clique em "Dashboard" no menu. Você volta ao login com o aviso "Sua sessão expirou".

---

## Prompt de delegação

Cole no Claude Code, na pasta `quest-project`, trocando o nome:

```text
Você é a sessão de EXECUÇÃO do projeto TourVR.
Execute o plano docs/tasks/011-base-do-painel.md.
Antes de qualquer ação, leia docs/tasks/protocolo-execucao.md e siga o "Prompt 1 — EXECUTAR" etapa por etapa.
Meu nome, para registrar no plano: <SEU NOME>
```
