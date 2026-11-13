# 014 — QR Codes imprimíveis

| | |
|---|---|
| **Status** | Em execução — Heitor Aquino — 2026-11-13 |
| **Fase** | 2 — Painel administrativo |
| **Depende de** | 012 |
| **Dívidas atendidas** | nenhuma |
| **ADRs relacionadas** | ADR-0006 (QR contém URL), ADR-0007 |
| **Artefatos afetados** | Frontend, Orquestrador (compose, docs, E2E) |
| **Planejado em** | 2026-11-05 |
| **Validado em** | 2026-11-05 por Ciro Macedo |
| **Executado em** | — |

---

## 1. Objetivo

Gerar, no painel, o QR Code de cada ponto publicado e uma folha A4 pronta para imprimir e
afixar no campus. O QR contém a URL pública do ponto (`<app do visitante>/p/<slug>`), que
funciona em qualquer leitor de QR, mesmo antes de o app do visitante ter leitor próprio.

## 2. Leia antes de começar

- `docs/04-artefato-frontend.md`
- `docs/08-decisoes-arquiteturais.md` — ADR-0006 (conteúdo do QR)
- `docs/tasks/000-visao-macro-opcao-b.md` — §6.1, "App do visitante"

## 3. Estado esperado ao iniciar

- **012** — `src/services/points.ts` com `listPoints(status)`, tipos `Point`,
  `STATUS_LABEL`, componentes `LoadingState`/`ErrorState`/`EmptyState`, item "Pontos" no
  menu (`src/constants/navigation.ts`).
- **011** — `AdminLayout`, `NAV_ITEMS`.
- **002** — `docker-compose.yml` com o serviço `frontend` e `.env.example` na raiz com
  `VITE_API_URL`.
- `services/frontend/.env.example:1-2` — apenas `VITE_API_URL`.
- O app do visitante pode ainda não existir (plano 016). Isso não bloqueia: a URL é só
  texto dentro do QR.

## 4. Escopo

**Dentro:**

- variável `VITE_VISITOR_APP_URL` (painel, compose, `.env.example`);
- utilitário que monta a URL do ponto;
- página `/qrcodes` com um cartão por ponto **publicado** (QR, nome, URL);
- folha de impressão A4 (CSS `@media print`), botão "Imprimir";
- download do QR em PNG por ponto;
- atalho "QR Code" na lista e no formulário de pontos publicados;
- item "QR Codes" no menu.

**Fora:**

- leitor de QR no app do visitante — plano 018;
- QR para pontos em rascunho — a URL daria 404 até a publicação;
- PDF gerado no servidor — a impressão do navegador ("Salvar como PDF") resolve;
- personalização visual (logo no centro do QR, cores) — reduz a legibilidade.

## 5. Decisões tomadas no planejamento

| Questão | Decisão | Motivo |
|---|---|---|
| Biblioteca | `qrcode` (+ `@types/qrcode` em dev), geração no navegador com `toDataURL` | Sem backend; madura; sem dependência nativa |
| Conteúdo | `${VITE_VISITOR_APP_URL sem barra final}/p/${slug}` | Contrato da ADR-0006 e §6.1 |
| Valor padrão | `http://localhost:3001` | Porta do app do visitante (§6.1) |
| Correção de erro | Nível `M` | Equilíbrio entre densidade e resistência a sujeira na placa |
| Tamanho | `width: 512` px no `toDataURL`; impresso a 6 cm × 6 cm | Legível a cerca de 1,5 m; pixel suficiente para impressão |
| Layout A4 | 2 colunas × 2 linhas = 4 cartões por página; `break-inside: avoid` | Cartão grande o bastante para uma placa |
| Cartão | Título "TourVR", nome do ponto, QR, instrução "Aponte a câmera do celular", URL em texto pequeno | Funciona mesmo para quem não conhece o projeto |
| Elementos ocultos na impressão | Menu lateral, cabeçalho da página, botões (`print:hidden` do Tailwind) | Folha limpa |
| Aviso de URL local | Se a URL começar com `http://localhost`, faixa amarela "Estes QR Codes apontam para este computador. Ajuste VITE_VISITOR_APP_URL antes de imprimir as placas definitivas." | Evita imprimir placa que não funciona no celular |
| Nome do PNG | `qr-<slug>.png` | Fácil de achar |

## 6. Passos de implementação

### Passo 1 — Variável de ambiente

**Repositório:** frontend, branch `plano/014-qr-codes`

- `.env.example`: acrescente
  ```
  # Endereco do app do visitante; vai dentro dos QR Codes.
  VITE_VISITOR_APP_URL=http://localhost:3001
  ```
- `src/vite-env.d.ts` (ou `vite-env.d.ts` na raiz, conforme o 004): declare
  `readonly VITE_VISITOR_APP_URL?: string` em `ImportMetaEnv`.

**Repositório:** orquestrador, branch `plano/014-qr-codes`

- `.env.example` da raiz: a mesma variável, com o comentário "Para testar no celular,
  troque localhost pelo IP desta máquina na rede (ex.: https://192.168.0.10:3001)".
- `docker-compose.yml`, serviço `frontend`: repasse `VITE_VISITOR_APP_URL:
  ${VITE_VISITOR_APP_URL:-http://localhost:3001}`.

### Passo 2 — Configuração e URL do ponto

**Arquivos novos:** `src/constants/qr.ts` e `src/utils/visitorUrl.ts`

```ts
// src/constants/qr.ts
export const DEFAULT_VISITOR_APP_URL = 'http://localhost:3001';
export const VISITOR_APP_URL =
  import.meta.env.VITE_VISITOR_APP_URL ?? DEFAULT_VISITOR_APP_URL;
export const QR_IMAGE_WIDTH = 512;
export const QR_ERROR_CORRECTION = 'M';
export const LOCALHOST_PREFIX = 'http://localhost';
```

```ts
// src/utils/visitorUrl.ts
export function visitorPointUrl(slug: string, base: string = VISITOR_APP_URL): string {
  return `${base.replace(/\/+$/, '')}/p/${encodeURIComponent(slug)}`;
}
```

### Passo 3 — Geração do QR

```bash
npm install qrcode
npm install -D @types/qrcode
```

**Arquivo novo:** `src/utils/qrCode.ts`

```ts
import QRCode from 'qrcode';

export function qrDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    width: QR_IMAGE_WIDTH,
    errorCorrectionLevel: QR_ERROR_CORRECTION,
    margin: 2,
  });
}
```

**Arquivo novo:** `src/hooks/useQrDataUrl.ts` — `useQrDataUrl(text)` → `{ dataUrl,
error }`, com flag de cancelamento no cleanup do `useEffect`.

### Passo 4 — Componentes

**Arquivos novos:** `src/pages/qrcodes/QrCard.tsx`, `src/pages/qrcodes/QrDownloadLink.tsx`,
`src/pages/qrcodes/LocalUrlWarning.tsx`

- `QrCard({ point })`: `<article>` com classes de cartão e `break-inside-avoid`; título
  "TourVR"; nome do ponto (`text-xl font-bold`); `<img src={dataUrl} alt="QR Code de
  <nome>" className="h-[6cm] w-[6cm]">`; "Aponte a câmera do celular"; URL em `text-xs`;
  `QrDownloadLink` com `print:hidden`.
- `QrDownloadLink`: `<a href={dataUrl} download={`qr-${slug}.png`}>Baixar PNG</a>`.
- `LocalUrlWarning`: faixa amarela (seção 5) só quando `VISITOR_APP_URL` começar com
  `LOCALHOST_PREFIX`; `print:hidden`.

### Passo 5 — Página

**Arquivo novo:** `src/pages/qrcodes/QrCodesPage.tsx`

- Busca `listPoints('published')`.
- Cabeçalho (`print:hidden`): "QR Codes dos pontos", texto "Um cartão por ponto
  publicado. Use Imprimir para gerar a folha A4.", botão "Imprimir"
  (`onClick={() => window.print()}`).
- Grade `grid grid-cols-1 md:grid-cols-2 print:grid-cols-2 gap-6`.
- Vazio: "Nenhum ponto publicado. Publique um ponto em Pontos para gerar o QR Code."
- Parâmetro opcional `?slug=<slug>`: mostra só aquele ponto (usado pelo atalho do passo 7).

### Passo 6 — CSS de impressão

**Arquivo:** `src/index.css` — acrescente:

```css
@page { size: A4; margin: 1.2cm; }
@media print {
  body { background: #fff; }
  .qr-sheet article { height: 12.5cm; }
}
```

E no `AdminLayout` (plano 011): barra lateral com `print:hidden`, `<main>` com
`print:p-0`. A grade da página usa a classe `qr-sheet`.

### Passo 7 — Rotas, menu e atalhos

- `src/App.tsx`: rota `/qrcodes` dentro do `AdminLayout`.
- `src/constants/navigation.ts`: item `{ label: 'QR Codes', to: '/qrcodes', icon: QrCode,
  enabled: true }`, depois de "Pontos".
- Lista de pontos (`PointRow`, plano 012) e formulário (`PointFormActions`): para ponto
  publicado, link "QR Code" para `/qrcodes?slug=<slug>`.

### Passo 8 — E2E

**Repositório:** orquestrador. **Arquivo novo:** `e2e/tests/qrcodes.spec.ts`

- `@golden QR Code do ponto publicado aponta para /p/<slug>` — cria e publica ponto pela
  API; abre `/qrcodes`; o cartão com o nome existe; o texto da URL termina em
  `/p/<slug>`; o `img` tem `src` começando com `data:image/png`.
- `rascunho não aparece` — cria ponto em rascunho; não aparece em `/qrcodes`.
- Decodificação real do QR: **não** testar no E2E (exigiria biblioteca de leitura);
  coberto pelo teste unitário do passo seguinte.

## 7. Testes

| Arquivo | Teste | Verifica |
|---|---|---|
| `src/utils/visitorUrl.test.ts` | barra final removida; slug codificado; base padrão | Contrato da URL |
| `src/utils/qrCode.test.ts` | `qrDataUrl` devolve `data:image/png;base64,...`; chama `QRCode.toDataURL` com `width` 512 e nível `M` (spy) | Parâmetros |
| `src/hooks/useQrDataUrl.test.ts` | resolve o data URL; erro vira `error` | Hook |
| `src/pages/qrcodes/QrCodesPage.test.tsx` | carregando; vazio; um cartão por ponto; `?slug=` filtra; "Imprimir" chama `window.print` | Página |
| `src/pages/qrcodes/LocalUrlWarning.test.tsx` | aparece com localhost; some com IP | Aviso |

Mock de `listPoints` e de `qrcode` (`vi.mock('qrcode')`) nos testes de página.

```bash
cd services/frontend && npm run lint && npm run format:check && npm run test:coverage && npm run build
cd ../.. && bash scripts/validate.sh
```

## 8. Documentação a atualizar

- [ ] `docs/04-artefato-frontend.md` — rota `/qrcodes`, variável `VITE_VISITOR_APP_URL`,
      dependência `qrcode`, como imprimir
- [ ] `docs/02-artefato-orquestrador.md` — variável no `.env.example` da raiz e como
      apontar para o IP da máquina
- [ ] `docs/00-visao-geral.md` — estado: "Geração de QR Codes ✅"
- [ ] `docs/09-glossario.md` — termo "QR Code do ponto" (URL `/p/<slug>`)

## 9. Critérios de aceite

- [ ] `/qrcodes` mostra um cartão por ponto publicado, e nenhum para rascunhos
- [ ] Cada QR, lido pela câmera de um celular, abre `<VITE_VISITOR_APP_URL>/p/<slug>`
      (conferência manual)
- [ ] "Imprimir" gera folha A4 com 4 cartões por página, sem menu nem botões
- [ ] "Baixar PNG" salva `qr-<slug>.png`
- [ ] Aviso amarelo quando a URL for `localhost`
- [ ] `bash scripts/validate.sh` passando com os 2 cenários E2E novos
- [ ] Documentação da seção 8 atualizada

## 10. Commits esperados

Frontend:

```
feat(qr): adiciona VITE_VISITOR_APP_URL e montagem da URL do ponto
feat(qr): gera QR Code dos pontos com a biblioteca qrcode
feat(qr): cria pagina de QR Codes com folha A4 imprimivel
feat(nav): adiciona QR Codes ao menu e atalhos nos pontos
```

Orquestrador:

```
build(compose): repassa VITE_VISITOR_APP_URL ao painel
test(e2e): cobre a pagina de QR Codes
docs: documenta a geracao e impressao de QR Codes
```

## 11. Riscos e pontos de atenção

- **Variável do Vite é lida na subida do servidor.** Alterou `VITE_VISITOR_APP_URL`,
  reinicie o serviço `frontend` (`docker compose restart frontend`).
- **Margens da impressão:** o navegador pode acrescentar cabeçalho e rodapé; instruir no
  documento a desmarcar "Cabeçalhos e rodapés" na janela de impressão.
- **`window.print` no Vitest** não existe no jsdom: use `vi.spyOn(window, 'print')
  .mockImplementation(() => {})`.

## 12. Verificação pelo aluno

1. `bash scripts/up.sh`, abra `http://localhost:3000` e entre como administrador.
2. Garanta que existe pelo menos um ponto publicado (plano 012).
3. Clique em "QR Codes" no menu. Aparece um cartão com o nome do ponto e o QR Code.
4. Abra a câmera do seu celular e aponte para o QR na tela. O celular mostra um endereço
   terminando em `/p/<identificador do ponto>`. (Ele ainda não abre nada útil se o app
   do visitante não existir — é esperado.)
5. Clique "Imprimir" e escolha "Salvar como PDF". O PDF tem só os cartões, sem menu.
6. Clique "Baixar PNG" em um cartão: um arquivo `qr-....png` é salvo.

---

## Prompt de delegação

Cole no Claude Code, na pasta `quest-project`, trocando o nome:

```text
Você é a sessão de EXECUÇÃO do projeto TourVR.
Execute o plano docs/tasks/014-qr-codes.md.
Antes de qualquer ação, leia docs/tasks/protocolo-execucao.md e siga o "Prompt 1 — EXECUTAR" etapa por etapa.
Meu nome, para registrar no plano: <SEU NOME>
```
