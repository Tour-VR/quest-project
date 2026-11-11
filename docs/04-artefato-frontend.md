# 04 — Artefato: Frontend (`services/frontend`)

> Repositório: `github.com/Tour-VR/frontend` · Commit fixado: `644647e`
> Última verificação contra o código: 2026-11-10

## Responsabilidade

Painel administrativo web do TourVR. Autentica administradores contra o backend, mantém
a sessão entre recarregamentos, protege rotas e exibe o painel inicial.

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

## Estrutura

```
services/frontend/
├── index.html              título "OculosVR Admin", lang pt-BR
├── vite.config.ts          plugins react + tailwind, alias "@" → raiz
├── vitest.config.ts        jsdom, setup e cobertura mínima de 80%
├── eslint.config.js        flat config: regras de tipo, react-hooks, limites de tamanho
├── .prettierrc             aspas simples, ponto e vírgula, vírgula final, 100 colunas
├── .gitattributes          força quebra de linha LF (o Prettier exige LF)
├── tsconfig.json           "strict": true, noUnused*, types vite/vitest/jest-dom
├── .env.example            VITE_API_URL
└── src/                    539 linhas de código (sem contar testes)
    ├── main.tsx            StrictMode + createRoot
    ├── App.tsx             BrowserRouter > AuthProvider > Routes
    ├── index.css           @import "tailwindcss"
    ├── vite-env.d.ts       tipo de import.meta.env (VITE_API_URL)
    ├── pages/              só compõem componentes
    │   ├── Login.tsx       34 linhas — loader, redirecionamento e cartão de login
    │   └── Dashboard.tsx   33 linhas — painel (⚠️ dados fictícios)
    ├── components/
    │   ├── ProtectedRoute.tsx   guard de rota com estado de loading
    │   ├── FullScreenLoader.tsx
    │   ├── login/
    │   │   ├── LoginForm.tsx          mensagem de erro + campos + botão
    │   │   ├── IconInput.tsx          rótulo + ícone + input (id via useId)
    │   │   └── FirstAccessNotice.tsx  aviso azul de primeiro acesso
    │   └── dashboard/
    │       ├── Sidebar.tsx        título, menu e "Sair do sistema"
    │       ├── MetricCards.tsx    grade de cartões de métricas
    │       └── UserDataPanel.tsx  JSON de /users/me
    ├── constants/
    │   └── dashboard.ts    navigationItems e dashboardMetrics
    ├── hooks/
    │   └── useLoginForm.ts estado do formulário e envio (POST /auth/login)
    ├── contexts/
    │   └── AuthContext.tsx  82 linhas — estado de sessão
    ├── services/
    │   └── api.ts           instância Axios + gestão do token
    ├── test/
    │   ├── setup.ts         jest-dom + limpa localStorage após cada teste
    │   └── factories.ts     buildUser e buildAuthValue para os testes
    └── types/
        └── index.ts         User, AuthResponse, LoginPayload
```

Testes ficam ao lado do código, como `Arquivo.test.tsx` (ex.: `pages/Login.test.tsx`).
A API é sempre mockada com `vi.mock('../services/api')`; não há servidor real nos testes.

## Rotas

| Rota | Componente | Proteção |
|---|---|---|
| `/login` | `Login` | Pública; redireciona para `/dashboard` se já autenticado |
| `/dashboard` | `Dashboard` | Protegida por `ProtectedRoute` |
| `*` | — | Redireciona para `/dashboard` |

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
Não existe interceptor de **response** — token expirado no meio da sessão falha
silenciosamente. Ver [DT-010](implementacoes-futuras/DT-010-tratamento-global-erros-frontend.md).

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

`API_DOCS_URL` é derivado de `API_BASE_URL + "/docs"` e usado no aviso da tela de login.

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

### Problemas comuns

| Sintoma | Causa provável |
|---|---|
| `Network Error` ao fazer login | Backend fora do ar ou `VITE_API_URL` apontando para outro endereço |
| Erro de CORS | A origem do painel não está em `APP_CORS_ORIGINS` do backend |
| "Credenciais inválidas" com usuário novo | Usuário ainda não cadastrado; usar `POST /auth/register` no Swagger |
| `useAuth deve ser usado dentro de AuthProvider` | Componente renderizado fora da árvore de `<App>` |

## O que é fachada e o que é real

Distinção importante para quem for evoluir o painel:

| Elemento | Status |
|---|---|
| Login, sessão, logout, guard de rota | ✅ Real, integrado ao backend |
| Nome do usuário no cabeçalho | ✅ Real, vem de `/users/me` |
| Bloco JSON com os dados de `/users/me` | ✅ Real |
| Cards "124 Usuários Ativos" / "12 Ambientes VR" / "89 Sessões Hoje" | ❌ Constantes literais em `constants/dashboard.ts:9-13` |
| Menu lateral "Usuários" e "Configurações VR" | ❌ `<div>` sem rota, sem página, sem clique |
| Aviso "cadastre-se via /docs" na tela de login | ⚠️ Real — não há tela de cadastro |

Ver [DT-011](implementacoes-futuras/DT-011-dashboard-dados-reais.md) e
[DT-015](implementacoes-futuras/DT-015-gestao-usuarios-no-painel.md).

## Divergência de contrato

`src/types/index.ts` define `User` sem o campo `is_verified`, que o backend retorna em
`/users/me`. Não quebra em runtime (TypeScript apaga tipos na compilação), mas o contrato
está fora de sincronia e não há mecanismo que force o alinhamento. Ver
[DT-012](implementacoes-futuras/DT-012-contrato-api-tipado.md).

## Nota sobre o README do submódulo

Desde o plano 002, o `README.md` de `services/frontend` é curto (menos de 50 linhas) e
correto: diz como rodar e testar e aponta para este documento. A antiga seção de
limitações está consolidada em [O que é fachada e o que é real](#o-que-é-fachada-e-o-que-é-real)
e nas dívidas técnicas; os problemas comuns foram trazidos para a seção
[Execução](#execução). **Este documento é a fonte de verdade.**
