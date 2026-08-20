# 01 — Arquitetura do Sistema

> Última verificação contra o código: 2026-08-20

## Visão de topologia

```
                        ┌──────────────────────────┐
                        │   Meta Quest 3 (vr-app)  │
                        │   🔴 não implementado     │
                        └────────────┬─────────────┘
                                     │  (contrato ainda não definido)
                                     ▼
┌────────────────────┐   HTTPS/JSON   ┌────────────────────────────┐
│  frontend          │ ─────────────► │  backend                   │
│  React 19 + Vite   │   Bearer JWT   │  FastAPI (ASGI/Uvicorn)    │
│  :3000             │ ◄───────────── │  :8000                     │
└────────────────────┘                └─────────────┬──────────────┘
                                                    │ AsyncMongoClient
                                                    ▼
                                          ┌────────────────────┐
                                          │  MongoDB           │
                                          │  db: oculosvr_db   │
                                          │  coll: users       │
                                          └────────────────────┘
```

Não há gateway, fila, cache ou service mesh. A comunicação é direta, síncrona e
exclusivamente HTTP/JSON.

## Estratégia de repositórios

O `quest-project` é um repositório orquestrador que agrega três submódulos Git em
`services/`:

```
quest-project/                       (github.com/Tour-VR/quest-project)
├── docs/                            base de conhecimento (este diretório)
├── scripts/                         automação de ambiente
└── services/
    ├── backend/    → submódulo     (github.com/Tour-VR/backend)
    ├── frontend/   → submódulo     (github.com/Tour-VR/frontend)
    └── vr-app/     → submódulo     (github.com/Tour-VR/vr-app)
```

**Por que submódulos:** cada frente (web, API, VR) tem ciclo de vida, stack e ferramental
próprios — Python, Node e futuramente um motor de jogo com binários pesados. Manter
repositórios separados evita que o histórico de assets VR contamine o clone de quem só
mexe na API, e permite versionamento independente. O custo é a complexidade operacional
de submódulos, mitigada pelos scripts em `scripts/`.

Registro completo da decisão em [08-decisoes-arquiteturais.md](08-decisoes-arquiteturais.md#adr-0001).

**Ponteiros atuais dos submódulos:**

| Submódulo | Commit fixado |
|---|---|
| `services/backend` | `9fc06ef` |
| `services/frontend` | `c3d6d53` |
| `services/vr-app` | `4e6f85f` |

## Arquitetura do backend — camadas

O backend segue arquitetura em camadas com dependência unidirecional:

```
HTTP Request
     │
     ▼
app/main.py ──────────────► CORSMiddleware + lifespan (abre/fecha MongoDB)
     │
     ▼
app/api/v1/router.py ─────► agrega health + auth + users
     │
     ▼
app/api/v1/routes/*.py ───► traduz exceções de domínio em HTTPException
     │
     ▼  (via app/api/deps.py — injeção de dependências)
app/services/user_service.py ──► regras de negócio, exceções de domínio
     │
     ▼
app/repositories/user_repository.py ──► queries MongoDB, traduz PyMongoError
     │
     ▼
MongoDB
```

**Invariantes desta arquitetura** (respeitar em todo código novo):

- Rota **nunca** acessa repositório ou banco diretamente — só o service.
- Service **nunca** levanta `HTTPException` — levanta exceção de domínio
  (`UserInputError`, `UserConflictError`, `AuthenticationError`, `UserNotFoundError`),
  e a rota traduz para código HTTP.
- Repositório **nunca** contém regra de negócio — só query e tradução de `PyMongoError`
  para `ConnectionError`.
- `models/` descreve o documento persistido; `schemas/` descreve o contrato HTTP.
  São coisas distintas e não devem ser fundidas.
- Toda configuração vem de `app/core/config.py` (`Settings`), nunca de `os.environ` direto.

## Arquitetura do frontend — camadas

```
main.tsx → App.tsx (BrowserRouter + AuthProvider + Routes)
                │
                ├── /login      → pages/Login.tsx
                └── /dashboard  → components/ProtectedRoute → pages/Dashboard.tsx
                                          │
                                  contexts/AuthContext.tsx  (estado de sessão)
                                          │
                                  services/api.ts  (Axios + interceptor de token)
```

**Invariantes:**

- Estado de autenticação vive **apenas** em `AuthContext`. Nenhum componente lê o token
  do `localStorage` diretamente — usa `useAuth()`.
- Toda chamada HTTP passa pela instância `api` de `services/api.ts`, para herdar
  `baseURL` e o interceptor de `Authorization`.
- Tipos de resposta da API ficam em `src/types/` e devem espelhar
  [06-contrato-api.md](06-contrato-api.md).

## Ciclo de vida e resiliência

O backend **sobe mesmo sem MongoDB disponível**. Isso é intencional: o `MongoManager`
tenta conectar no `lifespan`, guarda o erro, e as rotas de domínio respondem `503` com
detalhe. O endpoint `/health/` reporta `degraded` em vez de a aplicação inteira falhar.
Facilita desenvolvimento e diagnóstico.

Placeholders de senha comuns (`<db_password>`, `<password>`, `SUA_SENHA`) são detectados
antes de qualquer tentativa de rede, com mensagem explícita.

## Segurança — estado atual

| Aspecto | Implementação |
|---|---|
| Hash de senha | bcrypt via passlib (`CryptContext`) |
| Token | JWT HS256, claims `sub` (email) + `role`, expiração configurável (60 min) |
| Transporte do token | Header `Authorization: Bearer` |
| Armazenamento no cliente | `localStorage`, chave `@OculosVR:token` |
| CORS | Lista explícita de origens via `APP_CORS_ORIGINS` |
| Autorização | 🔴 Inexistente — `role` viaja no token mas nenhuma rota o verifica |
| Refresh token | 🔴 Inexistente |
| Rate limiting | 🔴 Inexistente |

Fragilidades conhecidas estão registradas em
[implementacoes-futuras/](implementacoes-futuras/README.md).

## Lacunas arquiteturais

Estas ausências são estruturais, não detalhes de implementação:

1. **Nenhuma camada de domínio de turismo.** O sistema modela `User` e nada mais. Não há
   `Tour`, `PontoDeInteresse`, `Cena`, `Midia360` ou `Sessao`.
2. **Nenhum contrato definido entre `vr-app` e `backend`.** Como o headset autentica,
   como descobre conteúdo e como consome mídia são questões em aberto.
3. **Nenhuma estratégia de mídia.** Turismo virtual é um problema de entrega de mídia
   pesada; não há storage, CDN, transcodificação ou streaming previstos.
4. **Nenhuma orquestração de ambiente.** Não há `docker-compose.yml`; o MongoDB é
   pressuposto como já existente na máquina do desenvolvedor.
5. **Nenhuma automação de qualidade.** Sem CI, os 24 testes do backend só rodam se
   alguém lembrar de rodá-los.
