# 03 — Artefato: Backend (`services/backend`)

> Repositório: `github.com/Tour-VR/backend` · Commit fixado: `9fc06ef`
> Última verificação contra o código: 2026-11-09

## Responsabilidade

Expor a API REST do sistema: autenticação de administradores, gestão de perfil de usuário
e diagnóstico de saúde. É a única camada com acesso ao banco de dados.

**Ainda não modela nada do domínio de turismo** — apenas usuários.

## Stack

| Componente | Tecnologia | Versão |
|---|---|---|
| Linguagem | Python | 3.11+ |
| Framework web | FastAPI | 0.135.1 |
| Servidor ASGI | Uvicorn | 0.42.0 |
| Banco | MongoDB (via `AsyncMongoClient`) | pymongo 4.16.0 |
| JWT | python-jose | 3.5.0 |
| Hash de senha | passlib + bcrypt | 1.7.4 / 4.0.1 |
| Validação/config | Pydantic v2 + pydantic-settings | 2.13.1 |
| Testes | pytest + httpx | 9.0.2 / 0.28.1 |

> `bcrypt` está fixado em `4.0.1` deliberadamente: versões 4.1+ quebram a integração com
> o `passlib` 1.7.4. Não atualizar sem antes migrar o `passlib`.

## Estrutura

```
services/backend/
├── main.py                     entrypoint ASGI (só reexporta app/main.py:app)
├── requirements.txt
├── Dockerfile                  python:3.11-slim, expõe uvicorn na 8000
├── .env.example
└── app/
    ├── main.py                 create_app(): lifespan, CORS, router, rota "/"
    ├── core/
    │   ├── config.py           Settings (pydantic-settings) + cors_origins
    │   ├── database.py         MongoManager, get_mongo_manager, get_database
    │   └── security.py         hash/verify senha, create/decode JWT, força de senha
    ├── api/
    │   ├── deps.py             get_user_service, get_current_user, erro 503 padrão
    │   └── v1/
    │       ├── router.py       agrega health + auth + users
    │       └── routes/         auth.py · users.py · health.py
    ├── models/user.py          UserModel (dataclass, slots)
    ├── schemas/user.py         9 schemas Pydantic
    ├── repositories/user_repository.py   5 métodos de acesso à collection `users`
    └── services/user_service.py          regras de negócio + 4 exceções de domínio
└── tests/                      conftest.py + 24 testes
```

## Endpoints

Contrato completo, com payloads e códigos de erro, em
[06-contrato-api.md](06-contrato-api.md). Resumo:

| Método | Rota | Auth |
|---|---|---|
| `GET` | `/` | — |
| `GET` | `/health/` | — |
| `POST` | `/auth/register` | — |
| `POST` | `/auth/login` | — |
| `GET` | `/users/me` | Bearer |
| `PUT` | `/users/me` | Bearer |
| `PUT` | `/users/me/password` | Bearer |

## Modelo de dados

`UserModel` ([app/models/user.py](../services/backend/app/models/user.py)) — documento da
collection `users`:

| Campo | Tipo | Padrão |
|---|---|---|
| `email` | `str` | — (identificador principal) |
| `hashed_password` | `str` | — |
| `username` | `str \| None` | `None` |
| `full_name` | `str \| None` | `None` |
| `role` | `str` | `"user"` |
| `is_active` | `bool` | `True` |
| `is_verified` | `bool` | `False` |
| `created_at` | `datetime` | `now(utc)` |
| `updated_at` | `datetime` | `now(utc)` |

⚠️ Não há índice único em `email` nem em `username`. A unicidade é verificada apenas em
código, no `UserService`, o que deixa uma janela de corrida entre a checagem e a inserção.
Ver [DT-006](implementacoes-futuras/DT-006-integridade-dados-mongodb.md).

## Regras de negócio relevantes

Implementadas em [app/services/user_service.py](../services/backend/app/services/user_service.py)
e [app/core/security.py](../services/backend/app/core/security.py):

- **Força de senha:** mínimo 8 caracteres, com ao menos uma letra e um dígito
  (`validate_password_strength`). Aplicada no registro e na troca de senha.
- **Normalização:** e-mail sempre em minúsculas e sem espaços; `username` em minúsculas,
  3–30 caracteres, apenas `[a-z0-9._-]`, sem começar ou terminar em separador.
- **Login aceita e-mail ou username.** O campo do payload chama-se `email`, mas o
  repositório busca com `$or` sobre ambos os campos.
- **Mensagem de erro uniforme no login.** Usuário inexistente, senha errada e conta
  inativa retornam todos `401` com `"Credenciais invalidas."` — não revela se a conta
  existe. Esta uniformidade é intencional; preservá-la em mudanças futuras.
- **Troca de senha** exige a senha atual e recusa uma nova senha idêntica à atual.
- **Usuário inativo** é bloqueado no login (`401`) e nas rotas protegidas (`403`).

## Configuração

Todas as variáveis são lidas por `Settings` a partir do `.env` no diretório do backend
ou do ambiente do processo. No ambiente Docker, elas vêm do `.env` da raiz do
orquestrador, e `MONGODB_URL` e `APP_CORS_ORIGINS` são fixadas no `docker-compose.yml`
(ver [Ambiente local](02-artefato-orquestrador.md#ambiente-local)).

| Variável | Padrão no código | Observação |
|---|---|---|
| `APP_NAME` | `Meu Backend MVP` | `.env.example` sobrescreve para `OculosVR Backend` |
| `APP_ENV` | `development` | |
| `APP_DEBUG` | `true` | ⚠️ em `true`, o detalhe da exceção do banco vaza no `503` |
| `APP_HOST` / `APP_PORT` | `0.0.0.0` / `8000` | |
| `APP_CORS_ORIGINS` | `http://localhost:3000,http://127.0.0.1:3000` | lista separada por vírgula |
| `MONGODB_URL` | `mongodb://localhost:27017` | |
| `MONGODB_DB` | `meu_backend_db` | `.env.example` usa `oculosvr_db` |
| `JWT_SECRET_KEY` | `troque_esta_chave` | ⚠️ default inseguro, sobe sem erro — ver DT-007 |
| `JWT_ALGORITHM` | `HS256` | |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `60` | |

## Execução

**Caminho principal: Docker**, a partir da raiz do orquestrador:

```bash
bash scripts/up.sh
```

O serviço `backend` usa a imagem de `services/backend/Dockerfile`, com o código montado
em `/app` e `uvicorn --reload`: editar um `.py` recarrega a API sem rebuild. A imagem:

- instala `requirements.txt` antes de copiar o código, para reaproveitar o cache de
  camadas (`Dockerfile:8-12`);
- ignora `.venv`, `.git`, caches, `tests/`, `*.md` e qualquer `.env` via
  `.dockerignore` — segredos locais nunca entram na imagem;
- roda como o usuário sem privilégios `appuser`, uid 1000 (`Dockerfile:14-16`);
- declara `HEALTHCHECK` contra `GET /health/` (`Dockerfile:20-21`), usado pelo compose
  para só subir o painel quando a API responde.

**Alternativa sem Docker** (exige um MongoDB acessível):

```bash
cd services/backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env             # e edite
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

| Interface | URL |
|---|---|
| API | http://127.0.0.1:8000 |
| Swagger UI | http://127.0.0.1:8000/docs |
| ReDoc | http://127.0.0.1:8000/redoc |
| Health | http://127.0.0.1:8000/health/ |

Requer MongoDB acessível. A API sobe sem ele, mas as rotas de domínio respondem `503`.

### Problemas comuns

| Sintoma | Causa provável |
|---|---|
| `503` em todas as rotas de domínio | MongoDB não conectou no `lifespan`; conferir `MONGODB_URL` e `GET /health/` |
| Erro de credencial placeholder | A URI contém `<db_password>` ou similar; o `MongoManager` aborta sem tentar a rede |
| Erro de CORS no painel | A origem do painel não está em `APP_CORS_ORIGINS` |
| `ModuleNotFoundError` fora do Docker | Virtualenv não ativado ou `pip install -r requirements.txt` não executado |

### Guia de leitura do código

Ordem sugerida para entender o backend: `app/core/config.py` → `app/core/database.py` →
`app/core/security.py` → `app/models/user.py` e `app/schemas/user.py` →
`app/repositories/user_repository.py` → `app/services/user_service.py` →
`app/api/deps.py` → `app/api/v1/routes/` → `tests/` (documentação executável dos
comportamentos esperados).

## Testes

```bash
cd services/backend && pytest -v
```

**24 testes**, todos com MongoDB mockado (sem dependência de banco real):

- `tests/test_health.py` — 6 testes: import do app, rota raiz, preflight CORS,
  health com banco up/down, detecção de placeholder de senha sem chamada de rede.
- `tests/test_auth_flow.py` — 18 testes: registro (sucesso, e-mail duplicado, username
  duplicado, senha fraca), login (sucesso, por username, senha errada, usuário inativo),
  `/users/me` (leitura, atualização, username duplicado, troca de senha, senha atual
  errada, sem token, token inválido, usuário inativo), e falha de banco em 3 rotas.

Fixtures em `conftest.py`: `mongo_up`, `mongo_down`, `client`.

## Nota sobre o README do submódulo

Desde o plano 002, o `README.md` de `services/backend` é curto (menos de 50 linhas) e
correto: diz como rodar e testar e aponta para este documento. Arquitetura e
comportamento ficam aqui, em `docs/`. O conteúdo útil do README antigo (problemas comuns
e guia de leitura) foi trazido para a seção [Execução](#execução).
