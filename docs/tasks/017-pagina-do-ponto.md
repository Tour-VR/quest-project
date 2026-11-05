# 017 — Página do ponto (modo AR)

| | |
|---|---|
| **Status** | Validado |
| **Fase** | 3 — App do visitante, modo AR |
| **Depende de** | 010, 016 |
| **Dívidas atendidas** | DT-016 (parcial) |
| **ADRs relacionadas** | ADR-0006, ADR-0007 |
| **Artefatos afetados** | VR App · Orquestrador |
| **Planejado em** | 2026-11-05 |
| **Validado em** | 2026-11-05 por Ciro Macedo |
| **Executado em** | — |

---

## 1. Objetivo

Entregar a experiência presencial: quem lê o QR Code afixado na biblioteca cai em
`/p/biblioteca-central` e vê nome, resumo, história e fotos do lugar. A visita é registrada
de forma anônima. A página inicial `/` passa a listar os pontos publicados. Fecha também o
primeiro golden path do visitante no E2E.

## 2. Leia antes de começar

- `docs/05-artefato-vr-app.md`
- `docs/06-contrato-api.md`: seções `GET /public/points`, `GET /public/points/{slug}`,
  `POST /public/points/{slug}/visits` (criadas nos planos 009 e 010)
- `docs/08-decisoes-arquiteturais.md`: ADR-0007 (modelo de domínio)
- `docs/tasks/005-validacao-e-e2e.md`: organização de `e2e/`

## 3. Estado esperado ao iniciar

- Plano 016 concluído: `services/vr-app` com `src/core/api/client.ts` (`apiClient`, base
  `/api`), `src/core/constants/routes.ts` (`ROUTES`), `src/routes/AppRoutes.tsx`,
  `HomePage.tsx` provisória, `gen:types` funcionando, serviço `vr-app` no compose.
- Planos 009 e 010 concluídos no backend:
  - `GET /public/points` → `PointPublicSummary[]` (`slug`, `name`, `summary`, `cover_url`);
  - `GET /public/points/{slug}` → `PointPublicDetail` (`slug`, `name`, `summary`,
    `history`, `media[]`), 404 se não publicado;
  - `POST /public/points/{slug}/visits` com `{ "mode": "ar" }` → 201 `{ "recorded": true }`;
  - `GET /admin/metrics/overview` com `visits_total` e `visits_by_mode`.
- `MediaItem.url` é relativa (`/media/<uuid>.jpg`) quando enviada pelo upload (plano 013)
  ou absoluta quando cadastrada à mão. Se o 013 ainda não estiver concluído, a galeria
  funciona com qualquer URL.
- `e2e/` com Playwright e `e2e/support/api.ts` contendo `createAdminUser()` e `login`.

## 4. Escopo

**Dentro:**

- `src/core/api/points.ts` e `src/core/api/visits.ts`;
- hooks `usePublicPoints`, `usePoint`, `useRegisterVisit`;
- componentes de conteúdo compartilhados (servem também ao modo VR):
  `PointHeader`, `PointContent`, `MediaGallery`, `LoadingState`, `ErrorState`;
- página `/` (lista de pontos) e `/p/:slug` (página do ponto, modo AR);
- página "Ponto não encontrado" para 404;
- teste E2E `@golden` do visitante.

**Fora:**

- leitor de QR dentro do app: plano 018 (o QR já funciona com a câmera nativa do celular,
  porque contém uma URL);
- sobreposição em câmera / realidade aumentada visual: não faz parte desta fase. "Modo
  AR" aqui significa a visita **presencial** guiada por QR;
- modo VR: planos 020 e 021;
- tradução, acessibilidade por áudio, compartilhamento: não previstos.

## 5. Decisões tomadas no planejamento

| Questão | Decisão | Motivo |
|---|---|---|
| Quando registrar a visita | Uma vez por montagem da página, após o ponto carregar com sucesso | Visita só conta se o visitante viu o conteúdo |
| Duplicidade no `StrictMode` | `useRef` guardando o último slug registrado | O `StrictMode` monta o efeito duas vezes em desenvolvimento |
| Falha ao registrar visita | Silenciosa para o visitante (`console.warn` apenas) | Conteúdo é o que importa; métrica perdida não deve virar erro na tela |
| Recarregar a página | Conta outra visita | Simplicidade; sem armazenamento no aparelho (visitante anônimo) |
| `history` com quebras de linha | Renderizar parágrafos separando por linha em branco; **sem** HTML nem Markdown | Evita XSS; texto simples atende |
| URL de mídia | Helper `mediaSrc(url)`: se começa com `/media/`, usar como está (*proxy*); senão, usar a URL absoluta | Mesma origem para mídia enviada |
| Galeria | Fotos em coluna (rolagem vertical), legenda abaixo, `alt` obrigatório (`alt_text`), `loading="lazy"` | *Mobile-first*, sem biblioteca de carrossel |
| Só fotos | Filtrar `media` por `kind === 'photo'` | Panorama é exclusivo do modo VR (plano 019) |
| Lista inicial | Cartões com capa (`cover_url`) ou bloco neutro sem imagem | Página `/` útil para quem chega sem QR |

## 6. Passos de implementação

Passos 1 a 6 em `services/vr-app`, branch `plano/017-pagina-do-ponto`.

### Passo 1 — Tipos e chamadas à API

Rode `npm run gen:types` com o backend atualizado e versione o `api.d.ts`. Em
`src/core/types/index.ts`, exporte aliases: `PointSummary`, `PointDetail`, `MediaItem`,
`VisitMode` (`'ar' | 'vr'`).

`src/core/api/points.ts`:

```ts
export async function fetchPublicPoints(): Promise<PointSummary[]> {
  const { data } = await apiClient.get<PointSummary[]>('/public/points');
  return data;
}

export async function fetchPublicPoint(slug: string): Promise<PointDetail> {
  const { data } = await apiClient.get<PointDetail>(`/public/points/${encodeURIComponent(slug)}`);
  return data;
}
```

`src/core/api/visits.ts`: `registerVisit(slug, mode)` → `POST /public/points/{slug}/visits`.

`src/core/api/errors.ts`: `isNotFound(error): boolean` (Axios com `response.status === 404`).

`src/core/media.ts`: `mediaSrc(url: string): string` (regra da seção 5).

### Passo 2 — Hooks

`src/core/hooks/usePublicPoints.ts` e `src/core/hooks/usePoint.ts` devolvem um estado
discriminado:

```ts
export type AsyncState<T> =
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'not-found' }
  | { status: 'error' };
```

Declare `AsyncState` em `src/core/types/async.ts`. `usePoint(slug)` recarrega quando o
`slug` muda e ignora respostas de um slug anterior (flag `cancelled` no efeito).

`src/core/hooks/useRegisterVisit.ts`:

```ts
export function useRegisterVisit(slug: string | undefined, mode: VisitMode, ready: boolean) {
  const registered = useRef<string | null>(null);
  useEffect(() => {
    if (!ready || !slug || registered.current === slug) return;
    registered.current = slug;
    registerVisit(slug, mode).catch((error: unknown) => {
      console.warn('Nao foi possivel registrar a visita.', error);
    });
  }, [slug, mode, ready]);
}
```

### Passo 3 — Componentes de conteúdo compartilhados

Em `src/core/components/` (cada um no próprio arquivo, cada um < 60 linhas por função):

- `PointHeader.tsx`: `name` (h1) e `summary`;
- `PointContent.tsx`: seção "História" com os parágrafos de `history`; a divisão em
  parágrafos fica numa função pura `splitParagraphs(text)` em `src/core/text.ts`;
- `MediaGallery.tsx`: recebe `MediaItem[]`, mostra só fotos, `<figure>` com `<img
  src={mediaSrc(url)} alt={alt_text} loading="lazy">` e `<figcaption>`; nada é
  renderizado se a lista estiver vazia;
- `LoadingState.tsx` ("Carregando…"), `ErrorState.tsx` (mensagem + botão "Tentar de novo"
  que recebe `onRetry`).

### Passo 4 — Página do ponto (modo AR)

`src/modes/ar/PointPage.tsx`, rota `/p/:slug`:

- `loading` → `LoadingState`;
- `not-found` → `src/modes/ar/PointNotFound.tsx`: "Este ponto não existe ou ainda não foi
  publicado." + link "Ver todos os pontos" (`ROUTES.home`);
- `error` → `ErrorState` com nova tentativa;
- `success` → `PointHeader`, `MediaGallery`, `PointContent`, e no rodapé um link
  "Conhecer outros pontos" para `/`;
- `useRegisterVisit(slug, 'ar', state.status === 'success')`;
- `document.title = `${name} · TourVR`` quando carregar.

Layout: coluna única, `max-w-prose mx-auto px-4`, imagens com `w-full rounded-lg`, texto
com no mínimo 16 px. Nada de largura fixa: precisa ficar bom em 360 px de largura.

### Passo 5 — Página inicial com a lista

Substitua o conteúdo provisório de `src/routes/HomePage.tsx`:

- título "TourVR · Tour do campus" e uma frase: "Escaneie o QR Code de um local ou
  escolha um ponto abaixo.";
- lista de cartões `src/core/components/PointCard.tsx` (capa, nome, resumo) que levam a
  `ROUTES.point(slug)`;
- estado vazio: "Nenhum ponto publicado ainda.";
- o selo de saúde da API do plano 016 sai da página inicial; mova o `useApiHealth` para
  um rodapé discreto `src/core/components/ApiStatusFooter.tsx` exibido só quando a API
  estiver indisponível.

Registre a rota `/p/:slug` em `AppRoutes.tsx`.

### Passo 6 — Testes unitários

| Arquivo | Teste | Verifica |
|---|---|---|
| `src/core/api/points.test.ts` | URLs chamadas | `/public/points` e `/public/points/biblioteca` (slug codificado) |
| `src/core/api/visits.test.ts` | corpo do POST | `{ mode: 'ar' }` |
| `src/core/media.test.ts` | relativa e absoluta | `/media/x.jpg` intacta; `https://...` intacta |
| `src/core/text.test.ts` | `splitParagraphs` | separa por linha em branco, remove vazios |
| `src/core/hooks/usePoint.test.tsx` | sucesso, 404, erro | estados `success`, `not-found`, `error` |
| `src/core/hooks/useRegisterVisit.test.tsx` | duas renderizações | `registerVisit` chamado **uma** vez; não chama com `ready=false`; erro não lança |
| `src/core/components/MediaGallery.test.tsx` | filtro e alt | ignora `panorama`; `alt` presente; vazio não renderiza |
| `src/modes/ar/PointPage.test.tsx` | 4 estados | carregando, conteúdo, "não existe", erro com "Tentar de novo" |
| `src/routes/HomePage.test.tsx` | lista e vazio | cartões com link `/p/<slug>`; mensagem de vazio |

Mocks: `vi.mock('../api/points')` etc. Nunca chamar a rede nos testes.

### Passo 7 — E2E do visitante

No orquestrador, branch `plano/017-pagina-do-ponto`.

`e2e/support/api.ts`: acrescente `createPublishedPoint(token, { slug, name, summary,
history })` usando `POST /admin/points` e `POST /admin/points/{id}/publish`, e
`getMetrics(token)` com `GET /admin/metrics/overview`.

`e2e/tests/visitor-point.spec.ts`:

```ts
test('@golden visitante abre a pagina do ponto e a visita e registrada', async ({ page }) => {
  const token = await loginAsAdmin();
  const slug = `e2e-ponto-${Date.now()}`;
  await createPublishedPoint(token, { slug, name: 'Biblioteca E2E', summary: 'Resumo', history: 'Historia do nome.' });
  const before = await getMetrics(token);

  await page.goto(`${VISITOR_URL}/p/${slug}`);
  await expect(page.getByRole('heading', { name: 'Biblioteca E2E' })).toBeVisible();
  await expect(page.getByText('Historia do nome.')).toBeVisible();

  await expect.poll(async () => (await getMetrics(token)).visits_by_mode.ar).toBe(before.visits_by_mode.ar + 1);
});

test('visitante ve mensagem amigavel para ponto inexistente', async ({ page }) => {
  await page.goto(`${VISITOR_URL}/p/nao-existe-${Date.now()}`);
  await expect(page.getByText('Este ponto não existe')).toBeVisible();
});
```

Use as constantes e o helper de login já existentes em `e2e/support/` (os nomes reais
podem diferir: adapte aos que o plano 005/008 criou, sem renomeá-los).

## 7. Testes

```bash
cd services/vr-app && npm run lint && npm run format:check && npm run test:coverage && npm run build
cd ../.. && bash scripts/validate.sh
```

## 8. Documentação a atualizar

- [ ] `docs/05-artefato-vr-app.md`: rotas `/` e `/p/:slug`, componentes do núcleo,
      regra de registro de visita
- [ ] `docs/06-contrato-api.md`: na seção de cada endpoint público, linha "Consumido por:
      vr-app"
- [ ] `docs/00-visao-geral.md`: tabela de estado, "App do visitante — modo AR: página do
      ponto funcionando"

## 9. Critérios de aceite

- [ ] Ponto publicado abre em `/p/<slug>` com nome, resumo, história e fotos
- [ ] Ponto em rascunho ou inexistente mostra a mensagem amigável, sem tela branca
- [ ] Cada abertura da página registra exatamente uma visita `ar`
- [ ] Página legível em 360 px de largura, sem rolagem horizontal
- [ ] `/` lista os pontos publicados e leva à página de cada um
- [ ] E2E `@golden` do visitante passando
- [ ] `bash scripts/validate.sh` passando
- [ ] Documentação da seção 8 atualizada

## 10. Commits esperados

`services/vr-app`:

```
feat(core): adiciona chamadas publicas de pontos e visitas
feat(core): adiciona hooks de ponto e registro de visita
feat(core): adiciona componentes de conteudo do ponto
feat(ar): adiciona a pagina do ponto em /p/:slug
feat: lista os pontos publicados na pagina inicial
```

Orquestrador:

```
test(e2e): adiciona o golden path do visitante na pagina do ponto
docs: documenta a pagina do ponto e o registro de visita
```

## 11. Riscos e pontos de atenção

- **Visita contada em dobro.** Se o E2E acusar +2, o guarda do `useRef` não está
  funcionando. Confira o teste unitário do hook antes de mexer no E2E.
- **Imagem quebrada pelo *proxy*.** Se `/media/...` não carregar no `vr-app`, confira a
  regra `/media` no `vite.config.ts` (plano 016), não altere a URL no backend.
- **Dados do E2E se acumulam no banco local.** Slugs com `Date.now()` evitam colisão; não
  apague dados no teste.
- **Ordem dos componentes:** fotos antes da história, porque quem está diante do prédio
  quer reconhecer o lugar primeiro.

## 12. Verificação pelo aluno

1. No painel (`http://localhost:3000`), crie e publique um ponto, por exemplo
   "Biblioteca Central" com slug `biblioteca-central`. Se o painel ainda não tiver essa
   tela, peça ao agente para criar o ponto pela API.
2. Abra `http://localhost:3001/p/biblioteca-central`: aparecem o nome, o resumo, as fotos
   (se houver) e a história.
3. Abra `http://localhost:3001/p/nao-existe`: aparece a mensagem de ponto inexistente.
4. Abra `http://localhost:3001`: o ponto aparece na lista.
5. **No celular:** com `npm run dev:https` rodando (peça ao agente), abra
   `https://<IP>:3001/p/biblioteca-central` e confira que a página fica boa na tela
   pequena, sem precisar arrastar para o lado.
6. No painel, o número de visitas aumentou (se o plano 015 já estiver concluído).

---

## Prompt de delegação

Cole no Claude Code, na pasta `quest-project`, trocando o nome:

```text
Você é a sessão de EXECUÇÃO do projeto TourVR.
Execute o plano docs/tasks/017-pagina-do-ponto.md.
Antes de qualquer ação, leia docs/tasks/protocolo-execucao.md e siga o "Prompt 1 — EXECUTAR" etapa por etapa.
Meu nome, para registrar no plano: <SEU NOME>
```
