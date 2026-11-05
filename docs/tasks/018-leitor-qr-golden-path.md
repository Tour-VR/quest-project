# 018 — Leitor de QR e golden path completo

| | |
|---|---|
| **Status** | Validado |
| **Fase** | 3 — App do visitante, modo AR |
| **Depende de** | 014, 017 |
| **Dívidas atendidas** | DT-016 (parcial) |
| **ADRs relacionadas** | ADR-0006 |
| **Artefatos afetados** | VR App · Orquestrador |
| **Planejado em** | 2026-11-05 |
| **Validado em** | 2026-11-05 por Ciro Macedo |
| **Executado em** | — |

---

## 1. Objetivo

Permitir que o visitante escaneie os QR Codes do campus **dentro** do app, em `/scan`, sem
sair para a câmera do celular, e fechar o golden path da Fase 3 de ponta a ponta. No
golden path, o administrador cria e publica um ponto no painel e vê o QR. O visitante abre
a URL do QR e lê o conteúdo, e a visita aparece nas métricas.

## 2. Leia antes de começar

- `docs/05-artefato-vr-app.md`: seção "Testar no celular e no Quest"
- `docs/tasks/014-qr-codes.md`: formato da URL gravada no QR
- `docs/tasks/017-pagina-do-ponto.md`: página `/p/:slug` e helpers de E2E

## 3. Estado esperado ao iniciar

- Plano 017 concluído: rota `/p/:slug`, `ROUTES` com `scan: '/scan'`, helpers de E2E
  `createPublishedPoint` e `getMetrics`.
- Plano 014 concluído: o painel tem `/qrcodes`. Cada cartão mostra o QR e a URL em texto,
  `${VITE_VISITOR_APP_URL}/p/<slug>`, com `VITE_VISITOR_APP_URL=http://localhost:3001` no
  compose.
- Planos 012 e 015 concluídos: o painel cria e publica pontos pela tela, e o dashboard
  mostra o total de visitas.

## 4. Escopo

**Dentro:**

- módulo `src/core/qr/` isolado e testável: interpretação da URL e adaptador de câmera;
- leitura com `BarcodeDetector` quando existir, e com `@zxing/browser` caso contrário;
- página `/scan` com permissão de câmera, mira, mensagens de erro e navegação ao ponto;
- botão "Escanear QR Code" na página inicial;
- E2E `@golden` completo, do painel ao visitante.

**Fora:**

- leitura de QR no Quest 3: impossível no navegador (ADR-0006). No Quest o visitante usa
  o modo VR (plano 020);
- leitura de QR a partir de imagem salva na galeria: não previsto;
- E2E com câmera real: o Playwright não tem câmera; a leitura é coberta por testes
  unitários com o adaptador simulado.

## 5. Decisões tomadas no planejamento

| Questão | Decisão | Motivo |
|---|---|---|
| Biblioteca | `BarcodeDetector` nativo (Chrome no Android); `@zxing/browser` como alternativa (Safari no iOS, Firefox, desktop) | `BarcodeDetector` não existe em vários navegadores |
| Carregamento do zxing | `import('@zxing/browser')` dinâmico, só quando o nativo não existir | Não pesar o bundle de quem tem o nativo |
| QR aceito | Qualquer URL cujo caminho seja `/p/<slug>`, com slug válido (regra do plano 009), **independentemente do domínio** | O IP/host muda entre computador, rede e servidor; o caminho é o que identifica o ponto |
| QR fora do padrão | Mensagem "Este QR Code não é de um ponto do tour." e a leitura continua | Visitante pode apontar para outro código por engano |
| Navegação | `navigate(ROUTES.point(slug))` dentro do app, não `window.location` | Mantém o app aberto e rápido |
| Câmera | `facingMode: 'environment'` (traseira), parar todas as *tracks* ao sair da página | Economia de bateria e privacidade |
| Sem HTTPS | Detectar `!window.isSecureContext` e explicar: "A câmera só funciona em endereço https." | Erro mais comum na rede local |
| Permissão negada | Mensagem com instrução de liberar a câmera nas configurações do navegador, e lembrete de que a câmera do celular também lê o QR | O QR contém URL: a alternativa sempre existe |

Versão: `@zxing/browser` `^0.1.5` (com `@zxing/library` instalado como dependência dela).
Antes de instalar, rode `npm view @zxing/browser peerDependencies` e confira a
compatibilidade. Se houver conflito, **pare**.

## 6. Passos de implementação

Passos 1 a 5 em `services/vr-app`, branch `plano/018-leitor-qr-golden-path`.

### Passo 1 — Interpretação da URL (função pura)

`src/core/qr/parseTourUrl.ts`:

```ts
const POINT_PATH = /^\/p\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/;

/** Devolve o slug do ponto se o texto lido for uma URL do tour; senão, null. */
export function parseTourUrl(text: string): string | null {
  let url: URL;
  try {
    url = new URL(text.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  const match = POINT_PATH.exec(url.pathname);
  return match?.[1] ?? null;
}
```

Os limites de tamanho do slug (3 a 60) ficam em `src/core/constants/points.ts`
(`SLUG_MIN_LENGTH`, `SLUG_MAX_LENGTH`) e são verificados depois do *match*.

### Passo 2 — Adaptador de leitura

`src/core/qr/types.ts`:

```ts
export interface QrScanner {
  /** Começa a ler do <video>; chama onResult a cada código detectado. */
  start(video: HTMLVideoElement, onResult: (text: string) => void): Promise<void>;
  stop(): void;
}
```

- `src/core/qr/nativeScanner.ts`: usa `new BarcodeDetector({ formats: ['qr_code'] })` e
  `detect(video)` em laço com `requestAnimationFrame`, limitado a uma leitura a cada
  `SCAN_INTERVAL_MS` (250 ms, em `src/core/constants/qr.ts`). Declare o tipo mínimo de
  `BarcodeDetector` em `src/core/qr/barcode-detector.d.ts` (não existe nos tipos do DOM do
  TypeScript 5.8).
- `src/core/qr/zxingScanner.ts`: `BrowserQRCodeReader` de `@zxing/browser`, com
  `decodeFromVideoElement`; `stop()` chama o `controls.stop()` devolvido.
- `src/core/qr/createQrScanner.ts`:

```ts
export async function createQrScanner(): Promise<QrScanner> {
  if ('BarcodeDetector' in window) return createNativeScanner();
  const { createZxingScanner } = await import('./zxingScanner');
  return createZxingScanner();
}
```

- `src/core/qr/camera.ts`: `openRearCamera(): Promise<MediaStream>` (getUserMedia com
  `facingMode: 'environment'`) e `stopStream(stream)`; `cameraErrorMessage(error)` traduz
  `NotAllowedError`, `NotFoundError`, `NotReadableError` e contexto inseguro em
  mensagens em português (tabela da seção 5).

### Passo 3 — Página `/scan`

`src/modes/ar/ScanPage.tsx` + hook `src/modes/ar/useQrScan.ts` (lógica fora do
componente, para respeitar `max-lines-per-function`):

1. Ao montar: se `!window.isSecureContext`, mostrar a mensagem de HTTPS e não abrir a
   câmera.
2. Abrir a câmera, ligar ao `<video playsInline muted autoPlay>`, criar o scanner.
3. A cada leitura: `parseTourUrl(text)`. Com slug, parar câmera e scanner e navegar para
   `ROUTES.point(slug)`. Sem slug, mostrar o aviso de QR inválido por 3 s (constante) e
   continuar.
4. Ao desmontar: `scanner.stop()` e `stopStream(stream)`, sempre.

Visual: vídeo ocupando a largura, moldura quadrada centralizada como mira, texto "Aponte
para o QR Code do local", botão "Voltar".

Na `HomePage`, acrescente o botão principal **Escanear QR Code** → `/scan`. Registre a
rota em `AppRoutes.tsx`.

### Passo 4 — Ajuste da câmera no `vite.config.ts`

Nenhum: o `dev:https` do plano 016 já fornece o contexto seguro. **Não** acrescente
cabeçalhos de permissão nem altere o *proxy*.

### Passo 5 — Testes unitários

| Arquivo | Teste | Verifica |
|---|---|---|
| `src/core/qr/parseTourUrl.test.ts` | tabela de casos | `https://10.0.0.5:3001/p/biblioteca-central` → `biblioteca-central`; `http://localhost:3001/p/bloco-a/` → `bloco-a`; `/p/` sem slug, `/x/abc`, `ftp://...`, texto solto, slug com maiúscula ou `--` → `null`; slug com 2 e com 61 caracteres → `null` |
| `src/core/qr/createQrScanner.test.ts` | com e sem nativo | com `window.BarcodeDetector` simulado → nativo; sem → zxing (módulo mockado) |
| `src/core/qr/camera.test.ts` | mensagens | cada nome de erro vira a mensagem certa; `stopStream` para todas as *tracks* |
| `src/modes/ar/useQrScan.test.tsx` | fluxo | leitura válida navega e para o scanner; inválida mostra aviso e continua; desmontar chama `stop` |
| `src/modes/ar/ScanPage.test.tsx` | contexto inseguro | com `isSecureContext=false`, mostra a mensagem de HTTPS e não chama `getUserMedia` |

`navigator.mediaDevices.getUserMedia` e o scanner são sempre simulados (`vi.fn`).

### Passo 6 — E2E completo (golden path da Fase 3)

No orquestrador, branch `plano/018-leitor-qr-golden-path`.

`e2e/tests/golden-path-campus.spec.ts`:

```ts
test('@golden admin publica o ponto, gera o QR e o visitante e contabilizado', async ({ page, browser }) => {
  const slug = `e2e-campus-${Date.now()}`;
  // 1. Painel: login de admin, criar ponto, publicar (pela interface do plano 012)
  // 2. Painel: /qrcodes mostra o cartão com o texto `${VISITOR_URL}/p/${slug}`
  // 3. Ler a URL exibida no cartão e checar com a mesma regra do app:
  //    o caminho termina em /p/<slug>
  // 4. Nova aba (visitante, sem login): abrir essa URL e ver o nome do ponto
  // 5. Painel: dashboard mostra o total de visitas incrementado
});
```

Escreva os passos com os seletores por papel/texto já usados nos testes do painel
(planos 012, 014 e 015). Não use seletores CSS frágeis. O teste usa a **URL exibida no
painel**, não uma URL montada no teste: assim ele prova que QR e app concordam.

## 7. Testes

```bash
cd services/vr-app && npm run lint && npm run format:check && npm run test:coverage && npm run build
cd ../.. && bash scripts/validate.sh
```

Teste manual obrigatório no celular (seção 12). Registre o resultado no PR: modelo do
aparelho, navegador, e qual leitor foi usado (nativo ou zxing). Para saber, deixe um
`console.info` em desenvolvimento.

## 8. Documentação a atualizar

- [ ] `docs/05-artefato-vr-app.md`: rota `/scan`, módulo `core/qr`, navegadores
      testados e qual leitor cada um usa
- [ ] `docs/00-visao-geral.md`: "Tour AR presencial: funcionando de ponta a ponta"
- [ ] `docs/tasks/000-visao-macro-opcao-b.md`: nada a mudar além do status (feito no
      fechamento)

## 9. Critérios de aceite

- [ ] Em `/scan`, no celular via HTTPS, apontar para um QR do painel abre a página do ponto
- [ ] QR de outro site mostra "Este QR Code não é de um ponto do tour." e a leitura continua
- [ ] Sem HTTPS, a página explica o motivo em vez de falhar sem mensagem
- [ ] Permissão negada mostra instrução clara
- [ ] A câmera desliga ao sair da página (luz indicadora do celular apaga)
- [ ] O zxing só é baixado quando o `BarcodeDetector` não existe (conferir na aba Rede)
- [ ] E2E `@golden` completo passando
- [ ] `bash scripts/validate.sh` passando
- [ ] Documentação da seção 8 atualizada

## 10. Commits esperados

`services/vr-app`:

```
feat(qr): adiciona interpretacao de url do tour com testes
feat(qr): adiciona leitores nativo e zxing com carregamento sob demanda
feat(ar): adiciona a pagina /scan com camera traseira
feat: adiciona o botao de escanear na pagina inicial
```

Orquestrador:

```
test(e2e): adiciona o golden path completo do painel ao visitante
docs: documenta o leitor de QR e os navegadores testados
```

## 11. Riscos e pontos de atenção

- **iPhone.** Safari exige `playsInline` no `<video>` e não tem `BarcodeDetector`; o
  fallback zxing é o caminho. Se não houver iPhone na turma, registre isso no PR.
- **Câmera que não desliga.** É o defeito mais comum: confira que todo caminho de saída
  (navegar, voltar, erro) chama `stopStream`.
- **QR impresso com `localhost`.** Um QR gerado com `VITE_VISITOR_APP_URL=http://localhost:3001`
  abre `localhost` no celular, que não é o computador. Para testar no celular, o painel
  precisa gerar com o IP da máquina e HTTPS: `VITE_VISITOR_APP_URL=https://<IP>:3001`.
  Explique isso ao aluno na verificação.
- **Lentidão do zxing** em aparelhos antigos: aceitável; não otimize fora do plano.

## 12. Verificação pelo aluno

1. Peça ao agente para: (a) mudar `VITE_VISITOR_APP_URL` do painel para
   `https://<IP-da-máquina>:3001` e reiniciar o painel; (b) rodar `npm run dev:https` no
   `vr-app`.
2. No painel, abra **QR Codes** e mostre o QR de um ponto publicado na tela do computador.
3. **No celular** (mesmo Wi-Fi): abra `https://<IP>:3001`, aceite o aviso de segurança,
   toque em **Escanear QR Code**, permita a câmera e aponte para a tela. A página do ponto
   deve abrir sozinha.
4. Aponte para o QR de qualquer produto ou site: aparece o aviso de QR inválido.
5. Volte à página inicial: a luz da câmera do celular apaga.
6. Faça o mesmo com a **câmera nativa** do celular, sem o app: o QR também abre a página.
7. No painel, o número de visitas aumentou.
8. Ao final, peça ao agente para voltar `VITE_VISITOR_APP_URL` ao valor padrão.

---

## Prompt de delegação

Cole no Claude Code, na pasta `quest-project`, trocando o nome:

```text
Você é a sessão de EXECUÇÃO do projeto TourVR.
Execute o plano docs/tasks/018-leitor-qr-golden-path.md.
Antes de qualquer ação, leia docs/tasks/protocolo-execucao.md e siga o "Prompt 1 — EXECUTAR" etapa por etapa.
Meu nome, para registrar no plano: <SEU NOME>
```
