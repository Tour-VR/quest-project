# 003 — Qualidade do backend

| | |
|---|---|
| **Status** | Em execução — Heitor Aquino — 2026-11-09 |
| **Fase** | 0 — Fundação de qualidade |
| **Depende de** | 002 |
| **Dívidas atendidas** | nenhuma (implementa as diretrizes de engenharia do plano 000 §4 no backend) |
| **ADRs relacionadas** | nenhuma |
| **Artefatos afetados** | Backend |
| **Planejado em** | 2026-11-05 |
| **Validado em** | 2026-11-05 por Ciro Macedo |
| **Executado em** | — |

---

## 1. Objetivo

Tornar verificáveis no backend as regras de qualidade do projeto: lint rígido (Ruff),
formatação automática, tipagem estrita (mypy) e cobertura mínima de 80% (pytest-cov). O
código atual é corrigido até passar. A partir daqui, todo plano de backend é reprovado se
quebrar alguma dessas regras.

## 2. Leia antes de começar

- `docs/03-artefato-backend.md`
- `docs/07-convencoes.md` (seção Backend — Python)
- `docs/tasks/000-visao-macro-opcao-b.md` §4 e §6.1 (tabela de qualidade)

## 3. Estado esperado ao iniciar

- Plano 002 concluído (Docker Compose disponível; não é usado diretamente aqui).
- `services/backend/requirements.txt:10` — `pytest==9.0.2` misturado às dependências de
  execução; não há `pytest-cov`, `ruff` nem `mypy`.
- Não existe `pyproject.toml` nem `requirements-dev.txt`.
- Rotas sem anotação de retorno: `app/api/v1/routes/auth.py:16` (`register`) e `:34`
  (`login`); `app/api/v1/routes/users.py:24`, `:34`, `:56`.
- `app/main.py:17` — `lifespan` sem anotação de retorno.
- `app/core/security.py:73-80` — `decode_access_token` retorna o resultado de `jwt.decode`
  (biblioteca `python-jose`, sem tipos): `mypy --strict` acusa *returning Any*.
- `app/api/v1/router.py` e `app/api/v1/routes/auth.py`, `users.py` sem
  `from __future__ import annotations` (exigido por `docs/07-convencoes.md`).
- Parâmetros com `Depends(...)` como valor padrão (`app/api/deps.py:39-40`, rotas): a regra
  `B008` do Ruff acusa isso, embora seja o padrão do FastAPI.
- 24 testes passando (`tests/test_auth_flow.py`, `tests/test_health.py`).

## 4. Escopo

**Dentro:**

- `pyproject.toml` com configuração de Ruff, mypy, pytest e coverage;
- `requirements-dev.txt`; `pytest` sai de `requirements.txt`;
- correções no código de `app/` até `ruff check`, `ruff format --check`, `mypy app` e
  `pytest --cov` passarem;
- testes novos apenas se a cobertura ficar abaixo de 80%.

**Fora:**

- qualquer mudança de comportamento da API (respostas, status, mensagens);
- correção das dívidas DT-006, DT-007, DT-009 — plano 007;
- `scripts/validate.sh` — plano 005 (ele chamará os comandos definidos aqui);
- CI — plano 006.

## 5. Decisões tomadas no planejamento

| Questão | Decisão | Motivo |
|---|---|---|
| Regras do Ruff | `E,F,W,I,B,UP,C90,PL,ARG,ERA,SIM,RUF` | 000 §6.1 |
| Comprimento de linha | 100 | O código atual já cabe; evita quebra artificial |
| `B008` com `Depends` | `extend-immutable-calls` para `fastapi.Depends`, `fastapi.Query`, `fastapi.Path`, `fastapi.Body`, `fastapi.File`, `fastapi.Form`, `fastapi.Security` | Padrão oficial do FastAPI; não reescrever com `Annotated` agora |
| Bibliotecas sem tipos (`jose`, `passlib`) | `ignore_missing_imports` só para elas | São dependências externas; o código do projeto fica estrito |
| `Any` vindo de `jwt.decode` | Anotar a variável local: `payload: dict[str, Any] = jwt.decode(...)` | Tipagem explícita sem `cast` espalhado |
| mypy nos testes | Não (`mypy app`) | Testes usam `monkeypatch` com funções falsas; o custo não compensa |
| Regras desligadas em `tests/` | `PLR2004`, `ARG001`, `PLR0913` | Fixtures e valores literais são normais em teste |
| Cobertura | `--cov=app --cov-fail-under=80`, relatório `term-missing` | 000 §6.1 |
| Versões | Fixadas com `==` em `requirements-dev.txt` | Igual ao `requirements.txt` existente |

## 6. Passos de implementação

Todos no repositório `services/backend`, branch `plano/003-qualidade-backend`.

### Passo 1 — Separar dependências

**Arquivo:** `requirements.txt` — remover a linha `pytest==9.0.2`. Manter o resto.

**Arquivo novo:** `requirements-dev.txt`

```
-r requirements.txt
pytest==9.0.2
pytest-cov==7.0.0
ruff==0.14.3
mypy==1.18.2
types-passlib==1.7.7.20250602
```

Se alguma versão acima não existir no PyPI no momento da execução, use a versão estável
mais recente da mesma linha principal e registre no PR (desvio permitido).

Crie o ambiente virtual e instale: `python -m venv .venv`, ative-o
(`source .venv/Scripts/activate` no Git Bash do Windows, `source .venv/bin/activate` no
Linux/macOS) e `pip install -r requirements-dev.txt`.

**Verificação:** `pytest -q` → 24 passando.

### Passo 2 — `pyproject.toml`

**Arquivo novo:** `pyproject.toml`

```toml
[project]
name = "tourvr-backend"
version = "1.0.0"
requires-python = ">=3.11"

[tool.ruff]
line-length = 100
target-version = "py311"

[tool.ruff.lint]
select = ["E", "F", "W", "I", "B", "UP", "C90", "PL", "ARG", "ERA", "SIM", "RUF"]

[tool.ruff.lint.flake8-bugbear]
extend-immutable-calls = [
  "fastapi.Depends", "fastapi.Query", "fastapi.Path", "fastapi.Body",
  "fastapi.File", "fastapi.Form", "fastapi.Security",
]

[tool.ruff.lint.mccabe]
max-complexity = 10

[tool.ruff.lint.pylint]
max-statements = 50

[tool.ruff.lint.per-file-ignores]
"tests/**" = ["PLR2004", "ARG001", "PLR0913"]

[tool.mypy]
python_version = "3.11"
strict = true
packages = ["app"]

[[tool.mypy.overrides]]
module = ["jose.*", "passlib.*"]
ignore_missing_imports = true

[tool.pytest.ini_options]
testpaths = ["tests"]
addopts = "-q"

[tool.coverage.run]
source = ["app"]
branch = true

[tool.coverage.report]
show_missing = true
skip_covered = true
```

### Passo 3 — Aplicar formatação e correções automáticas

```bash
ruff format .
ruff check . --fix
```

Commit separado só com essas mudanças mecânicas (facilita a revisão). Depois rode
`ruff check .` e corrija **à mão** o que restar, sem desligar regras. Casos previstos:

- `UP017` (`timezone.utc` → `UTC`): aceitar a correção automática
  (`from datetime import UTC, datetime`).
- `ERA001` (código comentado): os comentários de `app/api/v1/router.py:7-18` são texto, não
  código; se o Ruff acusar algum, reescreva como frase ("Health check da API.").
- `PLR0911`/`PLR0912` não são esperados; se aparecerem, extraia uma função auxiliar.

**Verificação:** `ruff check .` e `ruff format --check .` sem saída de erro.

### Passo 4 — Tipagem estrita

Rode `mypy app` e corrija, sem `# type: ignore` genérico. Correções previstas:

**`app/main.py`** — tipar o `lifespan`:

```python
from collections.abc import AsyncIterator

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
```

**`app/api/v1/routes/auth.py`** e **`users.py`** — acrescentar
`from __future__ import annotations` e anotar os retornos com `dict[str, Any]` (é o que os
services devolvem; o `response_model` continua definindo o contrato HTTP):

```python
@router.post("/register", response_model=UserRegisterResponse)
async def register(
    payload: UserCreate,
    service: UserService = Depends(get_user_service),
) -> dict[str, Any]:
```

> Atenção: com `from __future__ import annotations` o FastAPI ainda resolve os tipos,
> porque os modelos estão importados no módulo. Rode os testes logo após esta mudança.

**`app/api/v1/router.py`** — acrescentar `from __future__ import annotations` e uma
docstring de módulo.

**`app/core/security.py:73`**:

```python
def decode_access_token(token: str) -> dict[str, Any]:
    """Decodifica o JWT e devolve os dados do usuario autenticado."""

    payload: dict[str, Any] = jwt.decode(
        token,
        settings.jwt_secret_key,
        algorithms=[settings.jwt_algorithm],
    )
    return payload
```

Faça o mesmo padrão (variável local anotada) em `create_access_token` se o mypy acusar o
`jwt.encode` (`encoded: str = jwt.encode(...)`), e em `hash_password`/`verify_password`
(`passlib`).

**`app/repositories/user_repository.py`** — os métodos já retornam `dict[str, Any] | None`;
se o mypy acusar `Any` retornado por `find_one`, anote a variável local do mesmo modo.

**Verificação:** `mypy app` → `Success: no issues found`. `pytest -q` → 24 passando.

### Passo 5 — Cobertura

```bash
pytest --cov=app --cov-fail-under=80
```

Se passar, siga. Se ficar abaixo de 80%, escreva testes **no padrão dos existentes**
(`monkeypatch` em `UserRepository`, fixture `client`) para as linhas apontadas em
`term-missing`, começando por `app/core/database.py` (ramos de `close` e
`_format_connection_error`) e `app/repositories/user_repository.py` (tradução de
`PyMongoError` em `ConnectionError`). Coloque-os em `tests/test_database.py` e
`tests/test_user_repository.py`.

### Passo 6 — Documentação

No orquestrador, branch `plano/003-qualidade-backend`:

- `docs/03-artefato-backend.md`: seção **Stack** com Ruff, mypy e pytest-cov; seção
  **Testes** com os quatro comandos de verificação e o número atualizado de testes; nova
  subseção **Ambiente de desenvolvimento** (venv + `requirements-dev.txt`).
- `docs/07-convencoes.md`, seção Backend: "Verificação mínima antes do commit: `ruff check
  .`, `ruff format --check .`, `mypy app`, `pytest --cov=app --cov-fail-under=80`".
- `services/backend/README.md` (curto, do plano 002): seção "Como testar" com os quatro
  comandos.

## 7. Testes

| Arquivo | Teste | Verifica |
|---|---|---|
| `tests/test_*.py` existentes | os 24 | Comportamento inalterado após as correções |
| `tests/test_database.py` (se necessário) | ramos de conexão | Cobertura ≥ 80% |
| `tests/test_user_repository.py` (se necessário) | tradução de erro | Cobertura ≥ 80% |

```bash
cd services/backend
ruff check .
ruff format --check .
mypy app
pytest --cov=app --cov-fail-under=80
```

## 8. Documentação a atualizar

- [ ] `docs/03-artefato-backend.md` — passo 6
- [ ] `docs/07-convencoes.md` — passo 6
- [ ] `services/backend/README.md` — passo 6

## 9. Critérios de aceite

- [ ] Os quatro comandos da seção 7 terminam com código 0
- [ ] Nenhuma regra desligada além das listadas na seção 5
- [ ] Nenhum `# type: ignore` sem código de erro específico e comentário do motivo
- [ ] `pytest` não está mais em `requirements.txt`
- [ ] Respostas da API idênticas (os 24 testes originais passam sem alteração de asserção)
- [ ] Documentação atualizada

## 10. Commits esperados

`services/backend`:

```
build: separa dependencias de desenvolvimento e adiciona pyproject.toml
style: aplica ruff format e correcoes automaticas do ruff
refactor: corrige avisos restantes do ruff
refactor: tipa o codigo para mypy strict
test: amplia a cobertura para o minimo de 80%      (somente se necessario)
docs: atualiza o README com os comandos de verificacao
```

Orquestrador:

```
docs: documenta lint, tipagem e cobertura do backend
```

## 11. Riscos e pontos de atenção

- **`from __future__ import annotations` em rotas FastAPI** pode quebrar a resolução de
  tipos se algum modelo for importado só dentro de `if TYPE_CHECKING`. Não use
  `TYPE_CHECKING` em arquivos de rota.
- **`ruff --fix` reordena imports**; em `tests/conftest.py`, `from main import app` precisa
  continuar funcionando. Rode `pytest` depois de cada passo.
- **Python local diferente de 3.11**: aceitável se for 3.11 ou mais novo; registre a versão
  usada no PR.
- **Windows**: o executável do venv fica em `.venv/Scripts/`, não em `.venv/bin/`.

## 12. Verificação pelo aluno

1. No terminal, `cd services/backend`, ative o ambiente (`source .venv/Scripts/activate`)
   e rode `pytest --cov=app`. No final aparece uma tabela com a porcentagem de cada
   arquivo e a linha `TOTAL` com 80% ou mais.
2. Rode `mypy app`. Deve aparecer `Success: no issues found`.
3. Rode `bash ../../scripts/up.sh` e abra `http://localhost:8000/docs`: a API continua
   funcionando como antes.

---

## Prompt de delegação

Cole no Claude Code, na pasta `quest-project`, trocando o nome:

```text
Você é a sessão de EXECUÇÃO do projeto TourVR.
Execute o plano docs/tasks/003-qualidade-backend.md.
Antes de qualquer ação, leia docs/tasks/protocolo-execucao.md e siga o "Prompt 1 — EXECUTAR" etapa por etapa.
Meu nome, para registrar no plano: <SEU NOME>
```
