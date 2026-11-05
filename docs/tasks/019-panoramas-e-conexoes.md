# 019 — Panoramas e conexões

| | |
|---|---|
| **Status** | Validado |
| **Fase** | 4 — App do visitante, modo VR |
| **Depende de** | 013, 017 |
| **Dívidas atendidas** | DT-016 (parcial) |
| **ADRs relacionadas** | ADR-0007 (amplia), ADR-0008 |
| **Artefatos afetados** | Backend · Frontend · VR App · Orquestrador |
| **Planejado em** | 2026-11-05 |
| **Validado em** | 2026-11-05 por Ciro Macedo |
| **Executado em** | — |

---

## 1. Objetivo

Dar a cada ponto o que o modo VR precisa:

- um **panorama 360°**, a foto equirretangular do lugar;
- **conexões**: setas para os pontos vizinhos, posicionadas por ângulo, para que o
  visitante remoto passe da biblioteca à cantina sem sair do óculos.

O backend passa a guardar e validar esses dados, e o painel ganha as telas para
cadastrá-los. A cena VR que os exibe vem no plano 020.

## 2. Leia antes de começar

- `docs/03-artefato-backend.md`
- `docs/06-contrato-api.md`: seções `/admin/points`, `/public/points/{slug}` e
  `/admin/media`
- `docs/08-decisoes-arquiteturais.md`: ADR-0007 e ADR-0008
- `docs/tasks/009-pontos-de-interesse-backend.md` e `docs/tasks/013-upload-de-midia.md`

## 3. Estado esperado ao iniciar

- Plano 009 concluído: `app/models/point.py`, `app/schemas/point.py`,
  `app/repositories/point_repository.py`, `app/services/point_service.py`,
  `app/api/v1/routes/admin_points.py`, `app/api/v1/routes/public_points.py`;
  `MediaItem.kind` aceita apenas `"photo"`; exceções `PointInputError`,
  `PointNotFoundError`, `PointConflictError`.
- Plano 013 concluído: `POST /admin/media` aceita JPEG/PNG/WebP até 20 MB e devolve
  `{url: "/media/<uuid>.<ext>", ...}`; o formulário do ponto no painel tem a seção de fotos
  (`src/services/media.ts`, helper `mediaUrl`).
- Plano 012 concluído: `src/pages/points/PointForm.tsx` e `src/services/points.ts`.
- Plano 017 concluído: `vr-app` consome `PointPublicDetail` e filtra `kind === 'photo'`
  na galeria (não quebra quando aparecer `panorama`).

Confira os nomes reais dos arquivos antes de editar; se divergirem do contrato, use os
reais e registre no PR.

## 4. Escopo

**Dentro:**

- backend: `kind: "panorama"` no `MediaItem` (no máximo 1 por ponto);
- backend: campo `connections` no ponto, com validação;
- backend: `PointPublicDetail` com `panorama_url` e `connections` (só para alvos
  publicados);
- painel: upload de panorama com pré-visualização e aviso de proporção;
- painel: editor de conexões (alvo, rótulo, ângulo);
- tipos regenerados no painel e no `vr-app`;
- E2E de API para as regras novas.

**Fora:**

- a cena 360° e os *hotspots*: planos 020 e 021;
- conversão ou redimensionamento automático da imagem no servidor: o painel orienta o
  tamanho certo, sem processar a imagem;
- ângulo vertical (`pitch`) da conexão: as setas ficam todas na altura do horizonte,
  ligeiramente abaixo da linha dos olhos (decisão do plano 021);
- vídeo 360°: não previsto (ADR-0008).

## 5. Decisões tomadas no planejamento

| Questão | Decisão | Motivo |
|---|---|---|
| Onde fica o panorama | Um `MediaItem` com `kind: "panorama"` na mesma lista `media` | Reaproveita o upload, a validação e o armazenamento do plano 013 |
| Quantos panoramas | No máximo 1 por ponto (`PointInputError` se houver 2) | Um ponto = uma cena |
| Formato | Equirretangular 2:1, JPEG, **recomendado 4096×2048** | Limite prático de textura do navegador do Quest 3; 8192×4096 estoura memória e falha em silêncio |
| Validação da proporção | **No painel** (aviso, não bloqueio) lendo `naturalWidth/naturalHeight`; o backend não abre a imagem | Evita dependência de processamento de imagem no servidor |
| Modelo da conexão | `{target_slug: str, label: str (1-60), yaw_degrees: float (-180 a 180)}` | Contrato da Fase 4 |
| Limite | Até 8 conexões por ponto (`MAX_CONNECTIONS = 8`) | Mais que isso polui a cena |
| Validação do alvo | Precisa existir (qualquer status), não pode ser o próprio ponto, sem alvo repetido | Rascunho pode ligar a rascunho; o público só vê alvos publicados |
| Alvo excluído depois | Na exclusão de um ponto, remover as conexões que apontam para ele (`$pull` em todos os pontos) | Evita seta para lugar inexistente |
| Alvo despublicado | Mantido no banco; omitido na resposta pública | Republicar restaura a seta sem retrabalho |
| Significado do `yaw` | 0° = centro da imagem panorâmica; positivo = para a **direita**; ±180° = bordas da imagem | Regra simples para o administrador: "olhando o centro da foto, quantos graus à direita está a porta?" |
| Onde editar | Seção "Modo VR" no formulário do ponto existente | Uma tela por ponto |

## 6. Passos de implementação

### Backend — `services/backend`, branch `plano/019-panoramas-e-conexoes`

#### Passo 1 — Modelo e constantes

`app/models/point.py`:

- `MediaKind` passa a `Literal["photo", "panorama"]`;
- nova dataclass `PointConnection(target_slug: str, label: str, yaw_degrees: float)`;
- `PointOfInterest.connections: list[PointConnection] = field(default_factory=list)`.

`app/schemas/point.py`, junto das constantes de limite criadas no plano 009:

```python
MAX_CONNECTIONS = 8
MAX_PANORAMAS = 1
CONNECTION_LABEL_MAX_LENGTH = 60
YAW_MIN_DEGREES = -180.0
YAW_MAX_DEGREES = 180.0
```

Documentos antigos sem `connections` são lidos como lista vazia (`doc.get("connections", [])`).

#### Passo 2 — Schemas

`app/schemas/point.py`:

```python
class PointConnectionSchema(BaseModel):
    target_slug: str = Field(pattern=SLUG_PATTERN, min_length=3, max_length=60)
    label: str = Field(min_length=1, max_length=CONNECTION_LABEL_MAX_LENGTH)
    yaw_degrees: float = Field(ge=YAW_MIN_DEGREES, le=YAW_MAX_DEGREES)
```

- `MediaItemSchema.kind: Literal["photo", "panorama"]`;
- `PointCreate` e `PointUpdate`: `connections: list[PointConnectionSchema]` (opcional no
  update), `max_length=MAX_CONNECTIONS`;
- `PointAdminResponse`: inclui `connections`;
- `PointPublicDetail`: inclui `panorama_url: str | None` e
  `connections: list[PointPublicConnection]` com `target_slug`, `label`, `yaw_degrees` e
  **`target_name`** (para o rótulo da seta não depender de outra requisição);
- `PointPublicSummary`: inclui `has_panorama: bool` (a lista `/vr` do plano 020 mostra só
  pontos com panorama).

#### Passo 3 — Regras no service

`app/services/point_service.py`, em `create_point` e `update_point`, uma função privada
`_validate_vr_fields(point_slug, media, connections)` que levanta `PointInputError`:

- mais de `MAX_PANORAMAS` itens `panorama` → "O ponto pode ter apenas um panorama.";
- conexão para o próprio slug → "Um ponto não pode se conectar a si mesmo.";
- `target_slug` repetido → "Conexão repetida para o mesmo ponto.";
- alvo inexistente → "Ponto de destino não encontrado: <slug>." (consulta
  `point_repository.find_slugs_in(slugs)` — **uma** consulta para todas as conexões).

Na resposta pública (`get_public_point`):

- `panorama_url` = `url` do item `panorama`, ou `None`;
- `connections` filtradas aos alvos **publicados** (`find_published_by_slugs(slugs)`),
  com `target_name` preenchido; mantenha a ordem cadastrada.

Na exclusão (`delete_point`): após excluir, `point_repository.remove_connections_to(slug)`.

Se a troca de slug for permitida pelo plano 009, atualize também as conexões que apontam
para o slug antigo (`rename_connection_target(old, new)`). Se o 009 proibiu trocar slug,
ignore este parágrafo.

#### Passo 4 — Repository

`app/repositories/point_repository.py`, só consultas, sem regra:

- `find_slugs_in(slugs: list[str]) -> set[str]`;
- `find_published_by_slugs(slugs: list[str]) -> list[dict[str, Any]]` (projeção `slug`, `name`);
- `remove_connections_to(slug: str) -> None`: `update_many({}, {"$pull": {"connections": {"target_slug": slug}}})`;
- `find_published` passa a projetar o que for preciso para `has_panorama`.

Todas traduzem `PyMongoError` em `ConnectionError`, como o restante.

#### Passo 5 — Testes do backend

| Arquivo | Teste | Verifica |
|---|---|---|
| `tests/test_point_connections.py` | criar com conexão válida | 201 e `connections` na resposta admin |
| idem | alvo inexistente | 400 com a mensagem do alvo |
| idem | conexão para si mesmo | 400 |
| idem | alvo repetido | 400 |
| idem | 9 conexões | 422 |
| idem | `yaw_degrees` 181 | 422 |
| idem | dois panoramas | 400 |
| `tests/test_public_points.py` (estender) | detalhe com panorama e conexões | `panorama_url` preenchido; só alvos publicados; `target_name` |
| idem | ponto sem panorama | `panorama_url` nulo, `has_panorama` falso na lista |
| `tests/test_admin_points.py` (estender) | excluir ponto alvo | `remove_connections_to` chamado com o slug |
| idem | banco indisponível nas novas consultas | 503 |

MongoDB sempre mockado, no padrão de `tests/test_auth_flow.py`.

### Painel — `services/frontend`, branch `plano/019-panoramas-e-conexoes`

#### Passo 6 — Tipos e constantes

`npm run gen:types` com o backend atualizado; versionar `src/types/api.d.ts`.
`src/constants/points.ts`: `MAX_CONNECTIONS`, `CONNECTION_LABEL_MAX_LENGTH`, `YAW_MIN`,
`YAW_MAX`, `PANORAMA_RECOMMENDED_WIDTH = 4096`, `PANORAMA_ASPECT_RATIO = 2`,
`PANORAMA_ASPECT_TOLERANCE = 0.02`.

#### Passo 7 — Upload de panorama

`src/components/points/PanoramaField.tsx`:

- usa o mesmo `uploadMedia` de `src/services/media.ts` (plano 013);
- após o upload, cria/substitui o único item `kind: 'panorama'` em `media`;
- mostra pré-visualização em faixa larga (`aspect-[2/1] object-cover`);
- função pura `src/utils/panorama.ts` → `checkPanoramaSize(width, height)` devolve
  `{ ok: boolean, warnings: string[] }`:
  - proporção fora de 2:1 ± 2% → "A imagem não parece um panorama 360° (proporção 2:1).";
  - largura > 4096 → "Imagem maior que 4096 px: o Quest 3 pode não exibir. Reduza para
    4096×2048.";
  - largura < 2048 → "Imagem pequena: vai ficar borrada no óculos.";
- avisos aparecem em amarelo; **não** bloqueiam o envio;
- texto de ajuda fixo: "Use uma foto 360° equirretangular (proporção 2:1), de
  preferência 4096×2048 em JPEG. Celulares com modo panorama 360° ou câmeras 360° geram
  esse formato."

A galeria de fotos do plano 013 deve passar a ignorar o item `panorama` (filtrar por
`kind === 'photo'`).

#### Passo 8 — Editor de conexões

`src/components/points/ConnectionsEditor.tsx` (+ `useConnectionsEditor.ts` para a lógica):

- lista de linhas: **Destino** (select com os outros pontos, carregados de
  `GET /admin/points`, exibindo nome e status), **Rótulo** (pré-preenchido com o nome do
  destino), **Ângulo** (número de -180 a 180, passo 5, com o texto de ajuda "0 = centro
  da foto; positivo = à direita");
- botões "Adicionar conexão" (desabilitado ao chegar em 8) e "Remover";
- o próprio ponto não aparece no select; destinos já usados ficam desabilitados;
- destino em rascunho mostra o selo "rascunho — invisível ao visitante".

No `PointForm.tsx`, nova seção **Modo VR** com `PanoramaField` e `ConnectionsEditor`. Se o
formulário passar de 200 linhas, extraia a seção para `PointVrSection.tsx`.

#### Passo 9 — Testes do painel

| Arquivo | Teste | Verifica |
|---|---|---|
| `src/utils/panorama.test.ts` | tamanhos | 4096×2048 ok; 8192×4096 avisa; 3000×2000 avisa proporção; 1024×512 avisa pequena |
| `src/components/points/PanoramaField.test.tsx` | upload | substitui o panorama anterior; mostra avisos |
| `src/components/points/ConnectionsEditor.test.tsx` | edição | adiciona, remove, limite de 8, próprio ponto ausente, destino repetido desabilitado |
| `src/pages/points/PointForm.test.tsx` (estender) | envio | `connections` e panorama vão no corpo do PUT |

### VR App — `services/vr-app`, branch `plano/019-panoramas-e-conexoes`

#### Passo 10 — Tipos

`npm run gen:types` e versionar. Aliases novos em `src/core/types/index.ts`:
`PointConnection`. Rodar os testes existentes: a galeria (plano 017) precisa continuar
ignorando o panorama.

### Orquestrador — branch `plano/019-panoramas-e-conexoes`

#### Passo 11 — E2E de API

`e2e/tests/vr-data.spec.ts` (sem tag `@golden`): cria dois pontos publicados A e B, liga
A→B com `yaw_degrees: 90`, e verifica em `GET /public/points/A` que a conexão vem com
`target_name`. Despublica B e verifica que a conexão some da resposta pública.

## 7. Testes

```bash
cd services/backend && ruff check . && ruff format --check . && mypy app && pytest --cov=app --cov-fail-under=80
cd ../frontend && npm run lint && npm run format:check && npm run test:coverage && npm run build
cd ../vr-app && npm run lint && npm run test:coverage && npm run build
cd ../.. && bash scripts/validate.sh
```

## 8. Documentação a atualizar

- [ ] `docs/06-contrato-api.md`: `MediaItem.kind`, `connections` nos payloads admin,
      `panorama_url`, `connections` e `has_panorama` nas respostas públicas, novas
      mensagens de erro
- [ ] `docs/08-decisoes-arquiteturais.md`: ADR-0007, acrescentar "Ampliação (plano 019)"
      com as decisões da seção 5; ADR-0008, acrescentar recomendação de 4096×2048
- [ ] `docs/03-artefato-backend.md`: regras de validação e a limpeza de conexões na exclusão
- [ ] `docs/04-artefato-frontend.md`: seção "Modo VR" do formulário
- [ ] `docs/09-glossario.md`: termos *panorama equirretangular*, *conexão*, *yaw*

## 9. Critérios de aceite

- [ ] Ponto aceita um panorama e recusa o segundo
- [ ] Conexões validadas (alvo existe, não é o próprio, sem repetição, até 8, ângulo -180 a 180)
- [ ] Resposta pública traz `panorama_url` e só conexões para pontos publicados, com `target_name`
- [ ] Excluir um ponto remove as setas que apontavam para ele
- [ ] Painel envia panorama com pré-visualização e avisos de tamanho
- [ ] Painel edita conexões com as restrições acima
- [ ] Galerias de fotos do painel e do `vr-app` ignoram o panorama
- [ ] `bash scripts/validate.sh` passando
- [ ] Documentação da seção 8 atualizada

## 10. Commits esperados

Backend:

```
feat(points): aceita panorama como tipo de midia
feat(points): adiciona conexoes entre pontos com validacao
feat(public): expoe panorama e conexoes publicadas no detalhe do ponto
test(points): cobre regras de panorama e conexoes
```

Frontend:

```
feat(points): adiciona upload de panorama com avisos de tamanho
feat(points): adiciona editor de conexoes do modo VR
```

VR App:

```
chore(types): regenera os tipos da api com panorama e conexoes
```

Orquestrador:

```
test(e2e): verifica conexoes publicas entre pontos
docs: registra panorama e conexoes no contrato e nas ADRs 0007 e 0008
```

## 11. Riscos e pontos de atenção

- **Quatro repositórios num plano.** Siga a ordem: backend, painel, vr-app, orquestrador.
  O merge também segue essa ordem (o painel depende do contrato novo).
- **Documentos antigos sem `connections`.** Sempre `get("connections", [])`; nunca
  `doc["connections"]`.
- **Panorama pesado.** 4096×2048 em JPEG qualidade 85 fica entre 1 e 3 MB. Arquivos de
  15 a 20 MB são sinal de imagem grande demais, e o aviso do painel deve aparecer.
- **Sentido do `yaw`.** O plano 020 converte o ângulo para posição 3D com a mesma regra da
  seção 5. Não inverta o sinal aqui para "acertar" visualmente: o ajuste, se houver, é
  feito na conversão do plano 020.

## 12. Verificação pelo aluno

1. Consiga uma foto 360°: tire uma com um celular que tenha modo "Foto 360°"/"Photo
   Sphere", ou baixe uma de exemplo com licença livre (o agente pode indicar).
2. No painel, abra um ponto, vá à seção **Modo VR** e envie o panorama. A
   pré-visualização mostra a faixa larga da imagem.
3. Envie uma foto comum (de celular, vertical) como panorama: aparece o aviso amarelo de
   proporção.
4. Crie dois pontos publicados, "Biblioteca" e "Cantina". Na Biblioteca, adicione uma
   conexão para a Cantina com ângulo 90 e salve.
5. Abra `http://localhost:8000/public/points/<slug-da-biblioteca>`: aparecem
   `panorama_url` e a conexão com o nome "Cantina".
6. Despublique a Cantina e recarregue: a conexão some da resposta pública, mas continua
   no painel.

---

## Prompt de delegação

Cole no Claude Code, na pasta `quest-project`, trocando o nome:

```text
Você é a sessão de EXECUÇÃO do projeto TourVR.
Execute o plano docs/tasks/019-panoramas-e-conexoes.md.
Antes de qualquer ação, leia docs/tasks/protocolo-execucao.md e siga o "Prompt 1 — EXECUTAR" etapa por etapa.
Meu nome, para registrar no plano: <SEU NOME>
```
