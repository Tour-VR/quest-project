# 013 — Upload de mídia

| | |
|---|---|
| **Status** | Em execução — Heitor Aquino — 2026-11-12 |
| **Fase** | 2 — Painel administrativo |
| **Depende de** | 012 |
| **Dívidas atendidas** | DT-016 (parcial — mídia) |
| **ADRs relacionadas** | ADR-0008 (decidida por este plano), ADR-0007 |
| **Artefatos afetados** | Backend, Frontend, Orquestrador (compose, docs, E2E) |
| **Planejado em** | 2026-11-05 |
| **Validado em** | 2026-11-05 por Ciro Macedo |
| **Executado em** | — |

---

## 1. Objetivo

Permitir que o administrador envie fotos de cada ponto pelo painel. O backend guarda o
arquivo em disco, num volume do Docker, e o serve em `/media/...`. O plano registra a
ADR-0008 (estratégia de mídia), antecipada da Fase 4 porque os panoramas do modo VR
(planos 019-021) dependem de mídia servida pela mesma origem da API.

## 2. Leia antes de começar

- `docs/03-artefato-backend.md`, `docs/04-artefato-frontend.md`
- `docs/06-contrato-api.md`
- `docs/08-decisoes-arquiteturais.md` — ADR-0006, ADR-0007 e o texto atual da ADR-0008
- `docs/tasks/000-visao-macro-opcao-b.md` — seção "Desvio em relação às fases acima"

## 3. Estado esperado ao iniciar

- `services/backend/requirements.txt:12` — `python-multipart` já é dependência (necessária
  para `UploadFile`).
- `services/backend/app/main.py:46` — `include_router(api_router)`; nada montado em
  `/media`.
- `docs/08-decisoes-arquiteturais.md` — ADR-0008 com estado "Em aberto".
- **002** — `docker-compose.yml` com serviço `backend` montando `./services/backend:/app`.
- **007/008** — `require_admin` em `app/api/deps.py`; `ensure_indexes` no lifespan.
- **009** — `MediaItem{id, kind, url, caption, alt_text}` embutido em `PointOfInterest`;
  `kind` aceita apenas `"photo"`; `PUT /admin/points/{point_id}` aceita `media`.
- **012** — `PointForm` com `usePointForm`; `PUT` sem `media`; componentes de feedback.

## 4. Escopo

**Dentro:**

- backend: `POST /admin/media`, armazenamento em disco, validação de tipo e tamanho,
  `StaticFiles` em `/media`;
- compose: volume `media-data`;
- painel: seção "Fotos" no formulário de edição do ponto (enviar, legenda, texto
  alternativo, reordenar, remover);
- registro da ADR-0008.

**Fora:**

- panorama 360° (`kind: "panorama"`) — plano 019;
- redimensionamento, miniaturas, conversão de formato — registrar como dívida;
- remoção do arquivo em disco quando a foto é retirada do ponto (arquivos órfãos) —
  registrar como dívida (DT nova, ver passo 10);
- armazenamento em objeto (S3, MinIO) ou CDN;
- upload na **criação** do ponto: fotos são adicionadas na edição, depois de salvo.

## 5. Decisões tomadas no planejamento

| Questão | Decisão | Motivo |
|---|---|---|
| Onde guardar | Disco do backend, diretório `settings.media_dir` (padrão `media`), volume `media-data` em `/app/media` | Simples, sem serviço extra; persiste entre `down`/`up` |
| Como servir | `app.mount("/media", StaticFiles(directory=...))` | Mesma origem da API: sem problema de CORS em textura WebGL |
| Nome do arquivo | `<uuid4 hex>.<ext>`; nome original descartado | Evita colisão, caminho malicioso e acento |
| Tipos aceitos | JPEG, PNG, WebP, detectados pela **assinatura** dos bytes | Extensão e `content_type` vêm do cliente e podem mentir |
| Tamanho máximo | `settings.media_max_bytes = 20 * 1024 * 1024` (20 MB) | Panoramas 4096×2048 em JPEG ficam bem abaixo |
| Leitura | Em blocos de 1 MB, abortando ao passar do limite | Não carregar arquivo gigante inteiro na memória |
| Erros | `413` "Arquivo maior que 20 MB."; `415` "Formato não suportado. Envie JPEG, PNG ou WebP."; `400` arquivo vazio | Códigos HTTP corretos e mensagens em português |
| URL devolvida | Relativa: `/media/<arquivo>` | Painel prefixa com `API_BASE_URL`; app do visitante usa o proxy `/media` |
| Camadas | Rota `admin_media.py` → `MediaService` → `MediaStorage` (repositório de arquivos) | Mesmo padrão Rota → Service → Repository |
| Associação ao ponto | O painel envia o arquivo, recebe a URL e grava a lista `media` com `PUT /admin/points/{id}` | Reaproveita o contrato do 009; sem endpoint novo de associação |
| `id` do item | Item novo vai **sem** `id` (o backend gera, conforme o 009); item existente mantém o `id` recebido | O 009 define `MediaItemInput.id` opcional e gera `uuid4` quando ausente |

### Texto da ADR-0008 (substituir a seção atual em `docs/08-decisoes-arquiteturais.md`)

```markdown
## ADR-0008 — Estratégia de mídia

**Data:** 2026-11-05 · **Estado:** Aceita · **Plano:** 013

**Contexto.** Cada ponto do tour tem fotos (modo AR) e, a partir do plano 019, um
panorama 360° (modo VR). Só aceitar URLs externas exigiria que os alunos hospedassem
imagens em outro serviço, e texturas WebGL carregadas de outra origem falham sem
cabeçalhos CORS. O volume esperado é pequeno: dezenas de pontos, poucas imagens cada.

**Decisão.** O backend recebe o arquivo em `POST /admin/media` (somente admin), valida
tipo pela assinatura dos bytes (JPEG, PNG, WebP) e tamanho (até 20 MB), grava em disco com
nome `<uuid>.<ext>` no diretório `MEDIA_DIR` e serve em `/media/<arquivo>`. No Docker, o
diretório é o volume `media-data`. O ponto guarda apenas a URL relativa.

**Justificativa.** Nenhum serviço novo; mesma origem da API, o que elimina CORS no painel
e, via proxy, no app do visitante; persistência garantida pelo volume.

**Consequências.**

- ➕ Upload pelo painel, sem conhecimento técnico.
- ➕ Panoramas do modo VR funcionam como textura sem configuração extra.
- ➖ Escala de uma máquina só; migrar para armazenamento de objeto exige trocar o
  `MediaStorage` e reescrever URLs.
- ➖ Sem redimensionamento: a imagem é servida como enviada.
- ➖ Arquivos retirados de um ponto ficam órfãos no disco (dívida registrada).

**Alteração em relação à visão macro.** Antecipada da Fase 4 para a Fase 2.
```

## 6. Passos de implementação

### Passo 1 — Configuração

**Repositório:** backend, branch `plano/013-upload-de-midia`

**Arquivo:** `app/core/config.py` — acrescente:

```python
media_dir: str = "media"
media_max_bytes: int = 20 * 1024 * 1024
```

`.env.example` do backend e da raiz: `MEDIA_DIR=media` com comentário. `.gitignore` e
`.dockerignore` do backend: `media/`.

### Passo 2 — Detecção de tipo

**Arquivo novo:** `app/core/media_types.py`

```python
from __future__ import annotations

JPEG_SIGNATURE = b"\xff\xd8\xff"
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
RIFF_SIGNATURE = b"RIFF"
WEBP_MARKER = b"WEBP"
WEBP_MARKER_OFFSET = 8
SIGNATURE_BYTES = 12

def detect_image_type(header: bytes) -> tuple[str, str] | None:
    """Devolve (content_type, extensao) a partir dos primeiros bytes, ou None."""
    if header.startswith(JPEG_SIGNATURE):
        return "image/jpeg", "jpg"
    if header.startswith(PNG_SIGNATURE):
        return "image/png", "png"
    if header.startswith(RIFF_SIGNATURE) and header[WEBP_MARKER_OFFSET:SIGNATURE_BYTES] == WEBP_MARKER:
        return "image/webp", "webp"
    return None
```

### Passo 3 — Armazenamento

**Arquivo novo:** `app/repositories/media_storage.py`

Classe `MediaStorage(base_dir: Path)` com `save(content: bytes, extension: str) -> str`
(cria o diretório se preciso, grava `uuid4().hex + "." + extension`, devolve o nome do
arquivo). Erro de disco (`OSError`) vira `ConnectionError("Falha ao gravar o arquivo de
midia.")`, seguindo o padrão dos repositórios.

### Passo 4 — Serviço

**Arquivo novo:** `app/services/media_service.py`

- Exceções de domínio: `MediaTooLargeError`, `MediaTypeError`, `MediaEmptyError`.
- `async def store(self, upload: UploadFile) -> dict[str, str | int]`: lê em blocos de
  `CHUNK_SIZE = 1024 * 1024`, acumula até `settings.media_max_bytes` (passou → 
  `MediaTooLargeError`); vazio → `MediaEmptyError`; `detect_image_type` dos primeiros 12
  bytes (`None` → `MediaTypeError`); grava via `MediaStorage`; devolve
  `{"url": f"/media/{nome}", "content_type": ..., "size_bytes": ...}`.

### Passo 5 — Rota e montagem

**Arquivo novo:** `app/api/v1/routes/admin_media.py`

```python
router = APIRouter(prefix="/admin/media", tags=["Admin - Midia"])

@router.post("", status_code=status.HTTP_201_CREATED, response_model=MediaUploadResponse)
async def upload_media(
    file: UploadFile,
    _admin: dict[str, Any] = Depends(require_admin),
    service: MediaService = Depends(get_media_service),
) -> dict[str, str | int]:
    ...  # traduz MediaTooLargeError→413, MediaTypeError→415, MediaEmptyError→400,
         # ConnectionError→build_database_http_exception
```

`MediaUploadResponse` em `app/schemas/media.py`. `get_media_service` em `app/api/deps.py`.
Registre o router em `app/api/v1/router.py`.

**Arquivo:** `app/main.py` — após `include_router`:

```python
media_path = Path(settings.media_dir)
media_path.mkdir(parents=True, exist_ok=True)
application.mount("/media", StaticFiles(directory=media_path), name="media")
```

### Passo 6 — Compose

**Repositório:** orquestrador, branch `plano/013-upload-de-midia`

**Arquivo:** `docker-compose.yml` — no serviço `backend`, `volumes:` acrescente
`media-data:/app/media`; em `volumes:` do topo, `media-data:`. Em `scripts/reset-db.sh`,
**não** apague `media-data` (mídia não é banco); documente `docker volume rm` manual.

### Passo 7 — Serviço e utilitários no painel

**Repositório:** frontend, branch `plano/013-upload-de-midia`

- `npm run gen:types`.
- **Novo** `src/services/media.ts`: `uploadMedia(file: File)` com `FormData` (campo
  `file`) via `api.post`.
- **Novo** `src/utils/mediaUrl.ts`: `mediaUrl(url) = url.startsWith('/') ?
  API_BASE_URL.replace(/\/$/, '') + url : url`.
- **Novo** `src/constants/media.ts`: `ACCEPTED_IMAGE_TYPES = 'image/jpeg,image/png,image/webp'`,
  `MEDIA_MAX_MB = 20`, `MEDIA_MAX_BYTES`.

### Passo 8 — Seção "Fotos" no formulário

**Arquivos novos:** `src/pages/points/media/MediaSection.tsx`,
`src/pages/points/media/MediaItemCard.tsx`, `src/pages/points/media/MediaUploadButton.tsx`,
`src/hooks/useMediaList.ts`

- Só aparece na edição (`/pontos/:pointId`).
- `MediaUploadButton`: `<input type="file" accept=...>`; valida tamanho no cliente antes
  de enviar ("Arquivo maior que 20 MB."); mostra "Enviando..." durante o upload.
- Após upload: novo item `{kind: 'photo', url, caption: null, alt_text: ''}` no fim da
  lista, e chama `PUT /admin/points/{id}` com a lista `media` completa.
- `MediaItemCard`: miniatura (`<img src={mediaUrl(url)} alt={alt_text}>`, 120 px), campos
  Legenda e Texto alternativo ("Descreva a imagem para quem não pode vê-la"), botões
  "↑", "↓", "Remover". Edição de texto salva ao sair do campo (`onBlur`).
- `useMediaList(point)` concentra a lista, `add`, `update`, `move`, `remove` e a gravação.
- Texto alternativo vazio mostra aviso amarelo "Preencha o texto alternativo" (não bloqueia).
- Ao atingir 20 itens, o botão de envio fica desabilitado com a dica "Limite de 20 fotos".

### Passo 9 — E2E

**Repositório:** orquestrador. **Arquivo novo:** `e2e/fixtures/foto-teste.jpg` (JPEG
pequeno, até 50 KB, gerado pelo agente) e `e2e/tests/midia.spec.ts`:

- `@golden admin envia foto para um ponto` — cria ponto pela API, abre a edição, envia
  `foto-teste.jpg` com `setInputFiles`, preenche texto alternativo, recarrega a página e
  vê a miniatura; `GET` da URL da imagem responde 200 com `image/jpeg`.
- `arquivo que não é imagem é recusado` — envia um `.txt` renomeado para `.jpg` e vê
  "Formato não suportado".

### Passo 10 — Dívida dos arquivos órfãos

**Arquivo novo:** `docs/implementacoes-futuras/DT-018-midia-orfa-em-disco.md` (próximo
número livre, se 018 já existir), seguindo `_template.md`: arquivos retirados de um ponto
ou de pontos excluídos permanecem no volume; proposta de limpeza periódica comparando o
disco com as URLs referenciadas.

## 7. Testes

| Arquivo | Teste | Verifica |
|---|---|---|
| `tests/test_media_types.py` | JPEG, PNG, WebP reconhecidos; texto, GIF e vazio → `None` | Assinaturas |
| `tests/test_media_upload.py` | admin envia JPEG → 201 com `url` `/media/....jpg` e arquivo existe (`tmp_path` + `monkeypatch` em `settings.media_dir`) | Caminho feliz |
| `tests/test_media_upload.py` | arquivo acima do limite (limite reduzido via monkeypatch) → 413 | Tamanho |
| `tests/test_media_upload.py` | `.jpg` com conteúdo de texto → 415; vazio → 400 | Tipo real |
| `tests/test_media_upload.py` | sem token → 401; usuário comum → 403 | Autorização |
| `tests/test_media_upload.py` | `GET /media/<arquivo>` após upload → 200 | Servir arquivo |
| `src/utils/mediaUrl.test.ts` | relativa prefixada; absoluta intocada | Helper |
| `src/hooks/useMediaList.test.ts` | adicionar, mover, remover chamam `updatePoint` com a lista certa | Regra da lista |
| `src/pages/points/media/MediaSection.test.tsx` | arquivo grande recusado no cliente; upload exibe miniatura; limite de 20 desabilita | Tela |

```bash
cd services/backend && ruff check . && ruff format --check . && mypy app && pytest --cov=app --cov-fail-under=80
cd ../frontend && npm run lint && npm run format:check && npm run test:coverage && npm run build
cd ../.. && bash scripts/validate.sh
```

## 8. Documentação a atualizar

- [ ] `docs/08-decisoes-arquiteturais.md` — ADR-0008 com o texto da seção 5; índice com
      estado "Aceita"
- [ ] `docs/06-contrato-api.md` — `POST /admin/media` (201, 400, 401, 403, 413, 415) e
      `GET /media/{arquivo}`
- [ ] `docs/03-artefato-backend.md` — `media_types`, `MediaStorage`, `MediaService`,
      variáveis `MEDIA_DIR` e limite
- [ ] `docs/04-artefato-frontend.md` — seção de fotos, `mediaUrl`
- [ ] `docs/02-artefato-orquestrador.md` — volume `media-data` e como apagá-lo
- [ ] `docs/tasks/000-visao-macro-opcao-b.md` — nenhuma alteração (o desvio já está registrado)
- [ ] `docs/implementacoes-futuras/README.md` — nova dívida no índice

## 9. Critérios de aceite

- [ ] Admin envia JPEG, PNG ou WebP de até 20 MB e vê a miniatura no formulário
- [ ] Arquivo com conteúdo que não é imagem recebe 415, mesmo com extensão `.jpg`
- [ ] Arquivo acima de 20 MB recebe 413 e nunca é gravado
- [ ] Imagem acessível em `http://localhost:8000/media/<arquivo>`
- [ ] Fotos persistem após `bash scripts/down.sh` e `bash scripts/up.sh`
- [ ] Legenda, texto alternativo e ordem salvos no ponto
- [ ] ADR-0008 registrada como Aceita
- [ ] `bash scripts/validate.sh` passando com os 2 cenários E2E novos
- [ ] Documentação da seção 8 atualizada

## 10. Commits esperados

Backend:

```
feat(media): detecta tipo de imagem pela assinatura dos bytes
feat(media): adiciona armazenamento e servico de midia em disco
feat(media): adiciona POST /admin/media e serve arquivos em /media
```

Frontend:

```
feat(media): adiciona servico de upload e helper de URL de midia
feat(points): adiciona secao de fotos no formulario do ponto
```

Orquestrador:

```
build(compose): adiciona volume media-data ao backend
test(e2e): cobre envio e recusa de midia
docs: registra a ADR-0008 e documenta o upload de midia
```

## 11. Riscos e pontos de atenção

- **Permissão de escrita no volume.** O backend roda como usuário não-root (plano 002). O
  volume nomeado é criado como root: no `Dockerfile`, crie `/app/media` e faça `chown` para
  o usuário da aplicação **antes** do `USER`, para que o volume herde o dono.
- **`StaticFiles` com diretório inexistente** falha na subida; por isso o `mkdir` antes do
  `mount`.
- **Testes não podem gravar em `media/` do repositório:** sempre `tmp_path`.
- **Ordem do `mount`:** depois do `include_router`, para não sombrear rotas.

## 12. Verificação pelo aluno

1. `bash scripts/up.sh`, abra `http://localhost:3000` e entre como administrador.
2. Em "Pontos", abra um ponto já criado. Aparece a seção "Fotos".
3. Clique em "Enviar foto" e escolha uma foto do seu computador. A miniatura aparece.
4. Preencha o texto alternativo, por exemplo "Fachada da biblioteca".
5. Recarregue a página (F5): a foto e o texto continuam lá.
6. Rode `bash scripts/down.sh` e depois `bash scripts/up.sh`. A foto ainda está no ponto.
7. Tente enviar um arquivo PDF (na janela de escolha, troque o filtro para "Todos os
   arquivos"): aparece "Formato não suportado".

---

## Prompt de delegação

Cole no Claude Code, na pasta `quest-project`, trocando o nome:

```text
Você é a sessão de EXECUÇÃO do projeto TourVR.
Execute o plano docs/tasks/013-upload-de-midia.md.
Antes de qualquer ação, leia docs/tasks/protocolo-execucao.md e siga o "Prompt 1 — EXECUTAR" etapa por etapa.
Meu nome, para registrar no plano: <SEU NOME>
```
