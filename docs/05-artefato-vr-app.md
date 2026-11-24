# 05 — Artefato: App do Visitante (`services/vr-app`)

> Repositório: `github.com/Tour-VR/vr-app` · Commit fixado: `4e6f85f` (atualizado no fechamento do plano 016)
> Última verificação contra o código: 2026-11-24 (plano 020)

> **Nome impreciso.** O submódulo chama-se `vr-app`, mas passa a abrigar também o modo AR
> (celular), conforme a [ADR-0006](08-decisoes-arquiteturais.md). Renomear o repositório no
> GitHub é opcional e está registrado como pendência na visão macro.

## Status: 🟡 Em construção — modo AR completo, cena VR 360° pronta, navegação VR por fazer

O plano 016 criou o projeto: React 19 + Vite 6 + TypeScript (strict) + Tailwind 4 +
React Router 7 + Axios, com as mesmas regras de qualidade do painel (ESLint, Prettier,
Vitest com cobertura mínima de 80%). O plano 017 entregou a visita presencial: a página
inicial lista os pontos publicados e `/p/:slug` (endereço do QR Code) mostra nome, resumo,
fotos e história do ponto, registrando a visita de forma anônima. O plano 018 trouxe o
leitor de QR para dentro do app (`/scan`), fechando o tour AR presencial de ponta a ponta.
O plano 020 trouxe o modo VR: `/vr/:slug` mostra o panorama 360° do ponto em volta do
visitante, no navegador comum e no Quest 3. A navegação entre pontos chega no plano 021.

## Arquivos

```
services/vr-app/
├── index.html                 lang="pt-BR", título "TourVR"
├── package.json               "tourvr-visitor-app"; scripts na seção Comandos;
│                              @zxing/browser ^0.1.5 + @zxing/library ^0.21 (plano 018);
│                              three ^0.175, @react-three/fiber ^9, drei ^10, xr ^6 (plano 020)
├── vite.config.ts             proxy /api e /media; HTTPS só com --mode https
├── vite-env.d.ts              tipagem de import.meta.env (VITE_PROXY_TARGET)
├── vitest.config.ts           jsdom, cobertura v8 com limite de 80%; exclui src/modes/vr/scene/
├── eslint.config.js           cópia do painel (strictTypeChecked, limites de tamanho)
├── .prettierrc, .prettierignore, tsconfig.json, .gitignore, .gitattributes
├── .env.example               VITE_PROXY_TARGET=http://localhost:8000
├── Dockerfile.dev, .dockerignore
├── .github/workflows/ci.yml   lint, formatação, testes com cobertura e build
├── scripts/gen-types.mjs      gera src/core/types/api.d.ts do OpenAPI do backend
└── src/
    ├── main.tsx               monta <App /> em #root
    ├── App.tsx                BrowserRouter + AppRoutes
    ├── index.css              @import 'tailwindcss' e fundo branco explícito no body
    ├── core/                  núcleo compartilhado entre os modos AR e VR
    │   ├── api/client.ts      apiClient (Axios, baseURL '/api', timeout de 10 s)
    │   ├── api/health.ts      fetchApiHealth() → GET /health/
    │   ├── api/points.ts      fetchPublicPoints(), fetchPublicPoint(slug)
    │   ├── api/visits.ts      registerVisit(slug, mode) → POST /public/points/{slug}/visits
    │   ├── api/errors.ts      isNotFound(error): resposta 404 do Axios
    │   ├── media.ts           mediaSrc(url): endereço usado no src das imagens
    │   ├── text.ts            splitParagraphs(text): parágrafos por linha em branco
    │   ├── constants/http.ts  REQUEST_TIMEOUT_MS
    │   ├── constants/points.ts SLUG_MIN_LENGTH (3), SLUG_MAX_LENGTH (60)
    │   ├── constants/qr.ts    SCAN_INTERVAL_MS (250), INVALID_QR_NOTICE_MS (3000)
    │   ├── constants/routes.ts ROUTES: /, /p/:slug, /scan, /vr, /vr/:slug
    │   ├── hooks/useApiHealth.ts      estado loading | ok | error
    │   ├── hooks/useAsyncResource.ts  carregamento genérico → AsyncState + reload
    │   ├── hooks/usePublicPoints.ts   lista de pontos publicados
    │   ├── hooks/usePoint.ts          ponto por slug; recarrega quando o slug muda
    │   ├── hooks/useRegisterVisit.ts  registra uma visita por montagem
    │   ├── qr/                leitura de QR, isolada e testável (ver "Leitor de QR")
    │   │   ├── parseTourUrl.ts      texto lido → slug do ponto, ou null
    │   │   ├── types.ts             interface QrScanner { start(video, onResult); stop() }
    │   │   ├── nativeScanner.ts     BarcodeDetector do navegador, uma leitura a cada 250 ms
    │   │   ├── zxingScanner.ts      @zxing/browser (BrowserQRCodeReader)
    │   │   ├── createQrScanner.ts   escolhe o leitor; zxing por import() dinâmico
    │   │   ├── camera.ts            openRearCamera, stopStream, cameraErrorMessage
    │   │   └── barcode-detector.d.ts tipo mínimo do BarcodeDetector (fora do TS 5.8)
    │   ├── components/        PointHeader, PointContent, MediaGallery, PointCard,
    │   │                      LoadingState, ErrorState, ApiStatusFooter
    │   └── types/             api.d.ts (gerado, versionado), index.ts (aliases) e
    │                          async.ts (AsyncState)
    ├── modes/ar/
    │   ├── PointPage.tsx      página do ponto, rota /p/:slug
    │   ├── PointNotFound.tsx  "Este ponto não existe ou ainda não foi publicado."
    │   ├── ScanPage.tsx       leitor de QR, rota /scan
    │   └── useQrScan.ts       câmera + leitor + navegação; libera tudo ao sair
    ├── modes/vr/              modo VR remoto (plano 020), carregado sob demanda
    │   ├── VrRoutes.tsx       "" → VrListPage; ":slug" → VrPointPage (export default, React.lazy)
    │   ├── VrListPage.tsx     rota /vr: pontos com panorama
    │   ├── VrPointPage.tsx    rota /vr/:slug: cena, painel HTML, botão Entrar em VR
    │   ├── constants.ts       raio e rotação da esfera, câmera, painel 3D
    │   ├── geometry.ts        yawToPosition, facingCenterRotationY (puras, testadas)
    │   ├── hooks/
    │   │   ├── usePanoramaTexture.ts   carrega a textura; dispose ao trocar ou sair
    │   │   ├── useImmersiveVrSupport.ts navigator.xr.isSessionSupported('immersive-vr')
    │   │   └── useVrPoints.ts          usePublicPoints filtrado por has_panorama
    │   └── scene/             componentes 3D sem lógica (fora da cobertura unitária)
    │       ├── VrCanvas.tsx       Canvas + XR + OrbitControls; xrStore
    │       ├── PanoramaSphere.tsx esfera invertida com a textura
    │       └── InfoPanel3D.tsx    nome e resumo, só na sessão imersiva
    ├── routes/
    │   ├── AppRoutes.tsx      "/" → HomePage; "/p/:slug" → PointPage; "/scan" → ScanPage;
    │   │                      "/vr/*" → VrRoutes (lazy + Suspense); outra → NotFoundPage
    │   ├── HomePage.tsx       botões "Escanear QR Code" e "Visita virtual 360°" e lista de pontos
    │   └── NotFoundPage.tsx   "Página não encontrada" com link para o início
    └── test/setup.ts          jest-dom no Vitest
```


## Rotas e telas

| Rota | Tela | Conteúdo |
|---|---|---|
| `/` | `routes/HomePage.tsx` | Título "TourVR · Tour do campus", a frase "Escaneie o QR Code de um local ou escolha um ponto abaixo.", o botão principal **Escanear QR Code** (→ `/scan`) e um cartão (`PointCard`) por ponto publicado, com capa (`cover_url`) ou bloco cinza neutro, nome e resumo, levando a `/p/<slug>`. Lista vazia: "Nenhum ponto publicado ainda." |
| `/p/:slug` | `modes/ar/PointPage.tsx` | Modo AR, isto é, a visita **presencial** guiada pelo QR Code. Ordem: `PointHeader` (nome em `h1` e resumo), `MediaGallery` (fotos), `PointContent` (seção "História") e o link "Conhecer outros pontos". O título da aba vira `<nome> · TourVR` |
| `/scan` | `modes/ar/ScanPage.tsx` | Leitor de QR: título "Escanear QR Code", vídeo da câmera traseira com uma moldura quadrada como mira, o texto "Aponte para o QR Code do local" e o link "Voltar" (→ `/`). Detalhes em "Leitor de QR" |
| `/vr` | `modes/vr/VrListPage.tsx` | Título "Visita virtual 360°", um `PointCard` por ponto publicado com panorama (`has_panorama`), levando a `/vr/<slug>`, e o link "Voltar ao início". Lista vazia: "Nenhum ponto com visita 360° ainda." |
| `/vr/:slug` | `modes/vr/VrPointPage.tsx` | Modo VR, a visita **remota**. A cena 360° ocupa a tela (`h-dvh`); por cima, um painel recolhível com `PointHeader`, o texto "Arraste para olhar em volta.", o botão **Entrar em VR** (só com WebXR) e o link "Voltar à lista". Detalhes em "Modo VR" |
| qualquer outra | `routes/NotFoundPage.tsx` | "Página não encontrada" |

**Estados de carregamento.** `usePoint` e `usePublicPoints` devolvem `{ state, reload }`,
em que `state` é um `AsyncState` (`src/core/types/async.ts`): `loading` → `LoadingState`
("Carregando…"); `success` → conteúdo; `not-found` (resposta 404) → `PointNotFound`, com
o link "Ver todos os pontos"; `error` (rede, 5xx) → `ErrorState` com o botão "Tentar de
novo", que chama `reload`. Resposta de um slug anterior é descartada.

**Galeria de fotos** (`MediaGallery`). Só itens `kind === 'photo'` (panorama é do modo VR,
plano 019), em coluna, `<img alt={alt_text} loading="lazy">` com largura total e legenda
em `<figcaption>`. Sem fotos, nada é renderizado. O `src` passa por `mediaSrc(url)`: a URL
relativa `/media/...` vai pelo *proxy* na mesma origem e a absoluta é usada como está.

**História.** Texto simples, nunca interpretado como HTML ou Markdown (evita XSS):
`splitParagraphs` separa por linha em branco e descarta trechos vazios.

**Layout.** Coluna única `max-w-prose mx-auto px-4`, texto de no mínimo 16 px, sem
largura fixa: legível em 360 px sem rolagem horizontal. O `body` tem fundo branco
explícito (`src/index.css`), para o texto não sumir em navegadores com tema escuro.

**Links para o modo VR.** A página inicial tem o botão "Visita virtual 360°" (→ `/vr`); a
página do ponto mostra o mesmo botão, logo abaixo do cabeçalho, quando o ponto tem
`panorama_url` (→ `/vr/<slug>`).

**Rodapé da API** (`ApiStatusFooter`, na página inicial). Só aparece quando
`GET /api/health/` falha: "API indisponível no momento." Substitui o selo da API do
plano 016.

## Leitor de QR

A página `/scan` lê o QR Code do local sem sair do app. A lógica fica no hook
`useQrScan` (`src/modes/ar/useQrScan.ts`) e no módulo `src/core/qr/`:

1. **Sem contexto seguro** (`!window.isSecureContext`, por exemplo `http://<IP>:3001`), a
   página mostra "A câmera só funciona em endereço https." e nem pede a câmera.
2. `openRearCamera()` pede a câmera traseira (`getUserMedia` com
   `facingMode: 'environment'`) e liga o stream ao `<video playsInline muted autoPlay>`.
3. `createQrScanner()` escolhe o leitor. Com `BarcodeDetector` no navegador, usa o
   **nativo**; sem ele, carrega o **zxing** por `import('./zxingScanner')`. O build gera
   o zxing num arquivo à parte (`dist/assets/zxingScanner-*.js`, ~108 kB gzip), que só é
   baixado nesse caso. Em desenvolvimento, o console mostra `[qr] leitor: nativo` ou
   `[qr] leitor: zxing`.
4. A cada leitura, `parseTourUrl(texto)` aceita qualquer URL `http(s)` cujo caminho seja
   `/p/<slug>`, **independentemente do domínio** (o IP muda entre redes), com o slug na
   regra do backend: minúsculas, números e hífens simples, de 3 a 60 caracteres.
   - Slug válido: para leitor e câmera e navega para `/p/<slug>` dentro do app.
   - Outro QR: "Este QR Code não é de um ponto do tour." por 3 s, e a leitura continua.
5. Ao sair da página (voltar, navegar, erro ou desmontagem), o leitor para e todas as
   trilhas do stream são encerradas (`stopStream`): a luz da câmera apaga.

**Mensagens de erro da câmera** (`cameraErrorMessage`), sempre acompanhadas do lembrete
"Você também pode ler o QR Code com a câmera do próprio celular, sem o app.":

| Erro | Mensagem |
|---|---|
| Contexto inseguro | A câmera só funciona em endereço https. |
| `NotAllowedError`, `SecurityError` | O acesso à câmera foi negado. Libere a câmera para este site nas configurações do navegador e recarregue a página. |
| `NotFoundError`, `OverconstrainedError` | Nenhuma câmera foi encontrada neste aparelho. |
| `NotReadableError` | A câmera está sendo usada por outro aplicativo. Feche-o e tente de novo. |
| outro | Não foi possível abrir a câmera. |

**Navegadores e leitor usado**

| Navegador | `BarcodeDetector` | Leitor | Verificado |
|---|---|---|---|
| Chrome no Android | sim | nativo | 2026-11-23, Redmi Note 15: QR do painel abre o ponto, QR de outro site mostra o aviso, câmera apaga ao voltar, visita contada no dashboard |
| Safari no iOS | não | zxing | pendente — depende de iPhone na turma |
| Firefox (qualquer) | não | zxing | não testado |
| Chrome no Windows (desktop) | não | zxing | 2026-11-23: `BarcodeDetector` ausente; página inicial não baixa o zxing; sem permissão de câmera, `/scan` mostra a mensagem de acesso negado |

O Quest 3 não lê QR no navegador (ADR-0006): lá o visitante usa o modo VR.

## Modo VR

A rota `/vr/:slug` coloca o visitante **no centro de uma esfera** com a foto 360° do ponto
pintada por dentro.

**Carregamento sob demanda.** `AppRoutes` importa `modes/vr/VrRoutes` com `React.lazy`,
dentro de `<Suspense fallback={<LoadingState />}>`. O build gera o modo VR (three.js e
React Three Fiber) num arquivo à parte, `dist/assets/VrRoutes-*.js` (~330 kB gzip): quem só
usa o modo AR (`/`, `/p/:slug`, `/scan`) nunca o baixa. `VrRoutes.tsx` usa `export default`,
exceção à convenção exigida pelo `React.lazy`. A `@react-three/xr` ainda gera arquivos do
emulador de Quest (`emulate-*.js`, `*_room-*.js`), que nunca são baixados porque o emulador
está desligado (ver abaixo).

**Estados** (`VrPointPage`): ponto carregando → `LoadingState`; 404 → `PointNotFound`; erro
→ `ErrorState`. Com o ponto, `usePanoramaTexture(point.panorama_url)`:

| Estado da textura | Tela |
|---|---|
| `loading` | `LoadingState` |
| `not-found` (`panorama_url` nulo) | "Este ponto ainda não tem visita 360°." e o link "Ver a página do ponto" (→ `/p/<slug>`) |
| `error` | `ErrorState` "Não foi possível carregar o panorama."; "Tentar de novo" remonta a vista e baixa a textura outra vez |
| `success` | cena + painel HTML |

**Textura.** `usePanoramaTexture` carrega com `TextureLoader.loadAsync(mediaSrc(url))` pela
mesma origem (proxy `/media`, sem CORS), marca `colorSpace = SRGBColorSpace` e chama
`texture.dispose()` ao trocar de URL ou desmontar, para não acumular memória de GPU.

**Orientação da esfera** (`modes/vr/constants.ts`). `SphereGeometry(500, 60, 40)` com
`scale(-1, 1, 1)` (vista por dentro, sem espelhar) e `rotation.y = PANORAMA_ROTATION_Y =
-π/2`. A câmera começa em `[0, 0, 0.1]`, olhando para `-Z`, com `fov` 75. Resultado: o
**centro da imagem fica à frente** e a direita da imagem fica à direita. Calibrado no
plano 020 com o panorama de teste `e2e/fixtures/panorama-teste.jpg` (faixa vermelha no
centro aparece à frente; a azul, a +90°, aparece ao virar para a direita).

**Regra do `yaw`** (`modes/vr/geometry.ts`). `yawToPosition(yaw, raio, altura)` =
`[raio·sin(yaw), altura, −raio·cos(yaw)]`: 0° à frente, positivo à direita, ±180° atrás —
o mesmo significado do `yaw_degrees` das conexões (plano 019).
`facingCenterRotationY(yaw) = −yaw` (em radianos) vira um objeto nessa posição para o
centro. O plano 021 usa as duas para posicionar as setas. Se a orientação precisar de
ajuste, muda-se só `PANORAMA_ROTATION_Y`, nunca a fórmula do `yaw`.

**Olhar em volta.** Fora do VR, `OrbitControls` do drei sem zoom e sem *pan*, com
`rotateSpeed = -0.4`: arrastar "puxa" a paisagem, com mouse ou dedo, também para cima e
para baixo. Durante a sessão imersiva o `OrbitControls` sai de cena: a cabeça controla a
câmera.

**Entrar em VR.** `xrStore = createXRStore({ emulate: false })` em `scene/VrCanvas.tsx`, com
`<XR store={xrStore}>` dentro do `<Canvas>`. O botão chama `xrStore.enterVR()` e só aparece
quando `useImmersiveVrSupport()` é `true` (`navigator.xr.isSessionSupported('immersive-vr')`);
sem WebXR (Chrome do computador, celular, Playwright) a página funciona sem o botão.
`emulate: false` desliga o emulador de Quest que a biblioteca injeta em `localhost` por
padrão — com ele, o botão apareceria no computador sem WebXR de verdade.

**Painel 3D** (`scene/InfoPanel3D.tsx`). HTML não aparece dentro da sessão imersiva; nela, um
plano preto semitransparente de 1,6 × 0,7 m, a 2 m à frente e 0,3 m abaixo dos olhos, mostra
nome e resumo com o `Text` do drei. Só existe durante a sessão (`useXR((s) => s.session)`).

**Registro de visita.** `useRegisterVisit(slug, 'vr', textura carregada)`: a visita só conta
depois que o panorama apareceu.

**Cobertura.** `src/modes/vr/scene/**` fica fora da cobertura unitária (`vitest.config.ts`):
o jsdom não tem WebGL. Esses arquivos só montam a cena, sem contas nem decisões; toda
lógica está em `constants.ts`, `geometry.ts` e nos hooks, todos testados. A cena é coberta
pelo E2E `e2e/tests/vr-scene.spec.ts` (`@golden`, não imersivo) e pelo teste manual no
Quest.

## Registro de visita

`useRegisterVisit(slug, mode, ready)` (`src/core/hooks/useRegisterVisit.ts`) chama
`POST /api/public/points/{slug}/visits` com `{ "mode": "ar" }` na página do ponto e
`{ "mode": "vr" }` na cena 360°:

- uma vez por montagem da página, **depois** que o ponto carregou com sucesso (visita só
  conta se o visitante viu o conteúdo); 404 e erro não registram;
- um `useRef` guarda o último slug registrado, para o `StrictMode` do React não contar em
  dobro;
- recarregar a página conta outra visita (nada é guardado no aparelho: o visitante é
  anônimo);
- falha no registro é silenciosa para o visitante: só `console.warn`.

**Tipos.** `HealthStatus` está escrito à mão em `src/core/types/index.ts`, espelhando
[06-contrato-api.md](06-contrato-api.md), porque `GET /health/` não declara esquema de
resposta no OpenAPI. Os demais são aliases dos tipos gerados por `npm run gen:types`:
`PointSummary`, `PointDetail`, `MediaItem` e `VisitMode` (`'ar' | 'vr'`).

## Como o app chama a API

Sempre por caminho relativo: `/api/...` e `/media/...`. O *proxy* do Vite
(`vite.config.ts`, `server.proxy`) encaminha para `VITE_PROXY_TARGET` (padrão
`http://localhost:8000`; no Docker Compose, `http://backend:8000`) e remove o prefixo
`/api`. Assim `GET /api/health/` chega ao backend como `GET /health/`. Mesma origem: sem
CORS e sem conteúdo misto em HTTPS. O servidor escuta em todas as interfaces
(`server.host: true`), para que celular e Quest acessem pelo IP da máquina.

## Comandos

Dentro de `services/vr-app`:

| Comando | Faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento em `http://localhost:3001` |
| `npm run dev:https` | O mesmo em HTTPS, com certificado autoassinado (`@vitejs/plugin-basic-ssl`) |
| `npm run lint` | ESLint + `tsc --noEmit` |
| `npm run format` / `format:check` | Prettier: corrige / confere |
| `npm run test` / `test:coverage` | Vitest; com cobertura, falha abaixo de 80% |
| `npm run build` | `tsc --noEmit` + `vite build` |
| `npm run gen:types` | Regenera `src/core/types/api.d.ts` (backend no ar) |

Pelo Docker Compose, na raiz do orquestrador: `docker compose up -d --build` sobe o
serviço `vr-app` na porta 3001 junto com o resto.

## Testar no celular e no Quest

Câmera (leitura de QR) e WebXR só funcionam em HTTPS, ou em `localhost`; por isso, para
abrir o app em outro aparelho, é preciso o modo HTTPS.

1. Deixe o celular ou o Quest na **mesma rede Wi-Fi** do computador.
2. Descubra o IP do computador: `ipconfig` no Windows (linha "Endereço IPv4") ou
   `ip addr` no Linux.
3. No computador: `cd services/vr-app && npm run dev:https`. Isso roda fora do Docker; o
   certificado autoassinado é gerado na hora. O backend precisa estar no ar em
   `http://localhost:8000` (por exemplo, `docker compose up -d backend`).
4. No aparelho, abra `https://<IP>:3001` (no Quest, `https://<IP>:3001/vr/<slug>` no app
   **Navegador**). O navegador avisa que o certificado não é
   confiável. É esperado: toque em "Avançado" e depois em "Continuar mesmo assim".
5. Firewall do Windows: na primeira execução, permita o Node.js em **redes privadas**.

## Stack decidida (ADR-0006, 2026-08-20)

Um único app web, em dois modos sobre um núcleo compartilhado:

| Modo | Dispositivo | Stack |
|---|---|---|
| **AR presencial** | Celular | React + Vite + TypeScript · leitura de QR via `BarcodeDetector` com fallback `@zxing/browser` |
| **VR remoto** | Quest 3 | WebXR · React Three Fiber sobre Three.js (`@react-three/fiber`, `@react-three/xr`, `@react-three/drei`) |

O núcleo comum concentra cliente da API, tipos de domínio, constantes e componentes de
conteúdo — os dois modos renderizam o mesmo cadastro de ponto de interesse.

O conteúdo do visitante é **público**: o QR contém a URL `https://<host>/p/<slug>`, que
funciona em qualquer leitor de QR, mesmo sem o app instalado.

Justificativa completa e consequências na
[ADR-0006](08-decisoes-arquiteturais.md). Em resumo: o navegador do Quest 3 não expõe os
pixels da câmera ao JavaScript, o que inviabiliza leitura de QR no headset sem migrar para
Unity e C#; o celular resolve isso reaproveitando a competência que o grupo já tem.

## Estrutura prevista (planos 017 a 021)

```
services/vr-app/src/
├── core/                    compartilhado entre os dois modos
│   ├── api/                 cliente HTTP, endpoints de pontos e visitas
│   ├── types/               gerados do OpenAPI + tipos de domínio
│   ├── constants/           rotas, categorias, limites — documentados
│   ├── qr/                  leitura de QR, isolada e testável
│   ├── hooks/               usePonto, useRegistrarVisita
│   └── components/          ConteudoPonto, GaleriaMidia, CabecalhoPonto
├── modes/
│   ├── ar/                  ScannerQR, PaginaPonto, sobreposição
│   └── vr/                  CenaXR, Visualizador360, navegação
└── routes/
```

## Pendências

- **Teste do leitor no iPhone** (plano 018) — Chrome no Android já foi verificado; falta
  o Safari do iPhone (caminho do zxing), quando houver um aparelho na turma.

- **Modelo de domínio** (ADR-0007, Fase 1) — o app não tem o que consumir enquanto
  `PontoDeInteresse` não existir no backend. Ver
  [DT-016](implementacoes-futuras/DT-016-modelagem-dominio-turismo.md).
- **HTTPS para o modo VR** — ✅ resolvido no plano 016: `npm run dev:https` (ver "Testar no
  celular e no Quest").
- **Estratégia de mídia** (ADR-0008, Fase 4) — formato, storage e entrega do conteúdo 360°.

Sequência e desdobramento em
[`tasks/000-visao-macro-opcao-b.md`](tasks/000-visao-macro-opcao-b.md) — Fases 3 e 4.
