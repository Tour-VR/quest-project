# 04 — Artefato: Frontend (`services/frontend`)

> Repositório: `github.com/Tour-VR/frontend` · Commit fixado: `644647e`
> Última verificação contra o código: 2026-11-12

## Responsabilidade

Painel administrativo web do TourVR. Autentica administradores contra o backend, mantém
a sessão entre recarregamentos, encerra a sessão quando o token expira, restringe o painel
ao papel `admin` e exibe o painel inicial dentro de um layout com menu (plano 011).

Não possui lógica de negócio própria — é uma casca sobre a API REST.

## Stack

| Componente | Tecnologia | Versão |
|---|---|---|
| Biblioteca de UI | React | 19 |
| Build/dev server | Vite | 6 |
| Linguagem | TypeScript | 5.8 |
| Estilo | Tailwind CSS (plugin oficial do Vite) | 4.1 |
| Roteamento | React Router | 7.13 |
| HTTP | Axios | 1.13 |
| Ícones | lucide-react | 0.546 |
| Lint | ESLint (`typescript-eslint` `strictTypeChecked` + `react-hooks`) | 10 |
| Formatação | Prettier | 3 |
| Testes | Vitest + Testing Library (`jsdom`), cobertura v8 | 5 |
| Tipos da API | `openapi-typescript` (gera `src/types/api.d.ts` do OpenAPI) | 7 |

## Estrutura

```
services/frontend/
├── index.html              título "TourVR Admin", lang pt-BR
├── vite.config.ts          plugins react + tailwind, alias "@" → raiz
├── vitest.config.ts        jsdom, setup e cobertura mínima de 80%
├── eslint.config.js        flat config: regras de tipo, react-hooks, limites de tamanho
├── .prettierrc             aspas simples, ponto e vírgula, vírgula final, 100 colunas
├── .gitattributes          força quebra de linha LF (o Prettier exige LF)
├── tsconfig.json           "strict": true, noUnused*, types vite/vitest/jest-dom
├── .env.example            VITE_API_URL
├── scripts/
│   └── gen-types.mjs       npm run gen:types — gera src/types/api.d.ts do /openapi.json
└── src/                    ~650 linhas de código (sem contar testes e api.d.ts)
    ├── main.tsx            StrictMode + createRoot
    ├── App.tsx             BrowserRouter > AuthProvider > Routes (rotas aninhadas)
    ├── index.css           @import "tailwindcss"
    ├── vite-env.d.ts       tipo de import.meta.env (VITE_API_URL)
    ├── pages/              só compõem componentes
    │   ├── Login.tsx       aviso de sessão, formulário e "Não tem acesso?"
    │   └── Dashboard.tsx   saudação + cartão "métricas no plano 015"
    ├── layouts/
    │   ├── AdminLayout.tsx barra lateral ("TourVR Admin", menu, "Sair do sistema") + <Outlet />
    │   └── SidebarNav.tsx  NavLink nos itens habilitados; "em breve" nos demais
    ├── components/
    │   ├── ProtectedRoute.tsx   carregando → loader; sem sessão → /login; sem admin → AccessDenied
    │   ├── AccessDenied.tsx     "Acesso restrito a administradores." + botão "Sair"
    │   ├── FullScreenLoader.tsx
    │   ├── login/
    │   │   ├── LoginForm.tsx      mensagem de erro + campos + botão
    │   │   ├── IconInput.tsx      rótulo + ícone + input (id via useId)
    │   │   └── SessionNotice.tsx  caixa amarela com o aviso de sessão expirada
    │   └── dashboard/
    │       └── MetricsPendingCard.tsx  cartão informativo no lugar das métricas
    ├── constants/
    │   ├── messages.ts     textos de sessão expirada, acesso restrito e avisos
    │   └── navigation.ts   NAV_ITEMS (rótulo, rota, ícone, enabled)
    ├── hooks/
    │   └── useLoginForm.ts estado do formulário e envio (POST /auth/login)
    ├── contexts/
    │   └── AuthContext.tsx  sessão, isAdmin, sessionNotice e registro do handler de 401
    ├── services/
    │   └── api.ts           instância Axios, gestão do token, interceptores de request e de 401
    ├── test/
    │   ├── setup.ts         jest-dom + limpa localStorage após cada teste
    │   └── factories.ts     buildUser e buildAuthValue para os testes
    └── types/
        ├── api.d.ts         GERADO por npm run gen:types — não editar à mão
        └── index.ts         aliases: User, AuthResponse, LoginPayload
```

Testes ficam ao lado do código, como `Arquivo.test.tsx` (ex.: `pages/Login.test.tsx`).
A API é sempre mockada com `vi.mock('../services/api')`; não há servidor real nos testes.

## Rotas

| Rota | Componente | Proteção |
|---|---|---|
| `/login` | `Login` | Pública; redireciona para `/dashboard` se já autenticado |
| `/dashboard` | `Dashboard` dentro de `AdminLayout` | `ProtectedRoute`: sessão **e** papel `admin` |
| `*` | — | Redireciona para `/dashboard` |

As telas do painel ficam aninhadas em `ProtectedRoute` → `AdminLayout` (`src/App.tsx`). Uma
tela nova entra como rota filha do `AdminLayout` e ganha um item em
`constants/navigation.ts`. Itens com `enabled: false` aparecem cinza, com
`aria-disabled="true"` e o rótulo "em breve", sem link (hoje: "Pontos", plano 012).

## Fluxo de autenticação

```
1. Usuário submete o formulário (pages/Login.tsx → LoginForm → useLoginForm.submit)
     └─ POST /auth/login  → { access_token, token_type }
2. AuthContext.signIn(token)
     ├─ setAuthToken(token)  → grava em localStorage["@OculosVR:token"]
     │                         e em api.defaults.headers.common.Authorization
     └─ GET /users/me        → popula o estado `user`
3. navigate("/dashboard")

Ao recarregar a página:
     AuthContext useEffect → getStoredToken() → GET /users/me
       ├─ sucesso: sessão restaurada
       └─ falha:   clearAuthToken(), usuário volta ao login
     Enquanto isso, `loading = true` e ProtectedRoute exibe FullScreenLoader
     (evita o flash de redirecionamento indevido para /login).

Logout:
     signOut() → remove do localStorage, remove o header, zera `user`
```

Um interceptor de **request** em `services/api.ts` injeta `Authorization` em toda chamada.

**Sessão expirada (401).** Um interceptor de **response** em `services/api.ts` trata o `401`
de qualquer rota, **exceto** `POST /auth/login` (credencial errada continua mostrando a
mensagem do backend):

```
API responde 401
  └─ clearAuthToken() e chama o handler registrado com setUnauthorizedHandler()
       └─ AuthContext: setUser(null)
                       sessionNotice = "Sua sessão expirou. Entre novamente."
            └─ ProtectedRoute vê isAuthenticated = false → <Navigate to="/login" />
                 └─ Login mostra o aviso em caixa amarela; enviar o formulário o limpa
```

O módulo HTTP não conhece o React: o `AuthProvider` registra o handler num `useEffect`
(com cleanup, por causa do `StrictMode`) declarado **antes** do efeito de restauração de
sessão, para que um token inválido na recarga também mostre o aviso. O handler não chama
`navigate` — zerar o `user` basta e evita laço de redirecionamento.

`403` **não** encerra a sessão: em `/admin/...` significa papel insuficiente, e quem trata é
a tela que chamou.

**Guard de papel.** `ProtectedRoute` só libera o painel para `role === "admin"`
(`isAdmin` no contexto). Usuário autenticado sem esse papel vê `AccessDenied` ("Acesso
restrito a administradores.") com o botão "Sair".

## Endpoints consumidos

| Método | Endpoint | Origem |
|---|---|---|
| `POST` | `/auth/login` | `hooks/useLoginForm.ts` → `submit` |
| `GET` | `/users/me` | `AuthContext` → `syncUserFromToken` |

As rotas `PUT /users/me` e `PUT /users/me/password`, já disponíveis no backend, **não são
consumidas** — não existe tela de perfil.

## Configuração

| Variável | Padrão | Descrição |
|---|---|---|
| `VITE_API_URL` | `http://127.0.0.1:8000` | URL base do backend |

`VITE_API_URL` também é lido por `npm run gen:types` (padrão `http://localhost:8000`).

## Execução

**Caminho principal: Docker**, a partir da raiz do orquestrador:

```bash
bash scripts/up.sh   # painel em http://localhost:3000
```

O serviço `frontend` usa `services/frontend/Dockerfile.dev` (`node:22-slim`, `npm ci`,
`npm run dev`). O código fica montado em `/app` e `node_modules` num volume próprio, porque
os pacotes instalados no Windows não funcionam no Linux do container. Editar um arquivo
em `src/` atualiza o navegador sem rebuild (`CHOKIDAR_USEPOLLING=true` no compose).
`VITE_API_URL` vem do `.env` da raiz. O `.dockerignore` exclui `node_modules`, `dist`,
`coverage`, `.git` e qualquer `.env`.

Não há imagem de produção (build servido por Nginx) — pendência da
[DT-014](implementacoes-futuras/DT-014-containerizacao-completa.md).

**Alternativa sem Docker** (exige o backend rodando):

```bash
cd services/frontend
npm install
cp .env.example .env
npm run dev        # http://localhost:3000
```

| Script | Ação |
|---|---|
| `npm run dev` | Vite dev server na porta 3000, host `0.0.0.0` |
| `npm run build` | Build de produção em `dist/` |
| `npm run preview` | Serve o build gerado |
| `npm run lint` | `eslint .` e `tsc --noEmit` (modo strict) |
| `npm run format` | Formata todo o projeto com Prettier |
| `npm run format:check` | Confere a formatação sem alterar arquivos |
| `npm run test` | Roda os testes com Vitest |
| `npm run test:coverage` | Testes com cobertura; falha abaixo de 80% em linhas, funções, ramos ou comandos |
| `npm run clean` | Remove `dist/` |
| `npm run gen:types` | Gera `src/types/api.d.ts` a partir de `<VITE_API_URL>/openapi.json`; exige o backend no ar (`bash scripts/up.sh`) |

**Integração contínua.** `npm ci`, `lint`, `format:check`, `test:coverage` e `build` rodam
no GitHub em todo PR e push na `main`, pelo workflow `.github/workflows/ci.yml` (check
`CI / validacao`) — ver
[02-artefato-orquestrador.md](02-artefato-orquestrador.md#integração-contínua).

### Regras de qualidade

Definidas em `eslint.config.js` (plano 004). Reprovam o `npm run lint`:

| Regra | Limite |
|---|---|
| `max-lines` | 200 linhas por arquivo (sem linhas em branco e comentários) |
| `max-lines-per-function` | 60 linhas por função (sem linhas em branco e comentários) |
| `complexity` | 10 |
| `no-magic-numbers` | ignora `-1, 0, 1, 2` |

Em `**/*.test.ts(x)` e `src/test/**` ficam desligadas `no-magic-numbers`,
`max-lines-per-function` e `@typescript-eslint/no-non-null-assertion`.

`src/types/api.d.ts` (gerado) fica fora do ESLint e do Prettier. Os scripts Node em
`scripts/*.mjs` usam a mesma configuração dos `*.config.js` (sem checagem de tipos) e as
globais de Node.

### Problemas comuns

| Sintoma | Causa provável |
|---|---|
| `Network Error` ao fazer login | Backend fora do ar ou `VITE_API_URL` apontando para outro endereço |
| Erro de CORS | A origem do painel não está em `APP_CORS_ORIGINS` do backend |
| "Credenciais inválidas" com usuário novo | Usuário ainda não cadastrado; um administrador cadastra via `POST /auth/register` (exige papel admin, plano 008) |
| "Acesso restrito a administradores." | Login válido, mas o papel não é `admin`; o primeiro admin vem do `create-admin` |
| `npm run gen:types` falha com `ECONNREFUSED` | Backend fora do ar; rode `bash scripts/up.sh` antes |
| `useAuth deve ser usado dentro de AuthProvider` | Componente renderizado fora da árvore de `<App>` |

## O que é fachada e o que é real

Distinção importante para quem for evoluir o painel:

| Elemento | Status |
|---|---|
| Login, sessão, logout, guard de rota e de papel | ✅ Real, integrado ao backend |
| Aviso de sessão expirada (401) | ✅ Real (plano 011) |
| Nome do usuário na saudação | ✅ Real, vem de `/users/me` |
| Menu lateral "Dashboard" | ✅ Real, `NavLink` para `/dashboard` |
| Menu lateral "Pontos" | ⏳ Desabilitado, "em breve" (plano 012) |
| Métricas do dashboard | ⏳ Cartão informativo; números reais no plano 015. Nenhum número fictício na tela |
| Cadastro de usuários | ⏳ Sem tela; o login orienta a falar com um administrador (plano 015) |

Ver [DT-011](implementacoes-futuras/DT-011-dashboard-dados-reais.md) e
[DT-015](implementacoes-futuras/DT-015-gestao-usuarios-no-painel.md).

## Tipos da API

Os tipos do contrato são **gerados** do OpenAPI do backend por `npm run gen:types`
(`scripts/gen-types.mjs` → `openapi-typescript`), gravados em `src/types/api.d.ts` e
**versionados**. `src/types/index.ts` só reexporta aliases legíveis:

| Alias | Schema do OpenAPI |
|---|---|
| `User` | `UserMeResponse` (inclui `is_verified`) |
| `AuthResponse` | `TokenResponse` |
| `LoginPayload` | `UserLogin` |

Quando o backend mudar um schema, rode `npm run gen:types` com a pilha no ar e commite o
`api.d.ts` junto: a diferença aparece no diff do PR e o `tsc` aponta o que quebrou. Não há
verificação automática em CI de que o arquivo está atualizado (fora do escopo do plano 011).

## Nota sobre o README do submódulo

Desde o plano 002, o `README.md` de `services/frontend` é curto (menos de 50 linhas) e
correto: diz como rodar e testar e aponta para este documento. A antiga seção de
limitações está consolidada em [O que é fachada e o que é real](#o-que-é-fachada-e-o-que-é-real)
e nas dívidas técnicas; os problemas comuns foram trazidos para a seção
[Execução](#execução). **Este documento é a fonte de verdade.**
