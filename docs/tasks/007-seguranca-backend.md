# 007 — Segurança do backend

| | |
|---|---|
| **Status** | Em execução — Heitor Aquino — 2026-11-11 |
| **Fase** | 1 — Domínio do campus (backend) |
| **Depende de** | 006 |
| **Dívidas atendidas** | DT-006, DT-007 (itens 1 a 3), DT-009 (itens 4 a 6, parcial) |
| **ADRs relacionadas** | ADR-0003 (JWT) |
| **Artefatos afetados** | Backend · Orquestrador (documentação) |
| **Planejado em** | 2026-11-05 |
| **Validado em** | 2026-11-05 por Ciro Macedo |
| **Executado em** | — |

---

## 1. Objetivo

Fechar as falhas de segurança que impedem expor o backend: chave JWT padrão aceita em
produção, detalhe técnico do banco vazando no `503`, ausência de índices únicos e login
sem limite de tentativas. É o primeiro plano da Fase 1 porque todas as rotas novas do
domínio vão herdar estas proteções.

## 2. Leia antes de começar

- `docs/03-artefato-backend.md`
- `docs/06-contrato-api.md` — seções `POST /auth/login` e "Formato de erro"
- `docs/implementacoes-futuras/DT-006-integridade-dados-mongodb.md`
- `docs/implementacoes-futuras/DT-007-hardening-autenticacao.md`
- `docs/implementacoes-futuras/DT-009-observabilidade-e-logging.md`

## 3. Estado esperado ao iniciar

Produzido pelos planos 002–006:

- `docker-compose.yml` na raiz, com `mongo`, `backend` e `frontend` (plano 002).
- `services/backend/pyproject.toml` com Ruff, `mypy --strict` e `pytest-cov` com mínimo de
  80%; `requirements-dev.txt` (plano 003).
- `bash scripts/validate.sh` passando, com E2E de login `@golden` (plano 005).
- CI rodando em PR no backend e no orquestrador (plano 006).

Verificado no código em 2026-11-05 (as linhas podem ter se deslocado após o plano 003;
procure pelo trecho):

- `app/core/config.py:11` — `app_debug: bool = True` (padrão inseguro).
- `app/core/config.py:19` — `jwt_secret_key: str = "troque_esta_chave"`; nada impede a
  aplicação de subir com esse valor.
- `app/api/deps.py:25-35` — `build_database_http_exception` concatena `{exc}` no
  `detail` quando `settings.app_debug` é verdadeiro.
- `app/main.py:16-27` — o `lifespan` só conecta e desconecta; não cria índice algum.
- `app/repositories/user_repository.py:54-58` — `create_user` traduz qualquer
  `PyMongoError` (inclusive `DuplicateKeyError`) em `ConnectionError`, que vira `503`.
- `app/api/v1/routes/auth.py:33-48` — `POST /auth/login` sem limite de tentativas.
- `tests/conftest.py:12-43` — fixtures `mongo_up`, `mongo_down`, `client`; o `mongo_up`
  simula `ping` com sucesso, então `mongo_manager.connected` fica `True` nos testes.
- Nenhuma ocorrência de `logging` em `app/`.

## 4. Escopo

**Dentro:**

- fail-fast de configuração insegura e `app_debug` padrão `False`;
- `503` sem detalhe técnico, com o erro registrado em log no servidor;
- logging básico com a biblioteca padrão, nível por `LOG_LEVEL`;
- índices únicos em `users.email` e `users.username` (parcial);
- tradução de chave duplicada em conflito de domínio (`400`);
- limite de tentativas de login (`429`).

**Fora:**

- refresh token e cookie `httpOnly` (DT-007 itens 4 e 5) — dependem da ADR-0009 e o
  visitante não se autentica; continuam abertos;
- logs em JSON e `request_id` (DT-009 itens 1 e 2) — não necessários neste porte;
- limite de tentativas em `POST /auth/register` — a rota passa a exigir administrador no
  plano 008;
- papéis e autorização — plano 008.

## 5. Decisões tomadas no planejamento

| Questão | Decisão | Motivo |
|---|---|---|
| Onde validar a configuração | Função `ensure_secure_settings(settings)` chamada em `create_app()` | Validar dentro de `Settings()` quebraria o `import` nos testes; a função é testável com instâncias próprias |
| Quando recusar subir | `app_env != "development"` **e** `jwt_secret_key == DEFAULT_JWT_SECRET_KEY` | Desenvolvimento local continua simples; qualquer outro ambiente exige chave real |
| Como o repository sinaliza duplicata | Exceção `UniqueConstraintError(field)` em `app/repositories/errors.py` | Repository não conhece exceção de domínio; o service traduz. Reaproveitada pelos pontos no plano 009 |
| Índice de `username` | Único com `partialFilterExpression: {"username": {"$type": "string"}}` | Vários usuários sem username (`null`) não podem colidir |
| Falha ao criar índice | Registrar `warning` no log e seguir subindo | A API já sobe sem banco hoje (`database.py:1`); manter |
| Limite de login | 5 falhas por par (IP, identificador) em 15 min → `429`; sucesso zera o contador | Contrato do projeto; em memória basta para instância única |
| Onde fica o limitador | `LoginRateLimiter` em `app.state`, criado em `create_app()`, aplicado na rota | Limite de taxa é preocupação HTTP, não regra de negócio |
| Logging | `logging` da biblioteca padrão, formato texto, `LOG_LEVEL` (padrão `INFO`) | Suficiente; sem dependência nova |

## 6. Passos de implementação

Todos no submódulo `services/backend`, branch `plano/007-seguranca-backend`.

### Passo 1 — Configuração segura

**Arquivo:** `app/core/config.py`

- Constante de módulo `DEFAULT_JWT_SECRET_KEY = "troque_esta_chave"`; o campo usa essa
  constante como padrão.
- `app_debug: bool = False`.
- Novos campos: `log_level: str = "INFO"`, `login_max_failures: int = 5`,
  `login_window_seconds: int = 900`.
- Nova exceção e função:

```python
class InsecureConfigurationError(RuntimeError):
    """Configuracao que nao pode ser usada fora do ambiente de desenvolvimento."""


def ensure_secure_settings(current: Settings) -> None:
    """Recusa subir com a chave JWT padrao fora de development."""

    if current.app_env != "development" and current.jwt_secret_key == DEFAULT_JWT_SECRET_KEY:
        raise InsecureConfigurationError(
            "JWT_SECRET_KEY nao foi configurada. Gere uma chave com "
            "python -c \"import secrets; print(secrets.token_hex(32))\" e defina no .env."
        )
```

**Arquivo:** `app/main.py` — primeira linha de `create_app()`:
`ensure_secure_settings(settings)`.

### Passo 2 — Logging básico

**Arquivo novo:** `app/core/logging.py`

```python
def configure_logging(level: str) -> None:
    """Configura o logging padrao da aplicacao (texto, uma linha por evento)."""
    logging.basicConfig(
        level=level.upper(),
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
```

Chamar `configure_logging(settings.log_level)` em `create_app()`, logo após
`ensure_secure_settings`. Cada módulo que registra eventos usa
`logger = logging.getLogger(__name__)`.

Regra (já em `docs/07-convencoes.md`, segurança item 4): nunca registrar senha, hash ou
token.

### Passo 3 — `503` sem vazamento

**Arquivo:** `app/api/deps.py`, função `build_database_http_exception`

- Remover o uso de `settings.app_debug` e a concatenação de `{exc}`.
- Registrar: `logger.error("Falha de acesso ao banco: %s", exc)`.
- `detail` fica sempre `"Banco de dados indisponivel."`.
- Remover o `import` de `settings` se ficar sem uso.

### Passo 4 — Erro de chave duplicada no repository

**Arquivo novo:** `app/repositories/errors.py`

```python
class UniqueConstraintError(ValueError):
    """Violacao de indice unico no MongoDB."""

    def __init__(self, field: str) -> None:
        super().__init__(f"Valor duplicado no campo {field}.")
        self.field = field


def duplicated_field(exc: DuplicateKeyError) -> str:
    """Extrai o nome do campo do erro do MongoDB (keyPattern)."""
    details = exc.details or {}
    key_pattern = details.get("keyPattern") or {}
    return next(iter(key_pattern), "desconhecido")
```

**Arquivo:** `app/repositories/user_repository.py` — em `create_user` e
`update_user_by_email`, capturar `DuplicateKeyError` **antes** de `PyMongoError` (é
subclasse) e levantar `UniqueConstraintError(duplicated_field(exc))`.

**Arquivo:** `app/services/user_service.py`

- Em `register_user`, envolver `create_user` em `try/except UniqueConstraintError` e
  levantar `UserConflictError` com a mensagem já existente:
  `"Ja existe um usuario com este email."` se `exc.field == "email"`, senão
  `"Ja existe um usuario com este username."`.
- Em `update_current_user`, o mesmo para `update_user_by_email` (só pode ser `username`).
- As verificações prévias (`find_by_email`, `find_by_username`) **continuam**: dão a
  mensagem amigável no caso comum; o índice é a garantia.

### Passo 5 — Índices na subida

**Arquivo novo:** `app/core/indexes.py`

```python
async def ensure_indexes(database: Any) -> None:
    """Cria, de forma idempotente, os indices de que o dominio depende."""

    users = database["users"]
    await users.create_index("email", unique=True, name="users_email_unique")
    await users.create_index(
        "username",
        unique=True,
        name="users_username_unique",
        partialFilterExpression={"username": {"$type": "string"}},
    )
```

`create_index` com o mesmo nome e as mesmas opções é idempotente no MongoDB.

**Arquivo:** `app/main.py`, `lifespan` — depois de `await mongo_manager.connect()`:

```python
if mongo_manager.connected and mongo_manager.database is not None:
    try:
        await ensure_indexes(mongo_manager.database)
    except PyMongoError as exc:
        logger.warning("Nao foi possivel criar os indices: %s", exc)
```

Importar com `from app.core.indexes import ensure_indexes` (o teste substitui
`app.main.ensure_indexes`).

**Arquivo:** `tests/conftest.py` — nova fixture `autouse=True` que substitui
`app.main.ensure_indexes` por uma corrotina vazia. Sem isso, os testes tentariam falar com
um MongoDB real, porque `mongo_up` deixa `connected=True`.

### Passo 6 — Limite de tentativas de login

**Arquivo novo:** `app/core/rate_limit.py`

```python
class LoginRateLimiter:
    """Janela deslizante de falhas de login, em memoria (instancia unica)."""

    def __init__(
        self,
        max_failures: int,
        window_seconds: int,
        clock: Callable[[], float] = time.monotonic,
    ) -> None: ...

    def is_blocked(self, key: str) -> bool: ...      # descarta falhas fora da janela
    def register_failure(self, key: str) -> None: ...
    def reset(self, key: str) -> None: ...
    def clear(self) -> None: ...                       # usado pelos testes
```

Armazenamento: `dict[str, deque[float]]`. `is_blocked` remove do início as falhas mais
antigas que `clock() - window_seconds` e retorna `len(falhas) >= max_failures`.

**Arquivo:** `app/main.py` — em `create_app()`:
`application.state.login_rate_limiter = LoginRateLimiter(settings.login_max_failures,
settings.login_window_seconds)`.

**Arquivo:** `app/api/deps.py` — `def get_login_rate_limiter(request: Request) ->
LoginRateLimiter` lendo de `request.app.state`.

**Arquivo:** `app/api/v1/routes/auth.py`, rota `login`:

1. Receber também `request: Request` e
   `limiter: LoginRateLimiter = Depends(get_login_rate_limiter)`.
2. `key = f"{request.client.host if request.client else 'desconhecido'}|{payload.email}"`.
3. Se `limiter.is_blocked(key)` → `HTTPException(429, "Muitas tentativas. Tente novamente
   em alguns minutos.")`.
4. Em `AuthenticationError`: `limiter.register_failure(key)`, registrar
   `logger.info("Falha de login para o identificador %s", payload.email)` e devolver o
   `401` de sempre.
5. Em sucesso: `limiter.reset(key)`.

**Arquivo:** `tests/conftest.py` — fixture `autouse=True` que chama
`app.state.login_rate_limiter.clear()` antes de cada teste.

### Passo 7 — Variáveis de ambiente

- `services/backend/.env.example`: `APP_DEBUG=true` continua (é desenvolvimento), com
  comentário "em qualquer ambiente que nao seja a sua maquina, use false";
  acrescentar `LOG_LEVEL=INFO`; acima de `JWT_SECRET_KEY`, comentário com o comando de
  geração do passo 1.
- `.env.example` da raiz (orquestrador, criado no plano 002): acrescentar `LOG_LEVEL=INFO`
  e o mesmo comentário sobre a chave.
- `docker-compose.yml`: nada muda (o backend já recebe o `.env`).

## 7. Testes

Padrão de `tests/test_auth_flow.py`: `monkeypatch` nos métodos do repository, sem banco.

| Arquivo | Teste | Verifica |
|---|---|---|
| `tests/test_config.py` (novo) | `test_ensure_secure_settings_rejects_default_secret_outside_development` | `Settings(app_env="production")` com chave padrão levanta `InsecureConfigurationError` |
| `tests/test_config.py` | `test_ensure_secure_settings_accepts_default_secret_in_development` | Não levanta |
| `tests/test_config.py` | `test_ensure_secure_settings_accepts_custom_secret_in_production` | Não levanta |
| `tests/test_config.py` | `test_app_debug_defaults_to_false` | `Settings.model_fields["app_debug"].default is False` |
| `tests/test_rate_limit.py` (novo) | `test_blocks_after_max_failures` | Relógio falso; 5 falhas → bloqueado |
| `tests/test_rate_limit.py` | `test_unblocks_after_window` | Avança o relógio 901 s → desbloqueado |
| `tests/test_rate_limit.py` | `test_reset_clears_failures` | `reset` zera |
| `tests/test_auth_flow.py` | `test_login_sixth_failed_attempt_returns_429` | 5 respostas `401` e a 6ª `429` com a mensagem do contrato |
| `tests/test_auth_flow.py` | `test_login_success_resets_failures` | 4 falhas, 1 sucesso, nova falha → `401` (não `429`) |
| `tests/test_auth_flow.py` | `test_register_duplicate_key_returns_400` | `create_user` falso levanta `UniqueConstraintError("email")` → `400` com a mensagem de e-mail |
| `tests/test_auth_flow.py` | `test_database_error_detail_is_not_exposed` | Com `settings.app_debug=True` (monkeypatch), `503` tem `detail` exatamente `"Banco de dados indisponivel."` |
| `tests/test_auth_flow.py` | ajustar `test_*_returns_503_*` | Passam a comparar `detail` por igualdade |
| `tests/test_indexes.py` (novo) | `test_ensure_indexes_creates_user_indexes` | Banco falso registra as chamadas; confere nomes, `unique` e `partialFilterExpression` |
| `tests/test_indexes.py` | `test_lifespan_survives_index_failure` | `app.main.ensure_indexes` falso levanta `PyMongoError`; `TestClient(app)` sobe e `/health/` responde `200` |
| `tests/test_user_repository.py` (novo) | `test_create_user_translates_duplicate_key` | Collection falsa levanta `DuplicateKeyError(..., details={"keyPattern": {"email": 1}})` → `UniqueConstraintError` com `field == "email"` |

Para o teste de `DuplicateKeyError`: `DuplicateKeyError("dup", 11000, {"keyPattern":
{"email": 1}})`.

```bash
cd services/backend && pytest -v
bash scripts/validate.sh
```

## 8. Documentação a atualizar

- [ ] `docs/03-artefato-backend.md` — tabela de Configuração (`APP_DEBUG` padrão `false`,
      `LOG_LEVEL`, `LOGIN_MAX_FAILURES`, `LOGIN_WINDOW_SECONDS`, fail-fast da chave);
      remover o aviso "Não há índice único"; descrever os índices; estrutura com
      `indexes.py`, `logging.py`, `rate_limit.py`, `repositories/errors.py`; contagem de
      testes atualizada.
- [ ] `docs/06-contrato-api.md` — `POST /auth/login`: erro `429`; "Formato de erro": o
      `503` nunca traz detalhe técnico; `POST /auth/register`: `400` também por índice.
- [ ] `docs/implementacoes-futuras/DT-006-...md` — `Resolvida` (plano 007).
- [ ] `docs/implementacoes-futuras/DT-007-...md` — Status `Parcial`: itens 1–3 resolvidos
      pelo plano 007; 4 e 5 seguem abertos.
- [ ] `docs/implementacoes-futuras/DT-009-...md` — Status `Parcial`: itens 4–6 resolvidos
      (sem vazamento no `503`, `app_debug=False`, logging básico); 1–2 abertos.
- [ ] `docs/implementacoes-futuras/README.md` — status das três dívidas.

## 9. Critérios de aceite

- [ ] Com `APP_ENV=production` e chave padrão, `uvicorn main:app` termina com
      `InsecureConfigurationError` e a mensagem de como gerar a chave
- [ ] `503` nunca contém o texto da exceção, mesmo com `APP_DEBUG=true`
- [ ] Índices `users_email_unique` e `users_username_unique` existem no MongoDB do compose
      após `docker compose up` (`docker compose exec mongo mongosh tourvr_db --eval
      "db.users.getIndexes()"`)
- [ ] A 6ª tentativa de login errada na mesma janela retorna `429`
- [ ] Chave duplicada na inserção retorna `400`, não `500` nem `503`
- [ ] Todos os testes da seção 7 passando, cobertura ≥ 80%
- [ ] `bash scripts/validate.sh` passando
- [ ] Documentação da seção 8 atualizada

## 10. Commits esperados

Backend (`services/backend`), branch `plano/007-seguranca-backend`:

```
feat(config): recusa subir com a chave JWT padrao fora de development
feat(core): configura logging basico com nivel por LOG_LEVEL
fix(api): remove detalhe tecnico da resposta 503
feat(db): cria indices unicos de usuarios na subida da aplicacao
fix(users): traduz chave duplicada em conflito de dominio
feat(auth): limita tentativas de login por IP e identificador
test: cobre configuracao, indices, chave duplicada e limite de login
```

Orquestrador, mesma branch:

```
docs: atualiza backend e contrato com as protecoes do plano 007
docs: marca DT-006 como resolvida e DT-007 e DT-009 como parciais
```

## 11. Riscos e pontos de atenção

- **Testes tentando falar com banco real.** Se algum teste demorar ~1,5 s e falhar com
  `ServerSelectionTimeoutError`, a fixture que substitui `app.main.ensure_indexes` não
  está sendo aplicada.
- **Base já com duplicatas.** O índice único falha se a collection tiver e-mails
  repetidos; o `warning` aparece no log e a API sobe sem o índice. No ambiente dos alunos
  basta `bash scripts/reset-db.sh` (plano 002). Documentar isso no `03-artefato-backend.md`.
- **Limite em memória** zera quando o backend reinicia (inclusive no `--reload`). É
  esperado; registrar no documento do backend.
- **IP atrás de proxy.** Em compose, todos os acessos podem vir do mesmo IP da rede
  Docker; por isso a chave combina IP **e** identificador.
- **E2E de login** (plano 005) faz um único login correto; não é afetado pelo limite.

## 12. Verificação pelo aluno

1. Rode `bash scripts/up.sh` e abra <http://localhost:8000/docs>.
2. Abra `POST /auth/login` → **Try it out**. Use um e-mail qualquer e a senha
   `errada123`. Clique **Execute** seis vezes. As cinco primeiras respostas são `401`; a
   sexta é `429` com "Muitas tentativas".
3. No terminal: `docker compose exec mongo mongosh tourvr_db --eval
   "db.users.getIndexes()"`. A saída mostra `users_email_unique` e
   `users_username_unique`.
4. No terminal: `docker compose stop mongo`. No Swagger, tente o login de novo com
   **outro** e-mail (o anterior ficou bloqueado por 15 minutos): a resposta é `503` com apenas "Banco de dados indisponivel." — sem texto técnico.
   Depois: `docker compose start mongo`.

---

## Prompt de delegação

Cole no Claude Code, na pasta `quest-project`, trocando o nome:

```text
Você é a sessão de EXECUÇÃO do projeto TourVR.
Execute o plano docs/tasks/007-seguranca-backend.md.
Antes de qualquer ação, leia docs/tasks/protocolo-execucao.md e siga o "Prompt 1 — EXECUTAR" etapa por etapa.
Meu nome, para registrar no plano: <SEU NOME>
```
