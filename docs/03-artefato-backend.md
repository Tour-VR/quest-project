# 03 — Artefato: Backend (`services/backend`)

> Repositório: `github.com/Tour-VR/backend` · Commit fixado: `d3f1449`
> Última verificação contra o código: 2026-11-11

## Responsabilidade

Expor a API REST do sistema: autenticação de administradores, gestão de perfil de usuário,
cadastro e publicação de **pontos de interesse** do campus (rotas `/admin/points`) e leitura
pública desses pontos para o app do visitante (rotas `/public/points`), além do diagnóstico
de saúde. É a única camada com acesso ao banco de dados.

O domínio do campus segue a [ADR-0007](08-decisoes-arquiteturais.md#adr-0007--modelo-de-domínio-do-campus).
Ainda não existem visitas (plano 010), upload de mídia (plano 013) nem panoramas (plano 019).

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
| Testes | pytest + httpx + pytest-cov | 9.0.2 / 0.28.1 / 7.0.0 |
| Lint e formatação | Ruff | 0.14.3 |
| Tipagem estática | mypy (`strict`) | 1.18.2 |

> `bcrypt` está fixado em `4.0.1` deliberadamente: versões 4.1+ quebram a integração com
> o `passlib` 1.7.4. Não atualizar sem antes migrar o `passlib`.

## Estrutura

```
services/backend/
├── main.py                     entrypoint ASGI (só reexporta app/main.py:app)
├── requirements.txt        dependências de execução
├── requirements-dev.txt    + pytest, pytest-cov, ruff, mypy (desenvolvimento)
├── pyproject.toml          configuração de Ruff, mypy, pytest e coverage
├── Dockerfile                  python:3.11-slim, expõe uvicorn na 8000
├── .env.example
└── app/
    ├── main.py                 create_app(): fail-fast, logging, lifespan (+ índices),
    │                           limitador de login, CORS, router, rota "/"
    ├── core/
    │   ├── config.py           Settings + ensure_secure_settings (fail-fast da chave JWT)
    │   ├── database.py         MongoManager, get_mongo_manager, get_database
    │   ├── indexes.py          ensure_indexes: índices únicos de `users` e `points`
    │   ├── logging.py          configure_logging (biblioteca padrão, nível por LOG_LEVEL)
    │   ├── rate_limit.py       LoginRateLimiter (janela deslizante em memória)
    │   ├── roles.py            ROLE_ADMIN, ROLE_USER, VALID_ROLES
    │   └── security.py         hash/verify senha, create/decode JWT, força de senha
    ├── api/
    │   ├── deps.py             get_user_service, get_point_service, get_current_user,
    │                           require_admin, get_login_rate_limiter, erro 503 padrão
    │   └── v1/
    │       ├── router.py       agrega health + auth + users + admin_points + public_points
    │       └── routes/         auth.py · users.py · health.py ·
    │                           admin_points.py · public_points.py
    ├── models/
    │   ├── user.py             UserModel (dataclass, slots)
    │   └── point.py            PointModel + constantes de status e tipo de mídia
    ├── schemas/
    │   ├── user.py             9 schemas Pydantic
    │   └── point.py            7 schemas + limites do contrato (fonte única)
    ├── repositories/
    │   ├── errors.py           UniqueConstraintError + duplicated_field (chave duplicada)
    │   ├── user_repository.py  5 métodos de acesso à collection `users`
    │   └── point_repository.py 8 métodos de acesso à collection `points`
    ├── services/
    │   ├── user_service.py     regras de usuário + 4 exceções de domínio
    │   └── point_service.py    regras de publicação e slug + 3 exceções de domínio
    └── cli.py                  comando `create-admin` (python -m app.cli)
└── tests/                      conftest.py + 105 testes
```

## Endpoints

Contrato completo, com payloads e códigos de erro, em
[06-contrato-api.md](06-contrato-api.md). Resumo:

| Método | Rota | Auth |
|---|---|---|
| `GET` | `/` | — |
| `GET` | `/health/` | — |
| `POST` | `/auth/register` | Bearer (admin) |
| `POST` | `/auth/login` | — |
| `GET` | `/users/me` | Bearer |
| `PUT` | `/users/me` | Bearer |
| `PUT` | `/users/me/password` | Bearer |
| `GET` | `/admin/points` | Bearer (admin) |
| `POST` | `/admin/points` | Bearer (admin) |
| `GET` | `/admin/points/{point_id}` | Bearer (admin) |
| `PUT` | `/admin/points/{point_id}` | Bearer (admin) |
| `DELETE` | `/admin/points/{point_id}` | Bearer (admin) |
| `POST` | `/admin/points/{point_id}/publish` | Bearer (admin) |
| `POST` | `/admin/points/{point_id}/unpublish` | Bearer (admin) |
| `GET` | `/public/points` | — |
| `GET` | `/public/points/{slug}` | — |

Prefixos: `/admin/...` exige papel `admin` (o roteador inteiro depende de `require_admin`,
`app/api/v1/routes/admin_points.py:18-22`); `/public/...` não pede token e só devolve
pontos publicados.

## Modelo de dados

`UserModel` ([app/models/user.py](../services/backend/app/models/user.py)) — documento da
collection `users`:

| Campo | Tipo | Padrão |
|---|---|---|
| `email` | `str` | — (identificador principal) |
| `hashed_password` | `str` | — |
| `username` | `str \| None` | `None` |
| `full_name` | `str \| None` | `None` |
| `role` | `str` | `"user"` (`ROLE_USER`) — ver [Papéis](#papéis) |
| `is_active` | `bool` | `True` |
| `is_verified` | `bool` | `False` |
| `created_at` | `datetime` | `now(utc)` |
| `updated_at` | `datetime` | `now(utc)` |

`PointModel` (`app/models/point.py`) — documento
da collection `points` ([ADR-0007](08-decisoes-arquiteturais.md#adr-0007--modelo-de-domínio-do-campus)):

| Campo | Tipo | Padrão |
|---|---|---|
| `_id` | `ObjectId` | gerado pelo MongoDB; exposto como `id` (texto) nas rotas admin |
| `slug` | `str` | — (único; vai no QR Code) |
| `name` | `str` | — |
| `summary` | `str` | — |
| `history` | `str` | — |
| `status` | `str` | `"draft"` (`POINT_STATUS_DRAFT`) ou `"published"` |
| `media` | `list[dict]` | `[]` — itens `{"id", "kind": "photo", "url", "caption", "alt_text"}`, máx. 20 |
| `created_at` | `datetime` | `now(utc)` |
| `updated_at` | `datetime` | `now(utc)` |
| `published_at` | `datetime \| None` | `None` — data da **primeira** publicação |

Os limites de cada campo são constantes de `app/schemas/point.py:22-34` (fonte única,
espelhada pelo painel no plano 012).

**Índices.** Criados na subida da aplicação por `ensure_indexes`
(`app/core/indexes.py:8-20`), chamado no `lifespan` logo após a conexão
(`app/main.py:35-39`). `create_index` com o mesmo nome e as mesmas opções é idempotente.

| Nome | Campo | Opções |
|---|---|---|
| `users_email_unique` | `email` | `unique` |
| `users_username_unique` | `username` | `unique`, parcial: só documentos com `username` do tipo string — vários usuários sem username (`null`) não colidem |
| `points_slug_unique` | `slug` (collection `points`) | `unique` |

As verificações prévias do `UserService` (`find_by_email`, `find_by_username`) continuam
e dão a mensagem amigável no caso comum; o índice é a garantia contra cadastros
simultâneos. Quando o MongoDB recusa por chave duplicada, o repository levanta
`UniqueConstraintError(campo)` (`app/repositories/user_repository.py:66-67` e `83-84`) e o
service traduz para `UserConflictError` (`app/services/user_service.py:106-114` e `165-171`),
que vira `400`.

Em pontos, o mesmo padrão: `PointService` checa o slug antes (`find_by_slug`) e, se o
índice recusar, `UniqueConstraintError` vira `PointConflictError` → `409`
(`app/services/point_service.py:132-147` e `116-123`).

Se a criação falhar (por exemplo, base local já com e-mails repetidos), o backend registra
`warning` "Nao foi possivel criar os indices" e **sobe sem o índice**. No ambiente local,
`bash scripts/reset-db.sh` limpa a base e resolve.

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
- **Limite de tentativas de login.** `LOGIN_MAX_FAILURES` (5) falhas para o mesmo par
  IP + identificador dentro de `LOGIN_WINDOW_SECONDS` (900 s) bloqueiam novas tentativas
  com `429`; um login bem-sucedido zera o contador (`app/api/v1/routes/auth.py:46-76`). A
  chave combina IP **e** identificador porque, atrás do Docker, todos os acessos podem
  chegar com o mesmo IP. O limitador fica em memória (`app/core/rate_limit.py`), criado
  em `create_app()` e guardado em `app.state`: **zera quando o backend reinicia**
  (inclusive no `--reload`) e só vale para uma instância. É preocupação HTTP, por isso
  fica na rota e não no service.

### Pontos de interesse

Implementadas em `app/services/point_service.py`.
Exceções de domínio: `PointInputError` (→ `400`), `PointConflictError` (→ `409`) e
`PointNotFoundError` (→ `404`); a tradução para HTTP fica em `_to_http_error`
(`app/api/v1/routes/admin_points.py:33-38`).

- **Slug normalizado:** espaços das pontas removidos e minúsculas; fora do padrão
  `^[a-z0-9]+(?:-[a-z0-9]+)*$` ou dos limites (3–60) a validação responde `422`.
- **Slug único:** checagem prévia + índice `points_slug_unique`; conflito responde `409`.
- **Slug imutável depois da primeira publicação.** Se `published_at` está preenchido, um
  `PUT` com slug diferente responde `400` (`app/services/point_service.py:165-170`) — os
  QR Codes impressos deixariam de funcionar. Vale mesmo depois de despublicar.
- **Publicação explícita.** `status` só muda por `/publish` e `/unpublish`, nunca pelo
  `PUT`. Publicar preenche `published_at` só na primeira vez
  (`app/services/point_service.py:176-182`); despublicar mantém a data.
- **Rascunho é invisível ao visitante.** As rotas `/public/points` consultam só
  `status="published"` (`app/repositories/point_repository.py`, `list_published` e
  `find_published_by_slug`); rascunho responde `404`.
- **`point_id` malformado** responde `404`, igual a inexistente; o repository nem consulta
  o banco.
- **Atualização parcial:** campo ausente ou `null` não é alterado; corpo vazio responde
  `400`. A lista `media`, quando enviada, substitui a anterior inteira.
- **Mídia:** itens sem `id` recebem um UUID gerado pelo servidor; apenas `kind="photo"`.
- **Capa pública:** `cover_url` é a `url` da primeira mídia `photo`, ou `null`.
- **Ordem:** listas por `name` crescente, sem paginação.

## Papéis

Dois papéis, definidos em `app/core/roles.py`: `admin` (`ROLE_ADMIN`) e `user`
(`ROLE_USER`). Todo usuário novo nasce `user`; só o comando `create-admin` cria ou
promove administradores.

- **`require_admin`** (`app/api/deps.py:105-115`) é a dependência que restringe uma rota ao
  papel `admin`. Ela depende de `get_current_user`, então a ordem dos erros é: sem token
  `401` → token inválido `401` → usuário inativo `403 "Usuario inativo."` → papel
  insuficiente `403 "Acesso restrito a administradores."`.
- **O papel vem do banco**, não do token. `get_current_user` lê o usuário com
  `find_by_email` a cada requisição (`app/api/deps.py:86`) e `require_admin` confere
  `current_user["role"]`. Mudar o papel no banco vale na próxima requisição, sem esperar o
  token expirar. O claim `role` continua no token só como informação para o cliente.
- **Rotas que exigem admin hoje:** `POST /auth/register` (`app/api/v1/routes/auth.py:29-32`)
  e todas as rotas `/admin/points` (dependência no roteador,
  `app/api/v1/routes/admin_points.py:18-22`).

### Primeiro administrador

Como o cadastro exige um administrador, o primeiro é criado pela linha de comando
(`app/cli.py`). Com o ambiente Docker no ar, na raiz do orquestrador:

```bash
docker compose exec backend python -m app.cli create-admin --email <email> --password <senha>
```

- Se o e-mail não existe, cria o usuário com papel `admin` e imprime
  `Administrador criado: <email>`.
- Se já existe, **promove**: grava `role="admin"` e `is_active=True` sem tocar na senha e
  imprime `Usuario promovido a administrador: <email>`. Rodar de novo não duplica.
- Opcional: `--full-name "<nome>"`.
- A senha passa pelas mesmas regras do cadastro e **nunca** é impressa — nem nos erros de
  validação (`exc.errors(include_input=False)`, `app/cli.py:43`).
- Códigos de saída (`app/cli.py:18-20`): `0` sucesso · `1` banco indisponível · `2`
  entrada inválida (senha fraca, e-mail inválido, argumento ausente ou conflito de índice).

A regra fica no service (`UserService.create_or_promote_admin`,
`app/services/user_service.py:74-90`); o comando só conecta ao banco, garante os índices,
chama o service e imprime o resultado.

## Logging

`configure_logging` (`app/core/logging.py`) usa o `logging` da biblioteca padrão, em
texto, uma linha por evento (`data nível módulo mensagem`), com nível por `LOG_LEVEL`.
Cada módulo usa `logger = logging.getLogger(__name__)`. Eventos registrados hoje:

| Nível | Onde | Evento |
|---|---|---|
| `ERROR` | `app/api/deps.py:49` | Falha de acesso ao banco (o texto técnico fica só no log) |
| `WARNING` | `app/main.py:39` | Não foi possível criar os índices |
| `INFO` | `app/api/v1/routes/auth.py:67` | Falha de login, com o identificador digitado |

Senha, hash e token **nunca** são registrados (`07-convencoes.md`, segurança item 4).

## Configuração

Todas as variáveis são lidas por `Settings` a partir do `.env` no diretório do backend
ou do ambiente do processo. No ambiente Docker, elas vêm do `.env` da raiz do
orquestrador, e `MONGODB_URL` e `APP_CORS_ORIGINS` são fixadas no `docker-compose.yml`
(ver [Ambiente local](02-artefato-orquestrador.md#ambiente-local)).

| Variável | Padrão no código | Observação |
|---|---|---|
| `APP_NAME` | `Meu Backend MVP` | `.env.example` sobrescreve para `OculosVR Backend` |
| `APP_ENV` | `development` | |
| `APP_DEBUG` | `false` | Liga o modo debug do FastAPI. `.env.example` usa `true` (máquina local); em qualquer outro ambiente, `false`. Não afeta o `503`, que nunca traz detalhe técnico |
| `APP_HOST` / `APP_PORT` | `0.0.0.0` / `8000` | |
| `APP_CORS_ORIGINS` | `http://localhost:3000,http://127.0.0.1:3000` | lista separada por vírgula |
| `MONGODB_URL` | `mongodb://localhost:27017` | |
| `MONGODB_DB` | `meu_backend_db` | `.env.example` usa `oculosvr_db` |
| `JWT_SECRET_KEY` | `troque_esta_chave` (`DEFAULT_JWT_SECRET_KEY`) | **Fail-fast:** com `APP_ENV` diferente de `development` e esta chave padrão, a aplicação não sobe |
| `JWT_ALGORITHM` | `HS256` | |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `60` | |
| `LOG_LEVEL` | `INFO` | Nível do logging (`DEBUG`, `INFO`, `WARNING`, `ERROR`) |
| `LOGIN_MAX_FAILURES` | `5` | Falhas de login permitidas na janela antes do `429` |
| `LOGIN_WINDOW_SECONDS` | `900` | Janela deslizante do limite de login (15 min) |

**Fail-fast da chave JWT.** A primeira linha de `create_app()` chama
`ensure_secure_settings(settings)` (`app/main.py:24`; regra em
`app/core/config.py:49-57`). Fora de `development`, com a chave padrão, levanta
`InsecureConfigurationError` com o comando para gerar uma chave:

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

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
| `503` em todas as rotas de domínio | MongoDB não conectou no `lifespan`; conferir `MONGODB_URL`, `GET /health/` e o log `ERROR app.api.deps` (o detalhe técnico fica só no log) |
| `InsecureConfigurationError` na subida | `APP_ENV` não é `development` e `JWT_SECRET_KEY` está com a chave padrão; gere uma chave |
| `401`/`403` no `POST /auth/register` | O cadastro exige token de administrador; crie o primeiro com `create-admin` e use **Authorize** no `/docs` |
| `429` no login | 5 falhas seguidas para o mesmo e-mail/username; esperar 15 min ou reiniciar o backend |
| `warning` "Nao foi possivel criar os indices" | Base com e-mails ou usernames repetidos; `bash scripts/reset-db.sh` |
| Erro de credencial placeholder | A URI contém `<db_password>` ou similar; o `MongoManager` aborta sem tentar a rede |
| Erro de CORS no painel | A origem do painel não está em `APP_CORS_ORIGINS` |
| `ModuleNotFoundError` fora do Docker | Virtualenv não ativado ou `pip install -r requirements.txt` não executado |

### Guia de leitura do código

Ordem sugerida para entender o backend: `app/core/config.py` → `app/core/database.py` →
`app/core/security.py` → `app/models/user.py` e `app/schemas/user.py` →
`app/repositories/user_repository.py` → `app/services/user_service.py` →
`app/api/deps.py` → `app/api/v1/routes/` → `app/cli.py` → `tests/` (documentação executável dos
comportamentos esperados). Para pontos de interesse, a mesma sequência com `point.py`,
`point_repository.py`, `point_service.py`, `admin_points.py` e `public_points.py`.

## Ambiente de desenvolvimento

Ferramentas de teste e qualidade ficam fora da imagem de execução, em
`requirements-dev.txt` (que inclui `requirements.txt`). Configuração em `pyproject.toml`.

```bash
cd services/backend
python -m venv .venv
source .venv/Scripts/activate    # Git Bash no Windows; Linux/macOS: .venv/bin/activate
pip install -r requirements-dev.txt
```

## Testes

Verificação mínima antes do commit — os quatro comandos precisam terminar com código 0:

```bash
cd services/backend
ruff check .                              # lint: E,F,W,I,B,UP,C90,PL,ARG,ERA,SIM,RUF
ruff format --check .                     # formatação
mypy app                                  # tipagem estrita
pytest --cov=app --cov-fail-under=80      # testes + cobertura mínima de 80%
```

Regras e limites em `pyproject.toml`: linha de 100 colunas, complexidade máx. 10, máx. 50
comandos por função; `PLR2004`, `ARG001` e `PLR0913` desligadas só em `tests/`. O `B008`
aceita `Depends`/`Query`/etc. do FastAPI como valor padrão. `jose` e `passlib` não têm
tipos: o mypy ignora só os imports delas. Cobertura atual: 93%.

**105 testes**, todos com MongoDB mockado (sem dependência de banco real):

- `tests/test_health.py` — 6 testes: import do app, rota raiz, preflight CORS,
  health com banco up/down, detecção de placeholder de senha sem chamada de rede.
- `tests/test_auth_flow.py` — 28 testes: registro (sucesso, e-mail duplicado, username
  duplicado, senha fraca, chave duplicada pelo índice), autorização do registro (sem token
  `401`, papel `user` `403`, token real de admin `200`, admin inativo `403`), login (sucesso, por username,
  senha errada, usuário inativo, 6ª falha → `429`, sucesso zera o contador),
  `/users/me` (leitura, atualização, username duplicado pela checagem e pelo índice,
  troca de senha, senha atual errada, sem token, token inválido, usuário inativo), falha
  de banco em 3 rotas (comparando o `detail` por igualdade) e `503` sem detalhe técnico
  mesmo com `APP_DEBUG=true`.
- `tests/test_config.py` — 4 testes: fail-fast da chave padrão fora de `development`,
  chave padrão aceita em `development`, chave própria aceita em produção,
  `app_debug` padrão `False`.
- `tests/test_rate_limit.py` — 4 testes do `LoginRateLimiter` com relógio falso: bloqueio
  após 5 falhas, desbloqueio após a janela, `reset` e `clear`.
- `tests/test_indexes.py` — 3 testes: nomes e opções dos índices de `users` e de
  `points`; o `lifespan` sobrevive a falha na criação dos índices.
- `tests/test_user_repository.py` — 3 testes: `DuplicateKeyError` vira
  `UniqueConstraintError` na inserção e na atualização; campo `desconhecido` sem
  `keyPattern`.
- `tests/test_user_service.py` — 4 testes de `create_or_promote_admin` com repository
  falso: cria quando não existe, promove sem alterar a senha, conflito de índice vira
  `UserConflictError`, usuário que some durante a promoção.
- `tests/test_cli.py` — 6 testes do `create-admin`: cria e imprime o e-mail sem a senha,
  promove, senha fraca → `2`, banco fora → `1`, falha no repository → `1`, conflito → `2`.
- `tests/test_admin_points.py` — 32 testes (com `parametrize`): criação (slug normalizado,
  slug inválido `422`, campo não texto `422`, slug duplicado pela checagem e pelo índice
  `409`, banco fora `503`), listagem com filtro e filtro inválido `422`, leitura e `404`,
  atualização (nome, mídia com ids gerados, corpo vazio `400`, slug travado depois de
  publicar `400`, slug livre em rascunho, slug de outro ponto `409`, índice `409`, ponto
  removido no meio `404`), remoção `204`/`404`, publicação que só preenche `published_at`
  uma vez, despublicação que mantém a data, `503` em cinco rotas, `401` sem token em
  quatro rotas e `403` para papel `user`.
- `tests/test_public_points.py` — 5 testes: lista só com os campos do resumo e `cover_url`
  da primeira foto, detalhe sem `id`/`status`/datas, rascunho `404` e `503` nas duas rotas.
- `tests/test_point_repository.py` — 10 testes com collection falsa: id malformado não
  toca o banco, filtros e ordenação por `name`, retornos de escrita, `DuplicateKeyError`
  vira `UniqueConstraintError`, `PyMongoError` vira `ConnectionError`, banco ausente.

Fixtures em `conftest.py`: `mongo_up`, `mongo_down`, `client`, `as_admin` e duas
`autouse`. `as_admin` registra `app.dependency_overrides[require_admin]` devolvendo um
administrador fixo (`ADMIN_USER`) e remove **só** esse override ao final — use-a em testes
de rotas restritas que não estão testando a autorização em si. As `autouse` são
`fake_ensure_indexes` (substitui `app.main.ensure_indexes`, para o `lifespan` não tentar
falar com um MongoDB real, já que `mongo_up` deixa `connected=True`) e
`clear_login_rate_limiter` (cada teste começa sem falhas de login).

**Integração contínua.** Os mesmos quatro comandos rodam no GitHub em todo PR e push na
`main`, pelo workflow `.github/workflows/ci.yml` (check `CI / validacao`) — ver
[02-artefato-orquestrador.md](02-artefato-orquestrador.md#integração-contínua).

## Nota sobre o README do submódulo

Desde o plano 002, o `README.md` de `services/backend` é curto (menos de 50 linhas) e
correto: diz como rodar e testar e aponta para este documento. Arquitetura e
comportamento ficam aqui, em `docs/`. O conteúdo útil do README antigo (problemas comuns
e guia de leitura) foi trazido para a seção [Execução](#execução).
