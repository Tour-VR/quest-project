# 04 — Artefato: Frontend (`services/frontend`)

> Repositório: `github.com/Tour-VR/frontend` · Commit fixado: `c3d6d53`
> Última verificação contra o código: 2026-08-20

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

## Estrutura

```
services/frontend/
├── index.html              título "OculosVR Admin", lang pt-BR
├── vite.config.ts          plugins react + tailwind, alias "@" → raiz
├── tsconfig.json           ⚠️ sem "strict" — ver DT-013
├── .env.example            VITE_API_URL
└── src/                    414 linhas no total
    ├── main.tsx            StrictMode + createRoot
    ├── App.tsx             BrowserRouter > AuthProvider > Routes
    ├── index.css           @import "tailwindcss"
    ├── pages/
    │   ├── Login.tsx       133 linhas — formulário de login
    │   └── Dashboard.tsx   86 linhas — painel (⚠️ dados fictícios)
    ├── components/
    │   ├── ProtectedRoute.tsx   guard de rota com estado de loading
    │   └── FullScreenLoader.tsx
    ├── contexts/
    │   └── AuthContext.tsx  82 linhas — estado de sessão
    ├── services/
    │   └── api.ts           instância Axios + gestão do token
    └── types/
        └── index.ts         User, AuthResponse, LoginPayload
```

## Rotas

| Rota | Componente | Proteção |
|---|---|---|
| `/login` | `Login` | Pública; redireciona para `/dashboard` se já autenticado |
| `/dashboard` | `Dashboard` | Protegida por `ProtectedRoute` |
| `*` | — | Redireciona para `/dashboard` |

## Fluxo de autenticação

```
1. Usuário submete o formulário em Login.tsx
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
| `POST` | `/auth/login` | `Login.tsx` → `handleLogin` |
| `GET` | `/users/me` | `AuthContext` → `syncUserFromToken` |

As rotas `PUT /users/me` e `PUT /users/me/password`, já disponíveis no backend, **não são
consumidas** — não existe tela de perfil.

## Configuração

| Variável | Padrão | Descrição |
|---|---|---|
| `VITE_API_URL` | `http://127.0.0.1:8000` | URL base do backend |

`API_DOCS_URL` é derivado de `API_BASE_URL + "/docs"` e usado no aviso da tela de login.

## Execução

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
| `npm run lint` | `tsc --noEmit` — checagem de tipos apenas |
| `npm run clean` | Remove `dist/` |

Não há testes automatizados nem linter de estilo. Ver
[DT-013](implementacoes-futuras/DT-013-qualidade-codigo-frontend.md).

## O que é fachada e o que é real

Distinção importante para quem for evoluir o painel:

| Elemento | Status |
|---|---|
| Login, sessão, logout, guard de rota | ✅ Real, integrado ao backend |
| Nome do usuário no cabeçalho | ✅ Real, vem de `/users/me` |
| Bloco JSON com os dados de `/users/me` | ✅ Real |
| Cards "124 Usuários Ativos" / "12 Ambientes VR" / "89 Sessões Hoje" | ❌ Constantes literais em `Dashboard.tsx:15-19` |
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

O `README.md` de `services/frontend` tem 524 linhas e é notavelmente honesto sobre as
limitações do projeto — a seção de limitações foi aproveitada e consolidada nas dívidas
técnicas deste repositório. Contém, porém, instruções de instalação que apontam para
scripts inexistentes. **Este documento é a fonte de verdade.**
