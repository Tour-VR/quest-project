# 009 — Pontos de interesse no backend

| | |
|---|---|
| **Status** | Concluído |
| **Fase** | 1 — Domínio do campus (backend) |
| **Depende de** | 008 |
| **Dívidas atendidas** | DT-016 (parcial: modelo e CRUD) |
| **ADRs relacionadas** | ADR-0007 (registrada por este plano) · ADR-0006 |
| **Artefatos afetados** | Backend · Orquestrador (documentação) |
| **Planejado em** | 2026-11-05 |
| **Validado em** | 2026-11-05 por Ciro Macedo |
| **Executado em** | 2026-11-11 por Heitor Aquino · PRs: [Tour-VR/backend#6](https://github.com/Tour-VR/backend/pull/6), [Tour-VR/quest-project#9](https://github.com/Tour-VR/quest-project/pull/9) |

---

## 1. Objetivo

Criar a entidade central do produto: o **ponto de interesse** (biblioteca, auditório,
cantina...), com nome, resumo, história, fotos e o `slug` que vai no QR Code. Entrega as
rotas administrativas de cadastro e publicação e as rotas públicas de leitura que o app do
visitante vai consumir. Registra a ADR-0007.

## 2. Leia antes de começar

- `docs/01-arquitetura.md` — camadas
- `docs/03-artefato-backend.md`
- `docs/06-contrato-api.md`
- `docs/08-decisoes-arquiteturais.md` — ADR-0006 e o esboço da ADR-0007
- `docs/implementacoes-futuras/DT-016-modelagem-dominio-turismo.md`
- `docs/tasks/000-visao-macro-opcao-b.md` — seção 6.1, "Domínio" e "API"

## 3. Estado esperado ao iniciar

- Plano 007: `app/repositories/errors.py` com `UniqueConstraintError` e
  `duplicated_field`; `app/core/indexes.py` com `ensure_indexes(database)`;
  `app/core/logging.py`.
- Plano 008: `app/core/roles.py`; `require_admin` em `app/api/deps.py`; fixture
  `as_admin` em `tests/conftest.py`.
- Padrão a copiar (verificado em 2026-11-05):
  - modelo dataclass com `to_mongo()` — `app/models/user.py:10-23`;
  - repository com `_require_collection` e tradução de `PyMongoError` em
    `ConnectionError` — `app/repositories/user_repository.py:11-30`;
  - exceções de domínio no módulo do service — `app/services/user_service.py:19-32`;
  - rota que traduz exceção em `HTTPException` — `app/api/v1/routes/users.py:33-52`;
  - montagem do service por dependência — `app/api/deps.py:17-22`;
  - roteador agregador — `app/api/v1/router.py:10-19`.
- Não existe nenhum modelo além de `user.py` (`app/models/`, `app/schemas/`).

## 4. Escopo

**Dentro:** modelo, schemas, repository, service, rotas admin e públicas de pontos;
índice único de `slug`; ADR-0007; testes; documentação.

**Fora:**

- upload de arquivos de mídia — plano 013 (aqui `media[].url` é só texto);
- panorama 360° e conexões entre pontos — plano 019;
- registro de visitas e métricas — plano 010;
- roteiros (sequência ordenada de pontos) — fora do escopo do projeto nesta etapa
  (`000-visao-macro-opcao-b.md`, seção 8);
- paginação da listagem admin — volume esperado é de dezenas de pontos.

## 5. Decisões tomadas no planejamento

| Questão | Decisão | Motivo |
|---|---|---|
| Identificador nas rotas admin | `point_id` = `ObjectId` do Mongo em texto | `slug` pode mudar enquanto rascunho |
| Identificador nas rotas públicas | `slug` | É o que vai no QR Code (`/p/<slug>`) |
| Slug depois de publicado | **Imutável** a partir da primeira publicação → `400` | QR Codes impressos deixariam de funcionar |
| `published_at` | Data da **primeira** publicação; não é apagada ao despublicar | Sustenta a regra acima e o histórico |
| Mudança de status | Só por `/publish` e `/unpublish`, nunca pelo `PUT` | Ação explícita no painel; evita publicar sem querer |
| Mídia | Lista embutida no ponto (`media[]`), máx. 20; `id` gerado pelo servidor quando ausente | Mídia não existe fora do ponto; uma consulta traz tudo |
| `kind` da mídia | Apenas `"photo"` neste plano | `"panorama"` chega no plano 019 |
| Slug duplicado | `409 "Ja existe um ponto com este slug."` | Recurso novo usa o código correto; usuários mantêm `400` por compatibilidade |
| `point_id` malformado | `404`, igual a inexistente | Não expõe detalhe de formato |
| Rascunho na rota pública | `404` | Rascunho não existe para o visitante |
| Ordem das listas | Por `name` (ascendente) | Previsível para o painel e para o visitante |
| Capa (`cover_url`) | `url` da primeira mídia `photo`, ou `null` | Sem campo extra para manter |
| Limites | Constantes em `app/schemas/point.py`, espelhadas pelo painel (plano 012) | Fonte única |

## 6. Passos de implementação

Backend em `services/backend`, docs no orquestrador; branch
`plano/009-pontos-de-interesse-backend`.

### Passo 1 — Modelo

**Arquivo novo:** `app/models/point.py`

```python
POINT_STATUS_DRAFT = "draft"
POINT_STATUS_PUBLISHED = "published"
MEDIA_KIND_PHOTO = "photo"


@dataclass(slots=True)
class PointModel:
    slug: str
    name: str
    summary: str
    history: str
    status: str = POINT_STATUS_DRAFT
    media: list[dict[str, Any]] = field(default_factory=list)
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    published_at: datetime | None = None

    def to_mongo(self) -> dict[str, Any]:
        return asdict(self)
```

Cada item de `media` no banco: `{"id": str, "kind": "photo", "url": str, "caption": str
| None, "alt_text": str}`.

### Passo 2 — Schemas

**Arquivo novo:** `app/schemas/point.py`

Constantes (documentadas no topo do arquivo):

```python
SLUG_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
SLUG_MIN_LENGTH, SLUG_MAX_LENGTH = 3, 60
NAME_MIN_LENGTH, NAME_MAX_LENGTH = 3, 120
SUMMARY_MAX_LENGTH = 280
HISTORY_MAX_LENGTH = 10_000
MEDIA_MAX_ITEMS = 20
MEDIA_URL_MAX_LENGTH = 500
CAPTION_MAX_LENGTH = 200
ALT_TEXT_MAX_LENGTH = 200
SLUG_RULE_MESSAGE = (
    "Slug deve ter de 3 a 60 caracteres, apenas letras minusculas, numeros e hifens "
    "entre palavras (ex.: biblioteca-central)."
)
```

Schemas:

| Schema | Campos |
|---|---|
| `MediaItemInput` | `id: str \| None = None` · `kind: Literal["photo"] = "photo"` · `url: str` (1–500) · `caption: str \| None` (≤ 200) · `alt_text: str` (1–200) |
| `MediaItemResponse` | `id` · `kind` · `url` · `caption` · `alt_text` |
| `PointCreate` | `slug` · `name` (3–120) · `summary` (1–280) · `history` (1–10000) · `media: list[MediaItemInput] = []` (≤ 20) |
| `PointUpdate` | os mesmos campos de `PointCreate`, todos opcionais (`None` = não alterar) |
| `PointAdminResponse` | `id` · `slug` · `name` · `summary` · `history` · `status: Literal["draft","published"]` · `media: list[MediaItemResponse]` · `created_at` · `updated_at` · `published_at: datetime \| None` |
| `PointPublicSummary` | `slug` · `name` · `summary` · `cover_url: str \| None` |
| `PointPublicDetail` | `slug` · `name` · `summary` · `history` · `media: list[MediaItemResponse]` |

Validadores: textos com `strip()` (texto que fica vazio falha no limite mínimo);
`slug` com `strip().lower()` e `SLUG_PATTERN.fullmatch` + limites, senão
`ValueError(SLUG_RULE_MESSAGE)`. Use `Field(min_length=..., max_length=...)` e
`max_length=MEDIA_MAX_ITEMS` na lista.

### Passo 3 — Repository

**Arquivo novo:** `app/repositories/point_repository.py`

```python
class PointRepository:
    def __init__(self, database: Any | None) -> None: ...
    async def list_points(self, status: str | None = None) -> list[dict[str, Any]]: ...
    async def find_by_id(self, point_id: str) -> dict[str, Any] | None: ...
    async def find_by_slug(self, slug: str) -> dict[str, Any] | None: ...
    async def find_published_by_slug(self, slug: str) -> dict[str, Any] | None: ...
    async def list_published(self) -> list[dict[str, Any]]: ...
    async def create_point(self, point_data: dict[str, Any]) -> str: ...      # devolve o id
    async def update_point(self, point_id: str, update_data: dict[str, Any]) -> dict[str, Any] | None: ...
    async def delete_point(self, point_id: str) -> bool: ...
```

- Collection `points`; mesmo `_require_collection` do `UserRepository`.
- Converter `point_id` com `bson.ObjectId`; `bson.errors.InvalidId` → tratar como não
  encontrado (`None` / `False`), sem consultar o banco.
- Listas: `find(filtro).sort("name", 1)` e `await cursor.to_list(length=None)`.
- `update_point`: `find_one_and_update({"_id": oid}, {"$set": ...},
  return_document=ReturnDocument.AFTER)`.
- `DuplicateKeyError` → `UniqueConstraintError(duplicated_field(exc))` (antes de
  `PyMongoError`); demais `PyMongoError` → `ConnectionError("Falha ao ... ponto no MongoDB.")`.

**Arquivo:** `app/core/indexes.py` — acrescentar
`await database["points"].create_index("slug", unique=True, name="points_slug_unique")`.

### Passo 4 — Service

**Arquivo novo:** `app/services/point_service.py`

Exceções de domínio:

```python
class PointInputError(ValueError): ...      # -> 400
class PointConflictError(ValueError): ...   # -> 409
class PointNotFoundError(ValueError): ...   # -> 404
```

Mensagens fixas (constantes no módulo):

- `POINT_NOT_FOUND_MESSAGE = "Ponto de interesse nao encontrado."`
- `POINT_SLUG_CONFLICT_MESSAGE = "Ja existe um ponto com este slug."`
- `POINT_SLUG_LOCKED_MESSAGE = "O slug nao pode mudar depois da primeira publicacao, pois os QR Codes impressos deixariam de funcionar."`
- `POINT_EMPTY_UPDATE_MESSAGE = "Nenhum campo valido para atualizacao."`

Métodos:

| Método | Regra |
|---|---|
| `list_points(status)` | Repassa o filtro; serializa cada item com `serialize_admin` |
| `get_point(point_id)` | `None` → `PointNotFoundError` |
| `create_point(payload)` | `find_by_slug` existente → `PointConflictError`; monta `PointModel`; mídias sem `id` recebem `str(uuid4())`; `UniqueConstraintError` → `PointConflictError` |
| `update_point(point_id, payload)` | Carrega o ponto (404); `model_dump(exclude_unset=True, exclude_none=True)`; vazio → `PointInputError(EMPTY)`; slug diferente e `published_at` preenchido → `PointInputError(LOCKED)`; slug diferente e já usado por outro → `PointConflictError`; `updated_at = agora` |
| `delete_point(point_id)` | `False` → `PointNotFoundError` |
| `publish_point(point_id)` | `status="published"`, `published_at` = agora **se ainda for `None`**, `updated_at` = agora; idempotente |
| `unpublish_point(point_id)` | `status="draft"`, `updated_at` = agora; `published_at` intacto |
| `list_published()` | Serializa com `serialize_public_summary` |
| `get_published(slug)` | `None` → `PointNotFoundError`; serializa com `serialize_public_detail` |

Serializadores (métodos estáticos): `serialize_admin` troca `_id` por `id=str(_id)`;
`serialize_public_summary` calcula `cover_url` (primeira mídia `kind == "photo"`);
`serialize_public_detail` não expõe `status`, datas nem `id` do ponto.

### Passo 5 — Dependência e rotas

**Arquivo:** `app/api/deps.py` — `get_point_service(request)` no mesmo molde de
`get_user_service`.

**Arquivo novo:** `app/api/v1/routes/admin_points.py`

```python
router = APIRouter(
    prefix="/admin/points",
    tags=["Admin - Pontos"],
    dependencies=[Depends(require_admin)],
)
```

| Rota | Função | Sucesso |
|---|---|---|
| `GET /admin/points?status=draft\|published` | `list_points` | `200 list[PointAdminResponse]` |
| `POST /admin/points` | `create_point` | `201 PointAdminResponse` |
| `GET /admin/points/{point_id}` | `get_point` | `200` |
| `PUT /admin/points/{point_id}` | `update_point` | `200` |
| `DELETE /admin/points/{point_id}` | `delete_point` | `204` sem corpo |
| `POST /admin/points/{point_id}/publish` | `publish_point` | `200` |
| `POST /admin/points/{point_id}/unpublish` | `unpublish_point` | `200` |

`status` como `Literal["draft", "published"] | None = Query(default=None)` (valor
inválido → `422` automático).

Para não repetir o mesmo `try/except` em sete rotas, criar no módulo uma função
`_to_http_error(exc: Exception) -> HTTPException` que mapeia: `PointNotFoundError` →
404, `PointConflictError` → 409, `PointInputError` → 400, `ConnectionError` →
`build_database_http_exception(exc)`. Cada rota faz
`except (PointNotFoundError, PointConflictError, PointInputError, ConnectionError) as
exc: raise _to_http_error(exc) from exc`.

**Arquivo novo:** `app/api/v1/routes/public_points.py`

```python
router = APIRouter(prefix="/public/points", tags=["Publico"])
```

| Rota | Sucesso | Erros |
|---|---|---|
| `GET /public/points` | `200 list[PointPublicSummary]` | `503` |
| `GET /public/points/{slug}` | `200 PointPublicDetail` | `404` · `503` |

**Arquivo:** `app/api/v1/router.py` — incluir os dois roteadores.

### Passo 6 — Registrar a ADR-0007

**Arquivo:** `docs/08-decisoes-arquiteturais.md` (orquestrador)

- Índice: linha 0007 com título "Modelo de domínio do campus" e estado "Aceita".
- Substituir a seção atual da ADR-0007 por:

```markdown
## ADR-0007 — Modelo de domínio do campus

**Data:** <data da execução> · **Estado:** Aceita · **Plano:** [009](tasks/009-pontos-de-interesse-backend.md)

**Contexto.** Com a ADR-0006, o produto passou a ser um tour do campus: o visitante lê um
QR Code afixado num local (ou navega no modo VR) e recebe o conteúdo daquele lugar. O
sistema só modelava `User`. O esboço da DT-016 previa `Roteiro`, `PontoDeInteresse`,
`Midia` e `Sessao`, pensando em turismo remoto guiado.

**Decisão.**

- A entidade central é o **ponto de interesse** (`PointOfInterest`, collection `points`),
  com `slug` único, `name`, `summary`, `history`, `status` (`draft`/`published`),
  `media[]` embutida, `created_at`, `updated_at` e `published_at` (primeira publicação).
- A mídia é **embutida** no ponto (`MediaItem`: `id`, `kind`, `url`, `caption`,
  `alt_text`), no máximo 20 por ponto.
- O `slug` é o identificador público e vai no QR Code; fica **imutável** depois da
  primeira publicação.
- O visitante só enxerga pontos publicados; rascunho responde `404`.
- Visitas são registradas à parte, de forma anônima (`Visit`, plano 010).
- **Não** há entidade `Roteiro` nesta etapa.

**Justificativa.** O QR Code identifica um lugar, não um percurso: o aluno visita os
pontos na ordem em que passa por eles. Mídia embutida resolve a página do ponto com uma
única consulta e não tem uso fora do ponto. A imutabilidade do slug protege os códigos já
impressos. Roteiros foram descartados até que um ponto funcione de ponta a ponta
(DT-016, nota de escopo).

**Consequências.**

- ➕ Uma consulta por página do visitante; modelo pequeno, fácil de testar.
- ➕ O mesmo cadastro alimenta o modo AR e o modo VR.
- ➖ Corrigir um slug publicado exige criar outro ponto e reimprimir o QR.
- ➖ Mídia embutida limita o reaproveitamento de uma foto entre pontos (aceitável).
- ➖ Documento cresce com a mídia; o limite de 20 itens mantém o tamanho sob controle.
```

## 7. Testes

Novos arquivos `tests/test_admin_points.py` e `tests/test_public_points.py`, no padrão de
`tests/test_auth_flow.py` (`monkeypatch` nos métodos de `PointRepository`). Rotas admin
usam a fixture `as_admin`. Crie no topo de cada arquivo uma função `make_point(**kwargs)`
que devolve um documento de ponto completo (com `_id=ObjectId()`), para não repetir
dicionários.

| Teste | Verifica |
|---|---|
| `test_create_point_success_returns_201` | Slug normalizado (`" Biblioteca-Central "` → `"biblioteca-central"`), `status="draft"`, mídia recebe `id` |
| `test_create_point_invalid_slug_returns_422` | `"Biblioteca Central"` → `422` |
| `test_create_point_duplicate_slug_returns_409` | `find_by_slug` falso encontra → `409` com a mensagem do contrato |
| `test_create_point_duplicate_key_returns_409` | `create_point` falso levanta `UniqueConstraintError("slug")` → `409` |
| `test_create_point_returns_503_when_database_fails` | `ConnectionError` → `503` |
| `test_list_points_filters_by_status` | `?status=published` repassa o filtro |
| `test_list_points_invalid_status_returns_422` | `?status=xyz` → `422` |
| `test_get_point_not_found_returns_404` | `find_by_id` → `None` |
| `test_update_point_success` | Nome alterado, `updated_at` novo |
| `test_update_point_empty_payload_returns_400` | `{}` → `400` |
| `test_update_slug_after_publication_returns_400` | Ponto com `published_at` → `400` com a mensagem do slug travado |
| `test_update_slug_while_draft_succeeds` | Sem `published_at` → `200` |
| `test_delete_point_returns_204` / `..._not_found_returns_404` | |
| `test_publish_sets_published_at_once` | Primeira publicação preenche; segunda mantém a data |
| `test_unpublish_keeps_published_at` | |
| `test_admin_points_without_token_returns_401` | Sem `as_admin` e sem header |
| `test_admin_points_with_user_role_returns_403` | Token de `role="user"` |
| `test_public_list_returns_only_summary_fields` | Campos exatos de `PointPublicSummary`; `cover_url` da primeira foto |
| `test_public_detail_success` | Campos exatos de `PointPublicDetail` (sem `status`, sem `id`) |
| `test_public_detail_draft_returns_404` | `find_published_by_slug` → `None` |
| `test_public_points_return_503_when_database_fails` | |

Também `tests/test_point_repository.py`: `find_by_id("nao-e-objectid")` retorna `None` sem
tocar na collection (collection falsa que falha se chamada).

```bash
cd services/backend && pytest -v
bash scripts/validate.sh
```

## 8. Documentação a atualizar

- [x] `docs/08-decisoes-arquiteturais.md` — ADR-0007 (passo 6)
- [x] `docs/06-contrato-api.md` — uma seção por rota nova (request, resposta de exemplo,
      tabela de erros), no formato das existentes; nova seção "Convenções de prefixo"
      (`/admin` exige admin, `/public` sem token); remover pontos de interesse da lista
      "Endpoints ausentes"
- [x] `docs/03-artefato-backend.md` — estrutura, endpoints, modelo de dados de `points`,
      regras de negócio (slug imutável após publicar, rascunho invisível)
- [x] `docs/09-glossario.md` — "Ponto de interesse" deixa de ser *(proposto)* e passa a ter
      a definição da ADR-0007; novos termos **Slug**, **Rascunho / Publicado**, **Mídia
      (item)**; "Roteiro" e "Sessão de uso": marcar como "fora do escopo atual (ADR-0007)"
- [x] `docs/00-visao-geral.md` — tabela "Estado atual": modelo de domínio do campus
      "🟡 Parcial — pontos de interesse no backend"
- [x] `docs/implementacoes-futuras/DT-016-...md` — Status `Em andamento`; critério
      "ADR-0007" marcado

## 9. Critérios de aceite

- [x] As 7 rotas admin e as 2 públicas respondem conforme o contrato, com os códigos de
      erro da seção 5
- [x] Índice `points_slug_unique` criado na subida
- [x] Slug imutável após a primeira publicação
- [x] Rascunho nunca aparece nas rotas públicas
- [x] Nenhuma rota pula camada (rota → service → repository)
- [x] ADR-0007 registrada e indexada
- [x] `bash scripts/validate.sh` passando, cobertura ≥ 80%
- [x] Documentação da seção 8 atualizada

## 10. Commits esperados

Backend:

```
feat(points): adiciona modelo e schemas de ponto de interesse
feat(points): adiciona repository de pontos e indice unico de slug
feat(points): adiciona service com regras de publicacao e slug
feat(points): expoe rotas administrativas de pontos
feat(points): expoe rotas publicas de leitura de pontos
test(points): cobre rotas admin, publicas e repository de pontos
```

Orquestrador:

```
docs: registra a ADR-0007 do modelo de dominio do campus
docs: atualiza contrato da API, backend e glossario com pontos de interesse
```

## 11. Riscos e pontos de atenção

- **Plano grande.** São muitos arquivos; commite a cada passo e rode `pytest` entre
  eles. Se a sessão cair, use o Prompt 4 (retomar) do protocolo.
- **`ObjectId` na resposta.** Esquecer de converter `_id` faz o FastAPI falhar ao
  serializar. Todo retorno do service passa por um serializador.
- **`exclude_none` no update** impede "apagar" a legenda enviando `null` — é o
  comportamento decidido; o painel envia a lista de mídia completa a cada edição.
- **Duplicação.** Os testes de rota têm estrutura parecida; use `make_point` e
  `pytest.mark.parametrize` nos testes de `503` e `401/403` para não estourar o limite do
  `jscpd`.
- **mypy strict.** `bson` vem com o `pymongo` e é tipado; o retorno de `find_one` é
  `dict[str, Any] | None` com o `database: Any` já usado no projeto.

## 12. Verificação pelo aluno

1. `bash scripts/up.sh` e, se ainda não tiver, crie o admin (plano 008, verificação).
2. Abra <http://localhost:8000/docs>, faça login em `POST /auth/login` e use
   **Authorize** com o token.
3. Em `POST /admin/points`, **Try it out**, cole e execute:

   ```json
   {
     "slug": "biblioteca-central",
     "name": "Biblioteca Central",
     "summary": "Onde ficam os livros e as salas de estudo.",
     "history": "A biblioteca recebeu este nome em homenagem a ...",
     "media": []
   }
   ```

   Resposta `201`. Copie o valor de `id`.
4. Abra em outra aba <http://localhost:8000/public/points/biblioteca-central>: aparece
   "Ponto de interesse nao encontrado" (ainda é rascunho).
5. Em `POST /admin/points/{point_id}/publish`, cole o `id` e execute. Recarregue a aba do
   passo 4: agora aparecem nome, resumo e história.
6. Em `PUT /admin/points/{point_id}`, tente trocar o slug para `biblioteca-nova`: resposta
   `400` explicando que o slug não muda depois de publicado.

---

## Prompt de delegação

Cole no Claude Code, na pasta `quest-project`, trocando o nome:

```text
Você é a sessão de EXECUÇÃO do projeto TourVR.
Execute o plano docs/tasks/009-pontos-de-interesse-backend.md.
Antes de qualquer ação, leia docs/tasks/protocolo-execucao.md e siga o "Prompt 1 — EXECUTAR" etapa por etapa.
Meu nome, para registrar no plano: <SEU NOME>
```

---

## Registro de execução

**Executado por** Heitor Aquino, com Claude Code, em 2026-11-11.

### O que foi feito

- Backend (`plano/009-pontos-de-interesse-backend`), seis commits na ordem da seção 10:
  `app/models/point.py`; `app/schemas/point.py` (constantes documentadas no topo e 7
  schemas); `app/repositories/point_repository.py` e índice `points_slug_unique` em
  `app/core/indexes.py`; `app/services/point_service.py` (3 exceções, 4 mensagens,
  serializadores estáticos); `get_point_service` em `app/api/deps.py`;
  `app/api/v1/routes/admin_points.py` (7 rotas, `_to_http_error`) e
  `app/api/v1/routes/public_points.py` (2 rotas), incluídos em `app/api/v1/router.py`;
  testes em `tests/test_admin_points.py`, `tests/test_public_points.py`,
  `tests/test_point_repository.py` e um teste novo em `tests/test_indexes.py`.
- Orquestrador: ADR-0007 registrada e indexada; documentação da seção 8 atualizada
  (contrato da API, backend, glossário, visão geral, DT-016 `Em andamento`).
- Verificação: `bash scripts/validate.sh` → código 0 (backend 105 testes, cobertura
  92,7%; frontend 26 testes; duplicação 0,92%, sem clones no código novo; E2E 2 testes,
  `@golden` verde). Critérios conferidos também na API real em Docker: criar `201`, slug
  repetido `409`, sem token `401`, rascunho no público `404`, publicar `200`, público
  com só `slug/name/summary/history/media`, `cover_url` da primeira foto, trocar slug
  publicado `400`, despublicar mantém `published_at`, id malformado `404`, apagar `204`;
  índice `points_slug_unique` presente na collection `points`.

### Desvios do plano

1. **Captura de exceções nas rotas admin.** O plano pede que cada rota capture
   `(PointNotFoundError, PointConflictError, PointInputError, ConnectionError)`. A tupla
   virou a constante `_HANDLED_ERRORS` do módulo, usada nas sete rotas — mesmo
   comportamento, sem repetir a lista.
2. **`strip` antes da validação.** Os validadores de texto rodam em `mode="before"` (para
   o limite mínimo valer depois do `strip`) e só tratam `str`; outro tipo segue para o
   Pydantic e vira `422`, não `500`. Coberto por
   `test_create_point_non_text_field_returns_422`.
3. **Mídia no `PUT`.** `model_dump(exclude_none=True)` também removeria `caption: null` e
   `id: null` de dentro de cada mídia. Quando `media` vem no corpo, a lista é remontada a
   partir do schema (todas as chaves, `id` gerado quando ausente), como no `POST`.
4. **Testes extras** (além da seção 7): `test_get_point_success`,
   `test_update_point_replaces_media_and_generates_ids`,
   `test_update_slug_used_by_other_point_returns_409`,
   `test_update_point_duplicate_key_returns_409`,
   `test_update_point_removed_meanwhile_returns_404`,
   `test_create_point_non_text_field_returns_422`,
   `test_ensure_indexes_creates_point_slug_index` e mais casos em
   `tests/test_point_repository.py` (filtros, ordenação, tradução de erros).

### Dívidas novas registradas

Nenhuma.

### Observação de ambiente

Como no plano 008: na máquina do executor, o `PATH` do Windows tem uma aspa (`"`) sobrando
depois de `PowerShell\7`, e o `cmd` aberto pelo `npm` deixa de encontrar o `node`. A
validação foi rodada com o `PATH` limpo só no processo. Não é problema do repositório.
