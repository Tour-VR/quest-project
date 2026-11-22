# 05 — Artefato: App do Visitante (`services/vr-app`)

> Repositório: `github.com/Tour-VR/vr-app` · Commit fixado: `4e6f85f` (atualizado no fechamento do plano 016)
> Última verificação contra o código: 2026-11-17

> **Nome impreciso.** O submódulo chama-se `vr-app`, mas passa a abrigar também o modo AR
> (celular), conforme a [ADR-0006](08-decisoes-arquiteturais.md). Renomear o repositório no
> GitHub é opcional e está registrado como pendência na visão macro.

## Status: 🟡 Em construção, fundação criada

O plano 016 criou o projeto: React 19 + Vite 6 + TypeScript (strict) + Tailwind 4 +
React Router 7 + Axios, com as mesmas regras de qualidade do painel (ESLint, Prettier,
Vitest com cobertura mínima de 80%). Hoje o app mostra só uma página inicial provisória
que confirma a conexão com a API. As telas do visitante chegam nos planos 017 a 021.

## Arquivos

```
services/vr-app/
├── index.html                 lang="pt-BR", título "TourVR"
├── package.json               "tourvr-visitor-app"; scripts na seção Comandos
├── vite.config.ts             proxy /api e /media; HTTPS só com --mode https
├── vite-env.d.ts              tipagem de import.meta.env (VITE_PROXY_TARGET)
├── vitest.config.ts           jsdom, cobertura v8 com limite de 80%
├── eslint.config.js           cópia do painel (strictTypeChecked, limites de tamanho)
├── .prettierrc, .prettierignore, tsconfig.json, .gitignore, .gitattributes
├── .env.example               VITE_PROXY_TARGET=http://localhost:8000
├── Dockerfile.dev, .dockerignore
├── .github/workflows/ci.yml   lint, formatação, testes com cobertura e build
├── scripts/gen-types.mjs      gera src/core/types/api.d.ts do OpenAPI do backend
└── src/
    ├── main.tsx               monta <App /> em #root
    ├── App.tsx                BrowserRouter + AppRoutes
    ├── index.css              @import 'tailwindcss'
    ├── core/                  núcleo compartilhado entre os modos AR e VR
    │   ├── api/client.ts      apiClient (Axios, baseURL '/api', timeout de 10 s)
    │   ├── api/health.ts      fetchApiHealth() → GET /health/
    │   ├── constants/http.ts  REQUEST_TIMEOUT_MS
    │   ├── constants/routes.ts ROUTES: /, /p/:slug, /scan, /vr, /vr/:slug
    │   ├── hooks/useApiHealth.ts  estado loading | ok | error
    │   └── types/             api.d.ts (gerado, versionado) e index.ts (aliases)
    ├── routes/
    │   ├── AppRoutes.tsx      "/" → HomePage; qualquer outra → NotFoundPage
    │   ├── HomePage.tsx       "TourVR", "Tour do campus" e o selo da API
    │   └── NotFoundPage.tsx   "Página não encontrada" com link para o início
    └── test/setup.ts          jest-dom no Vitest
```

As pastas `src/modes/ar` e `src/modes/vr` ainda não existem: nascem nos planos 017 e 020.

**Selo da API** (`src/routes/HomePage.tsx`): "Verificando…" (cinza) enquanto
`GET /api/health/` não responde; "API conectada" (verde) quando responde; "API
indisponível" (vermelho) quando falha. Responder já basta para o verde, mesmo que o banco
esteja fora do ar (`status: "degraded"`): o selo confirma o caminho navegador → *proxy* →
backend.

**Tipos.** `HealthStatus` está escrito à mão em `src/core/types/index.ts`, espelhando
[06-contrato-api.md](06-contrato-api.md), porque `GET /health/` não declara esquema de
resposta no OpenAPI. Os demais tipos virão de `npm run gen:types`.

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
4. No aparelho, abra `https://<IP>:3001`. O navegador avisa que o certificado não é
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

- **Modelo de domínio** (ADR-0007, Fase 1) — o app não tem o que consumir enquanto
  `PontoDeInteresse` não existir no backend. Ver
  [DT-016](implementacoes-futuras/DT-016-modelagem-dominio-turismo.md).
- **HTTPS para o modo VR** — ✅ resolvido no plano 016: `npm run dev:https` (ver "Testar no
  celular e no Quest").
- **Estratégia de mídia** (ADR-0008, Fase 4) — formato, storage e entrega do conteúdo 360°.

Sequência e desdobramento em
[`tasks/000-visao-macro-opcao-b.md`](tasks/000-visao-macro-opcao-b.md) — Fases 3 e 4.
