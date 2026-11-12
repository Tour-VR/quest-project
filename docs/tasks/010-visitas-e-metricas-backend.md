# 010 — Visitas e métricas no backend

| | |
|---|---|
| **Status** | Concluído |
| **Fase** | 1 — Domínio do campus (backend) |
| **Depende de** | 009 |
| **Dívidas atendidas** | DT-011 (parte do backend: endpoint de métricas) · DT-016 (parcial: visitas) |
| **ADRs relacionadas** | ADR-0007 |
| **Artefatos afetados** | Backend · Orquestrador (documentação) |
| **Planejado em** | 2026-11-05 |
| **Validado em** | 2026-11-05 por Ciro Macedo |
| **Executado em** | 2026-11-11 por Heitor Aquino · PRs: [Tour-VR/backend#7](https://github.com/Tour-VR/backend/pull/7), [Tour-VR/quest-project#10](https://github.com/Tour-VR/quest-project/pull/10) |

---

## 1. Objetivo

Registrar, de forma anônima, cada vez que um visitante abre um ponto (no celular ou no
Quest) e oferecer ao painel um resumo com números reais: quantos pontos existem, quantas
visitas houve e quais lugares são mais visitados. Substitui, do lado do backend, os
números fictícios do dashboard (DT-011).

## 2. Leia antes de começar

- `docs/03-artefato-backend.md`
- `docs/06-contrato-api.md` — rotas `/public/points` e `/admin/points` (plano 009)
- `docs/08-decisoes-arquiteturais.md` — ADR-0007
- `docs/implementacoes-futuras/DT-011-dashboard-dados-reais.md`
- `docs/tasks/009-pontos-de-interesse-backend.md` — padrões de módulos e testes

## 3. Estado esperado ao iniciar

Produzido pelo plano 009 (confira antes de começar):

- `app/models/point.py`, `app/schemas/point.py`, `app/repositories/point_repository.py`,
  `app/services/point_service.py` (com `PointNotFoundError` e
  `POINT_NOT_FOUND_MESSAGE`), `app/api/v1/routes/admin_points.py`,
  `app/api/v1/routes/public_points.py`.
- `PointRepository.find_published_by_slug(slug)` e `list_points(status)`.
- `app/core/indexes.py` com índices de `users` e `points`.
- `get_point_service` em `app/api/deps.py`; fixture `as_admin` em `tests/conftest.py`
  (plano 008).

Não existe collection `visits` nem rota de métricas.

## 4. Escopo

**Dentro:**

- modelo, schemas, repository e service de visita;
- `POST /public/points/{slug}/visits`;
- `GET /admin/metrics/overview`;
- contagens auxiliares no `PointRepository`;
- índices de `visits`; testes; documentação.

**Fora:**

- uso das métricas no painel — plano 015;
- chamada do registro de visita pelo app do visitante — planos 017 (AR) e 020 (VR);
- limite de taxa no registro de visitas — ver seção 11; registrar como dívida;
- séries temporais, gráficos, exportação.

## 5. Decisões tomadas no planejamento

| Questão | Decisão | Motivo |
|---|---|---|
| Dados guardados por visita | Só `point_slug`, `mode` e `visited_at` | Visitante é anônimo; não guardar IP nem navegador (privacidade) |
| Visita a rascunho ou slug inexistente | `404 "Ponto de interesse nao encontrado."` | Mesmo comportamento da página pública |
| Resposta do registro | `201 {"recorded": true}` | Contrato do projeto |
| Janela de "visitas recentes" | Últimos 7 dias, constante `METRICS_RECENT_DAYS = 7` | Contrato do projeto |
| Mais visitados | Top 5, constante `TOP_POINTS_LIMIT = 5` | Contrato do projeto |
| Ponto excluído com visitas | Visitas permanecem; o ponto some do top 5 | Histórico preservado; sem nome não há o que exibir |
| Relógio | `MetricsService.overview(now: datetime)`; a rota passa `datetime.now(timezone.utc)` | Testável sem congelar o tempo |
| Agregações | Pipelines `$group` no repository | Contagem feita pelo banco, não em Python |
| Onde fica a rota de visita | `app/api/v1/routes/public_points.py` | Mesmo recurso público (`/public/points/{slug}`) |

## 6. Passos de implementação

Backend em `services/backend`, docs no orquestrador; branch
`plano/010-visitas-e-metricas-backend`.

### Passo 1 — Modelo e schemas de visita

**Arquivo novo:** `app/models/visit.py`

```python
VISIT_MODE_AR = "ar"
VISIT_MODE_VR = "vr"


@dataclass(slots=True)
class VisitModel:
    point_slug: str
    mode: str
    visited_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def to_mongo(self) -> dict[str, Any]:
        return asdict(self)
```

**Arquivo novo:** `app/schemas/visit.py`

```python
class VisitCreate(BaseModel):
    mode: Literal["ar", "vr"]


class VisitRecordedResponse(BaseModel):
    recorded: bool
```

**Arquivo novo:** `app/schemas/metrics.py`

```python
class VisitsByMode(BaseModel):
    ar: int
    vr: int


class TopPoint(BaseModel):
    slug: str
    name: str
    visits: int


class MetricsOverviewResponse(BaseModel):
    points_total: int
    points_published: int
    visits_total: int
    visits_last_7_days: int
    visits_by_mode: VisitsByMode
    top_points: list[TopPoint]
```

### Passo 2 — Repository de visitas

**Arquivo novo:** `app/repositories/visit_repository.py`

```python
class VisitRepository:
    def __init__(self, database: Any | None) -> None: ...
    async def create_visit(self, visit_data: dict[str, Any]) -> None: ...
    async def count_all(self) -> int: ...                                # count_documents({})
    async def count_since(self, since: datetime) -> int: ...             # visited_at >= since
    async def count_by_mode(self) -> dict[str, int]: ...                 # {"ar": n, "vr": m}
    async def top_point_slugs(self, limit: int) -> list[tuple[str, int]]: ...
```

- Collection `visits`; mesmo padrão de `_require_collection` e tradução de `PyMongoError`
  em `ConnectionError`.
- `count_by_mode`: pipeline `[{"$group": {"_id": "$mode", "total": {"$sum": 1}}}]`; devolve
  sempre as duas chaves, com `0` para o modo ausente.
- `top_point_slugs`: `[{"$group": {"_id": "$point_slug", "total": {"$sum": 1}}},
  {"$sort": {"total": -1, "_id": 1}}, {"$limit": limit}]`.
- Com o `AsyncMongoClient`, `aggregate` é corrotina que devolve cursor:
  `cursor = await collection.aggregate(pipeline)` e `await cursor.to_list(length=None)`.

**Arquivo:** `app/repositories/point_repository.py` — acrescentar:

```python
async def count_points(self, status: str | None = None) -> int: ...
async def find_names_by_slugs(self, slugs: list[str]) -> dict[str, str]: ...  # slug -> name
```

**Arquivo:** `app/core/indexes.py` — acrescentar:

```python
visits = database["visits"]
await visits.create_index("point_slug", name="visits_point_slug")
await visits.create_index("visited_at", name="visits_visited_at")
```

### Passo 3 — Services

**Arquivo novo:** `app/services/visit_service.py`

```python
class VisitService:
    def __init__(self, visit_repository: VisitRepository, point_repository: PointRepository) -> None: ...

    async def record_visit(self, slug: str, mode: str) -> dict[str, bool]:
        """Registra a visita anonima a um ponto publicado."""
        point = await self.point_repository.find_published_by_slug(slug)
        if point is None:
            raise PointNotFoundError(POINT_NOT_FOUND_MESSAGE)
        await self.visit_repository.create_visit(VisitModel(point_slug=slug, mode=mode).to_mongo())
        return {"recorded": True}
```

Reaproveitar `PointNotFoundError` e `POINT_NOT_FOUND_MESSAGE` de
`app/services/point_service.py` (não criar exceção nova).

**Arquivo novo:** `app/services/metrics_service.py`

```python
METRICS_RECENT_DAYS = 7
TOP_POINTS_LIMIT = 5


class MetricsService:
    def __init__(self, point_repository: PointRepository, visit_repository: VisitRepository) -> None: ...

    async def overview(self, now: datetime) -> dict[str, Any]: ...
```

`overview` monta o dicionário no formato de `MetricsOverviewResponse`:

- `points_total = count_points()`; `points_published = count_points("published")`;
- `visits_total = count_all()`;
- `visits_last_7_days = count_since(now - timedelta(days=METRICS_RECENT_DAYS))`;
- `visits_by_mode = count_by_mode()`;
- `top_points`: `top_point_slugs(TOP_POINTS_LIMIT)` → `find_names_by_slugs(slugs)` →
  manter a ordem do ranking e descartar slugs sem nome (ponto excluído).

### Passo 4 — Dependências e rotas

**Arquivo:** `app/api/deps.py` — `get_visit_service(request)` e
`get_metrics_service(request)`, no molde de `get_user_service`, montando os repositories
com `request.app.state.mongo_manager.database`.

**Arquivo:** `app/api/v1/routes/public_points.py` — nova rota:

```python
@router.post(
    "/{slug}/visits",
    response_model=VisitRecordedResponse,
    status_code=status.HTTP_201_CREATED,
)
async def record_visit(
    slug: str,
    payload: VisitCreate,
    service: VisitService = Depends(get_visit_service),
) -> dict[str, bool]:
    """Registra uma visita anonima ao ponto publicado."""
```

Erros: `PointNotFoundError` → `404`; `ConnectionError` → `503` via
`build_database_http_exception`.

**Arquivo novo:** `app/api/v1/routes/admin_metrics.py`

```python
router = APIRouter(
    prefix="/admin/metrics",
    tags=["Admin - Metricas"],
    dependencies=[Depends(require_admin)],
)


@router.get("/overview", response_model=MetricsOverviewResponse)
async def metrics_overview(
    service: MetricsService = Depends(get_metrics_service),
) -> dict[str, Any]:
    """Resumo com contagens reais de pontos e visitas."""
    return await service.overview(datetime.now(timezone.utc))
```

`ConnectionError` → `503`.

**Arquivo:** `app/api/v1/router.py` — incluir `admin_metrics`.

## 7. Testes

Padrão `monkeypatch` nos métodos dos repositories. Rotas admin com `as_admin`.

| Arquivo | Teste | Verifica |
|---|---|---|
| `tests/test_visits.py` (novo) | `test_record_visit_success_returns_201` | Ponto publicado; `create_visit` recebe `point_slug`, `mode="ar"`, `visited_at` com fuso UTC; resposta `{"recorded": true}` |
| `tests/test_visits.py` | `test_record_visit_vr_mode` | `mode="vr"` aceito |
| `tests/test_visits.py` | `test_record_visit_invalid_mode_returns_422` | `mode="web"` → `422` |
| `tests/test_visits.py` | `test_record_visit_unpublished_point_returns_404` | `find_published_by_slug` → `None`; `create_visit` **não** é chamado |
| `tests/test_visits.py` | `test_record_visit_returns_503_when_database_fails` | `create_visit` levanta `ConnectionError` |
| `tests/test_visits.py` | `test_visit_document_has_no_personal_data` | Chaves do documento salvo são exatamente `{"point_slug", "mode", "visited_at"}` |
| `tests/test_metrics.py` (novo) | `test_metrics_overview_success` | Repositories falsos; corpo igual ao esperado, incluindo `visits_by_mode` e `top_points` em ordem |
| `tests/test_metrics.py` | `test_metrics_overview_requires_admin` | Sem `as_admin` e sem token → `401`; token `role="user"` → `403` |
| `tests/test_metrics.py` | `test_metrics_overview_returns_503_when_database_fails` | |
| `tests/test_metrics_service.py` (novo) | `test_overview_uses_seven_day_window` | `now` fixo; `count_since` recebe `now - 7 dias` |
| `tests/test_metrics_service.py` | `test_overview_skips_deleted_points_in_ranking` | Slug sem nome some de `top_points`; ordem preservada |
| `tests/test_metrics_service.py` | `test_overview_empty_database` | Tudo zero; `visits_by_mode == {"ar": 0, "vr": 0}`; `top_points == []` |
| `tests/test_visit_repository.py` (novo) | `test_count_by_mode_fills_missing_modes` | Collection falsa devolve só `{"_id": "ar", "total": 3}` → `{"ar": 3, "vr": 0}` |

Para os testes de service, use classes falsas simples (sem banco) passadas no construtor.
Para o de repository, uma collection falsa cujo `aggregate` é `async` e devolve um
objeto com `to_list` `async`.

```bash
cd services/backend && pytest -v
bash scripts/validate.sh
```

## 8. Documentação a atualizar

- [x] `docs/06-contrato-api.md` — seções `POST /public/points/{slug}/visits` e
      `GET /admin/metrics/overview` (exemplo de corpo, tabela de erros); remover "sessões
      de uso e métricas" de "Endpoints ausentes"
- [x] `docs/03-artefato-backend.md` — estrutura (novos módulos), endpoints, modelo da
      collection `visits` com os índices, nota de privacidade (sem IP, sem navegador)
- [x] `docs/09-glossario.md` — termo **Visita**: registro anônimo de abertura de um ponto,
      com modo `ar` ou `vr`; ajustar "Sessão de uso" para apontar para "Visita"
- [x] `docs/implementacoes-futuras/DT-011-...md` — Status `Parcial`: endpoint de métricas
      pronto (plano 010); consumo no painel pendente (plano 015)
- [x] `docs/implementacoes-futuras/DT-016-...md` — registrar o avanço: visitas
- [x] Nova dívida em `docs/implementacoes-futuras/` (próximo número livre, seguindo
      `_template.md`): "Registro de visitas sem limite de taxa" — qualquer pessoa pode
      inflar as métricas chamando a rota pública em laço; proposta: limite por IP em
      memória como o do login (plano 007). Atualizar o índice `README.md` da pasta

## 9. Critérios de aceite

- [x] `POST /public/points/{slug}/visits` com `{"mode": "ar"}` grava a visita e responde
      `201 {"recorded": true}`
- [x] Rascunho ou slug inexistente responde `404` e não grava nada
- [x] O documento salvo contém apenas `point_slug`, `mode` e `visited_at`
- [x] `GET /admin/metrics/overview` responde no formato do contrato e exige admin
- [x] Índices `visits_point_slug` e `visits_visited_at` criados na subida
- [x] `bash scripts/validate.sh` passando, cobertura ≥ 80%
- [x] Documentação da seção 8 atualizada, incluindo a dívida nova

## 10. Commits esperados

Backend:

```
feat(visits): adiciona modelo, repository e service de visitas
feat(visits): expoe registro publico de visita a um ponto
feat(metrics): adiciona resumo administrativo de pontos e visitas
test: cobre registro de visitas e metricas
```

Orquestrador:

```
docs: documenta visitas e metricas no contrato e no backend
docs: registra divida de limite de taxa no registro de visitas
```

## 11. Riscos e pontos de atenção

- **Métricas infláveis.** A rota de visita é pública e sem limite; aceitável para o
  projeto acadêmico, mas precisa ficar registrada como dívida (seção 8).
- **`aggregate` assíncrono.** Com `pymongo.AsyncMongoClient`, esquecer o `await` antes de
  `aggregate` gera erro de tipo no mypy e falha em execução; o teste do repository pega
  isso.
- **Fuso horário.** Use sempre `datetime.now(timezone.utc)`; comparar datas com e sem
  fuso levanta `TypeError`.
- **Ponto renomeado.** O ranking usa o nome atual do ponto (busca por slug); como o slug é
  imutável após publicar (ADR-0007), as visitas continuam ligadas ao ponto certo.

## 12. Verificação pelo aluno

1. `bash scripts/up.sh`. Tenha um ponto **publicado** (plano 009, verificação, passos 1–5).
2. Abra <http://localhost:8000/docs>. Em `POST /public/points/{slug}/visits`, **Try it
   out**, `slug` = `biblioteca-central`, corpo `{"mode": "ar"}`. **Execute** três vezes:
   cada resposta é `201`.
3. Repita uma vez com `{"mode": "vr"}`.
4. Faça login como administrador e use **Authorize** com o token.
5. Em `GET /admin/metrics/overview`, **Execute**. Deve mostrar `visits_total: 4`,
   `visits_by_mode` com `ar: 3` e `vr: 1`, e a Biblioteca Central em `top_points`.
6. Tente registrar visita com `slug` = `nao-existe`: resposta `404`.

---

## Registro de execução

**Executado por:** Heitor Aquino, com agente de IA, em 2026-11-11.

**O que foi feito**

- Backend (`services/backend`, branch `plano/010-visitas-e-metricas-backend`):
  `VisitModel`, schemas `VisitCreate`/`VisitRecordedResponse` e de métricas,
  `VisitRepository` (contagens e pipelines `$group`), `count_points` e
  `find_names_by_slugs` no `PointRepository`, índices `visits_point_slug` e
  `visits_visited_at`, `VisitService` e `MetricsService`, dependências
  `get_visit_service`/`get_metrics_service`, rota `POST /public/points/{slug}/visits` e
  roteador `/admin/metrics` com `GET /overview`.
- Testes: 23 novos (105 → 128), incluindo os 13 da seção 7 e extras para os índices de
  `visits`, os novos métodos do `PointRepository` e os demais métodos do
  `VisitRepository`. Cobertura 93,6%.
- Documentação: contrato da API, artefato backend, glossário, DT-011 (Parcial), DT-016
  (andamento) e nova DT-021.

**Validação**

- `ruff check .`, `ruff format --check .`, `mypy app`, `pytest --cov=app --cov-fail-under=80`:
  128 testes passando, cobertura 93,61%.
- `bash scripts/validate.sh` com E2E: código de saída 0 (backend, frontend, duplicação e
  e2e `[OK]`; vr-app pulado). Na máquina do aluno, o `cmd.exe` aberto pelo `npm` não
  encontrava o `node`; a validação rodou com `npm_config_script_shell` apontando para o
  Git Bash, apenas na sessão, sem alterar código nem configuração do projeto.

**Desvios do plano**

- `datetime.now(UTC)` no lugar de `datetime.now(timezone.utc)`: mesmo valor; o Ruff do
  projeto (regra `UP017`) exige o alias `UTC`, já usado em `point_service.py`.
- Os schemas de métricas e os métodos novos do `PointRepository` entraram no primeiro
  commit do backend, junto com o restante do domínio de visitas.

**Dívidas novas:** [DT-021](../implementacoes-futuras/DT-021-limite-taxa-registro-visitas.md)
— registro de visitas sem limite de taxa (prevista na seção 11).

---

## Prompt de delegação

Cole no Claude Code, na pasta `quest-project`, trocando o nome:

```text
Você é a sessão de EXECUÇÃO do projeto TourVR.
Execute o plano docs/tasks/010-visitas-e-metricas-backend.md.
Antes de qualquer ação, leia docs/tasks/protocolo-execucao.md e siga o "Prompt 1 — EXECUTAR" etapa por etapa.
Meu nome, para registrar no plano: <SEU NOME>
```
