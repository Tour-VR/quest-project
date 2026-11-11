# 008 — Papéis e administrador

| | |
|---|---|
| **Status** | Em execução — Heitor Aquino — 2026-11-11 |
| **Fase** | 1 — Domínio do campus (backend) |
| **Depende de** | 007 |
| **Dívidas atendidas** | DT-008 |
| **ADRs relacionadas** | ADR-0003 (JWT) |
| **Artefatos afetados** | Backend · Orquestrador (E2E e documentação) |
| **Planejado em** | 2026-11-05 |
| **Validado em** | 2026-11-05 por Ciro Macedo |
| **Executado em** | — |

---

## 1. Objetivo

Fazer o campo `role` valer alguma coisa: criar a dependência que restringe rotas ao papel
`admin`, um comando para criar o primeiro administrador e fechar o cadastro público
(`POST /auth/register` passa a exigir administrador). Sem isso, as rotas `/admin/...` dos
planos 009 em diante não teriam proteção.

## 2. Leia antes de começar

- `docs/03-artefato-backend.md`
- `docs/06-contrato-api.md` — `POST /auth/register` e "Autenticação"
- `docs/implementacoes-futuras/DT-008-autorizacao-por-papel.md`
- `docs/tasks/005-validacao-e-e2e.md` — seção do helper `e2e/support/api.ts`

## 3. Estado esperado ao iniciar

Produzido pelos planos anteriores:

- Plano 005: `e2e/support/api.ts` com `createAdminUser()` implementado via
  `POST /auth/register`, e `e2e/tests/login.spec.ts` (`@golden`) usando esse helper.
- Plano 007: `app/core/logging.py`, `app/core/indexes.py`, `app/repositories/errors.py`
  (`UniqueConstraintError`), fixtures `autouse` no `tests/conftest.py`.

Verificado no código em 2026-11-05:

- `app/models/user.py:16` — `role: str = "user"`.
- `app/services/user_service.py:71` — `register_user` fixa `role="user"`.
- `app/services/user_service.py:91-94` — o login põe `role` no token como claim extra.
- `app/api/deps.py:38-84` — só existe `get_current_user`; ele lê o usuário **do banco**
  a cada requisição (`find_by_email`, linha 68).
- `app/api/v1/routes/auth.py:15-30` — `POST /auth/register` público.
- Nenhuma rota verifica `role`. Não existe `app/cli.py`.

## 4. Escopo

**Dentro:**

- constantes de papel;
- dependência `require_admin`;
- `POST /auth/register` restrito a administrador;
- comando `python -m app.cli create-admin`;
- helper de E2E criando o administrador pelo comando;
- testes e documentação.

**Fora:**

- telas de gestão de usuários e listagem `/admin/users` — plano 015;
- terceiro papel (ex.: editor) — dois papéis bastam; mais de dois exigiria ADR;
- convite por e-mail — não há envio de e-mail no sistema;
- ajustes no painel (aviso do `/docs` na tela de login) — plano 011.

## 5. Decisões tomadas no planejamento

| Questão | Decisão | Motivo |
|---|---|---|
| Papéis | `admin` e `user`, em `app/core/roles.py` | Suficiente para o produto; visitante não tem conta |
| Fonte do papel na autorização | O documento do banco (`current_user["role"]`), não o claim do token | `get_current_user` já consulta o banco; mudança de papel vale na hora |
| Cadastro | `POST /auth/register` exige administrador; mesmo payload, mesmas respostas | Fecha o painel para desconhecidos sem criar rota nova |
| Primeiro administrador | Comando `create-admin` que **cria ou promove** | Reproduzível no compose e na CI; não depende de variável com senha |
| Senha no comando | Argumento `--password` obrigatório | Os alunos e o E2E executam sem terminal interativo; o comando nunca imprime a senha |
| Lógica do comando | Em `UserService.create_or_promote_admin`; o CLI só conecta, chama e imprime | Mantém a camada de serviço como dona da regra |
| Código de saída do CLI | `0` sucesso · `1` banco indisponível · `2` entrada inválida | Permite ao E2E e à CI detectar falha |
| Testes de rotas protegidas | `app.dependency_overrides[require_admin]` na fixture `as_admin` | Evita conflito entre o `find_by_email` do token e o do cadastro nos testes |

## 6. Passos de implementação

Backend em `services/backend`, E2E e docs no orquestrador; branch
`plano/008-papeis-e-administrador` nos dois.

### Passo 1 — Constantes de papel

**Arquivo novo:** `app/core/roles.py`

```python
"""Papeis de usuario reconhecidos pelo sistema."""

ROLE_ADMIN = "admin"
ROLE_USER = "user"
VALID_ROLES: frozenset[str] = frozenset({ROLE_ADMIN, ROLE_USER})
```

Substituir os literais `"user"` em `app/models/user.py:16`, `app/schemas/user.py:70` e
`app/services/user_service.py` (linhas 47, 71, 93) por `ROLE_USER`.

### Passo 2 — Dependência `require_admin`

**Arquivo:** `app/api/deps.py`

```python
async def require_admin(
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Libera a rota apenas para usuarios com papel admin."""

    if current_user.get("role") != ROLE_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso restrito a administradores.",
        )
    return current_user
```

Ordem dos erros, herdada de `get_current_user`: sem token `401` → token inválido `401` →
usuário inativo `403 "Usuario inativo."` → papel insuficiente `403 "Acesso restrito a
administradores."`.

### Passo 3 — Cadastro restrito

**Arquivo:** `app/api/v1/routes/auth.py`, rota `register`

Acrescentar o parâmetro `_admin: dict[str, Any] = Depends(require_admin)`. Docstring:
"Cria um novo usuario. Exige papel admin." Nada mais muda: payload, `200`, `400`, `422`,
`503` iguais.

### Passo 4 — Regra de criar ou promover

**Arquivo:** `app/services/user_service.py`

```python
async def create_or_promote_admin(self, payload: UserCreate) -> tuple[dict[str, Any], bool]:
    """Cria um admin ou promove um usuario existente. Retorna (usuario, criado)."""
```

- Se `find_by_email(payload.email)` encontrar alguém: `update_user_by_email` com
  `{"role": ROLE_ADMIN, "is_active": True, "updated_at": agora}` — **sem** alterar a
  senha — e retorna `(serialize_user(atualizado), False)`.
- Senão: cria como em `register_user`, mas com `role=ROLE_ADMIN`, e retorna
  `(serialize_user(documento), True)`. Reaproveite o trecho de criação extraindo um
  método privado `_build_user_document(payload, role)` usado pelos dois caminhos (evita
  duplicação que o `jscpd` acusaria).
- `UniqueConstraintError` vira `UserConflictError`, como no plano 007.

### Passo 5 — Comando de linha

**Arquivo novo:** `app/cli.py`

```python
"""Comandos administrativos: python -m app.cli create-admin --email X --password Y."""

EXIT_OK = 0
EXIT_DATABASE_UNAVAILABLE = 1
EXIT_INVALID_INPUT = 2


def build_parser() -> argparse.ArgumentParser: ...
async def create_admin(email: str, password: str, full_name: str | None) -> int: ...
def main(argv: list[str] | None = None) -> int: ...


if __name__ == "__main__":
    raise SystemExit(main())
```

Comportamento de `create_admin`:

1. Montar `UserCreate(email=..., password=..., full_name=...)`; `ValidationError` →
   imprimir em `stderr` "Dados invalidos: <mensagens do Pydantic sem o valor da senha>"
   e retornar `EXIT_INVALID_INPUT`.
2. `MongoManager(settings.mongodb_url, settings.mongodb_db)`, `await connect()`; se
   `not connected` → `stderr` "Banco de dados indisponivel: <last_error>" e
   `EXIT_DATABASE_UNAVAILABLE`.
3. `await ensure_indexes(manager.database)`.
4. `UserService(UserRepository(manager.database)).create_or_promote_admin(payload)`.
5. Imprimir "Administrador criado: <email>" ou "Usuario promovido a administrador:
   <email>". **Nunca** imprimir a senha.
6. `finally: await manager.close()`.

Para mostrar erros do Pydantic sem a senha, use `exc.errors(include_input=False)`.

### Passo 6 — Fixture de testes como administrador

**Arquivo:** `tests/conftest.py`

```python
ADMIN_USER: dict[str, Any] = {
    "email": "admin@example.com",
    "hashed_password": "x",
    "role": "admin",
    "is_active": True,
}


@pytest.fixture()
def as_admin() -> Iterator[dict[str, Any]]:
    """Faz require_admin aceitar a requisicao sem token."""
    app.dependency_overrides[require_admin] = lambda: ADMIN_USER
    yield ADMIN_USER
    app.dependency_overrides.pop(require_admin, None)
```

Os planos 009, 010, 013 e 015 usam esta fixture.

### Passo 7 — Atualizar os testes de cadastro

**Arquivo:** `tests/test_auth_flow.py`

- Os testes `test_register_*` existentes passam a receber a fixture `as_admin`
  (parâmetro da função). O comportamento verificado não muda.

### Passo 8 — Helper de E2E

**Arquivo:** `e2e/support/api.ts` (orquestrador)

Manter a assinatura de `createAdminUser` definida no plano 005; trocar a implementação
por uma chamada ao comando dentro do container:

```ts
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const REPO_ROOT = path.resolve(__dirname, '..', '..');

export function createAdminUser(email: string, password: string): void {
  execFileSync(
    'docker',
    ['compose', 'exec', '-T', 'backend', 'python', '-m', 'app.cli', 'create-admin',
     '--email', email, '--password', password],
    { cwd: REPO_ROOT, stdio: 'pipe' },
  );
}
```

Se no plano 005 a função for `async`, mantenha `async` (retornando a `Promise`) para não
alterar quem a chama. Rodar `bash scripts/e2e.sh` e confirmar o `@golden` de login verde.

## 7. Testes

| Arquivo | Teste | Verifica |
|---|---|---|
| `tests/test_auth_flow.py` | `test_register_*` existentes | Continuam passando com `as_admin` |
| `tests/test_auth_flow.py` | `test_register_without_token_returns_401` | Sem header → `401` |
| `tests/test_auth_flow.py` | `test_register_with_user_role_returns_403` | Token real de usuário `role="user"` (`find_by_email` falso devolve esse usuário) → `403 "Acesso restrito a administradores."` |
| `tests/test_auth_flow.py` | `test_register_with_admin_token_creates_user` | Token real de admin; `find_by_email` falso devolve o admin para o e-mail do token e `None` para o e-mail novo → `200` |
| `tests/test_auth_flow.py` | `test_register_with_inactive_admin_returns_403` | Admin com `is_active=False` → `403 "Usuario inativo."` |
| `tests/test_user_service.py` (novo) | `test_create_or_promote_admin_creates_when_missing` | Repository falso; retorna `created=True`, `role="admin"`, hash de senha válido |
| `tests/test_user_service.py` | `test_create_or_promote_admin_promotes_existing` | Usuário existente → `update_user_by_email` chamado com `role="admin"` e **sem** `hashed_password`; `created=False` |
| `tests/test_cli.py` (novo) | `test_create_admin_success_prints_email` | `MongoManager.connect`/`ping` e repository falsos; `main([...])` retorna `0`; `capsys` contém o e-mail e **não** contém a senha |
| `tests/test_cli.py` | `test_create_admin_invalid_password_returns_2` | Senha `"curta"` → `2` |
| `tests/test_cli.py` | `test_create_admin_database_down_returns_1` | `ping` falso → `1` |

Para `test_cli.py`, substituir também `app.cli.ensure_indexes` por corrotina vazia.

```bash
cd services/backend && pytest -v
bash scripts/validate.sh
```

## 8. Documentação a atualizar

- [ ] `docs/03-artefato-backend.md` — tabela de endpoints (`POST /auth/register` com auth
      "Bearer (admin)"); seção "Papéis" nova: `admin`/`user`, `require_admin`, papel lido
      do banco; seção "Primeiro administrador" com o comando no compose:
      `docker compose exec backend python -m app.cli create-admin --email <email> --password <senha>`;
      estrutura com `cli.py` e `roles.py`.
- [ ] `docs/06-contrato-api.md` — `POST /auth/register` deixa de ser público: erros `401`
      e `403`; seção "Autenticação": claim `role` pode ser `admin` ou `user`, e a
      autorização usa o papel do banco.
- [ ] `docs/02-artefato-orquestrador.md` — na execução do ambiente, o passo de criar o
      primeiro administrador.
- [ ] `README.md` (raiz) — em "Primeiros passos", após subir o ambiente, o comando
      `create-admin`.
- [ ] `docs/implementacoes-futuras/DT-008-...md` — `Resolvida` (plano 008), registrando a
      decisão: cadastro restrito a admin, primeiro admin por CLI.
- [ ] `docs/implementacoes-futuras/DT-015-...md` — nota: pré-requisito DT-008 atendido.
- [ ] `docs/implementacoes-futuras/README.md` — status.

## 9. Critérios de aceite

- [ ] `require_admin` disponível e coberto pelos testes de permitido e negado
- [ ] `POST /auth/register` retorna `401` sem token, `403` para `role="user"`, `200` para admin
- [ ] `docker compose exec backend python -m app.cli create-admin --email a@b.com --password abc12345`
      cria o admin; executado de novo, informa que promoveu (não duplica)
- [ ] O comando nunca imprime a senha
- [ ] E2E `@golden` de login passa com o admin criado pelo comando
- [ ] `bash scripts/validate.sh` passando, cobertura ≥ 80%
- [ ] Documentação da seção 8 atualizada

## 10. Commits esperados

Backend:

```
feat(auth): adiciona constantes de papel e dependencia require_admin
feat(auth): restringe o cadastro de usuarios a administradores
feat(cli): adiciona comando create-admin
test: cobre autorizacao por papel e o comando create-admin
```

Orquestrador:

```
test(e2e): cria o administrador pelo comando create-admin
docs: documenta papeis, cadastro restrito e primeiro administrador
docs: marca DT-008 como resolvida
```

## 11. Riscos e pontos de atenção

- **Painel avisa para usar o `/docs`.** A tela de login ainda manda criar usuário pelo
  Swagger, o que agora exige token de admin. O aviso é removido no plano 011; até lá, a
  orientação correta é o comando `create-admin`. Não alterar o painel neste plano.
- **Swagger e rotas protegidas.** Para testar `POST /auth/register` no `/docs`, é preciso
  clicar em **Authorize** e colar o token. Explicar isso na verificação do aluno.
- **`dependency_overrides` vazando entre testes.** A fixture remove o override no
  `yield`; não usar `app.dependency_overrides.clear()` (apagaria overrides de outras
  fixtures).
- **Windows.** `execFileSync('docker', ...)` funciona no Windows com Docker Desktop no
  `PATH`; não usar `shell: true`.

## 12. Verificação pelo aluno

1. `bash scripts/up.sh`.
2. No terminal: `docker compose exec backend python -m app.cli create-admin --email
   admin@tourvr.local --password Admin12345`. Aparece "Administrador criado".
3. Rode o mesmo comando de novo: aparece "Usuario promovido a administrador" (não cria
   outro).
4. Abra <http://localhost:8000/docs>. Em `POST /auth/register`, **Try it out** e
   **Execute** sem fazer login: resposta `401`.
5. Em `POST /auth/login`, entre com `admin@tourvr.local` / `Admin12345` e copie o
   `access_token`. Clique **Authorize** (cadeado no topo), cole o token, **Authorize**.
6. Repita o `POST /auth/register` com um e-mail novo: resposta `200`.
7. Abra <http://localhost:3000> e entre com o administrador: o painel abre.

---

## Prompt de delegação

Cole no Claude Code, na pasta `quest-project`, trocando o nome:

```text
Você é a sessão de EXECUÇÃO do projeto TourVR.
Execute o plano docs/tasks/008-papeis-e-administrador.md.
Antes de qualquer ação, leia docs/tasks/protocolo-execucao.md e siga o "Prompt 1 — EXECUTAR" etapa por etapa.
Meu nome, para registrar no plano: <SEU NOME>
```
