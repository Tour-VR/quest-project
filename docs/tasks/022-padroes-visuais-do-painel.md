# 022 — Padrões visuais e de movimento do painel

| | |
|---|---|
| **Status** | Em revisão — Heitor Aquino |
| **Fase** | 2 — Painel administrativo |
| **Depende de** | 011 |
| **Dívidas atendidas** | nenhuma |
| **ADRs relacionadas** | nenhuma |
| **Artefatos afetados** | Frontend |
| **Planejado em** | 2026-11-12 |
| **Validado em** | 2026-11-12 por Felipe Santos |
| **Executado em** | 2026-11-12 por Heitor Aquino (agente Claude Code) |

---

## 1. Objetivo

Dar ao painel um conjunto pequeno de padrões de tela e animação antes que os planos 012 a
015 criem suas telas. Hoje cada tela teria de inventar o próprio cabeçalho, tabela, menu
de ações e animação. A referência é um estudo de console administrativo maduro: o console
do Tailscale, analisado em 2026-11-12. **Copiamos só padrões de organização e movimento.
Cores, logotipo, textos e identidade visual da referência ficam de fora.**

## 2. Leia antes de começar

- `docs/04-artefato-frontend.md`
- `docs/07-convencoes.md`
- `docs/tasks/011-base-do-painel.md` (este plano estende o layout que ele criou)

## 3. Estado esperado ao iniciar

Verificado em 2026-11-12, no submódulo `services/frontend`, branch `main`:

- `src/index.css:1` — só `@import 'tailwindcss';`. Não há tokens de tema nem regras de
  animação.
- `src/layouts/AdminLayout.tsx:17-40` — barra lateral fixa de `w-64` e `<main>`. Não há
  comportamento para tela pequena.
- `src/layouts/SidebarNav.tsx:13-41` — lista plana de `NavLink`, vinda de
  `src/constants/navigation.ts`. Itens desabilitados mostram "em breve".
- `package.json` — React 19, Tailwind 4, `lucide-react`, `react-router-dom` 7. Nenhuma
  biblioteca de componentes acessíveis (diálogo, menu suspenso).
- Não existem os componentes `PageHeader`, `DataTable`, `RowActions` nem `StatusPulse`.

Se o plano 011 não estiver `Concluído`, **pare**: este plano depende do layout dele.

## 4. Escopo

**Dentro:**

1. Tokens de tema no `index.css`: sombras por papel, camadas (z-index) com nome, duração e
   curva de animação padrão.
2. Animações padrão: entrada e saída por escala (94%→100%) com fade, fade simples, gaveta
   deslizante, abertura e fechamento de seção, pulso e giro de carregamento.
3. Respeito a `prefers-reduced-motion`.
4. Barra lateral responsiva: abaixo de `md` (768px), vira gaveta com fundo escurecido,
   aberta por um botão de menu.
5. Componentes base em `src/components/ui/`: `PageHeader`, `Toolbar`, `DataTable`,
   `RowActions`, `Dialog`, `StatusPulse` e `Spinner`.
6. Testes unitários de cada componente novo e da gaveta.

**Fora:**

- Tema escuro: fica para depois, porque exige revisar todas as cores.
- Agrupar o menu em seções recolhíveis: hoje são poucos itens. A animação de seção fica
  pronta no CSS para quando o menu crescer.
- Aplicar os componentes às telas de 012 a 015. Cada plano usa os componentes ao construir
  as próprias telas.
- Bloco de "primeiros passos".
- Animações do app de VR (planos 020 e 021).

## 5. Decisões tomadas no planejamento

| Questão | Decisão | Motivo |
|---|---|---|
| Biblioteca para diálogo e menu | `@radix-ui/react-dialog` e `@radix-ui/react-dropdown-menu` | Dão foco, teclado, `Esc` e ARIA prontos. Expõem `data-state=open/closed`, que liga direto nas animações por CSS. A referência usa a mesma base. |
| Biblioteca de animação (framer-motion etc.) | Nenhuma: só CSS `@keyframes` | Os movimentos são simples, e CSS custa zero no bundle. |
| Duração e curva padrão | `--duration-fast: 120ms`, `--duration-base: 200ms`, `--ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1)` | São os valores medidos na referência. São curtos e não atrasam o uso. |
| Escala de entrada | de `scale(0.94)` + `opacity: 0` para `scale(1)` + `opacity: 1` | Valor medido na referência. |
| Camadas | `--z-popup: 10`, `--z-drawer-scrim: 20`, `--z-drawer: 30`, `--z-floating: 50`, `--z-toast: 60` | Evita números soltos de `z-index` espalhados pelo código. |
| Sombras | `--shadow-popover`, `--shadow-dialog`, `--shadow-tooltip`, `--shadow-button` | Cada tipo de componente tem a sua sombra, então ninguém precisa escolher na hora. |
| Onde declarar tokens | Bloco `@theme` do Tailwind 4 em `src/index.css` | Gera as classes utilitárias (`shadow-popover`, `ease-out-expo`) automaticamente. |
| Movimento reduzido | Em `@media (prefers-reduced-motion: reduce)`, duração das animações em `0.01ms`. Pulso e giro desligados. | Acessibilidade. |
| Ponto de quebra da gaveta | `md` (768px) | É o padrão do Tailwind e o tamanho de tablet. |
| Pasta dos componentes | `src/components/ui/` | Separa os blocos genéricos dos componentes de domínio (`dashboard/`, `login/`). |

## 6. Passos de implementação

Todos no submódulo `services/frontend`, branch `plano/022-padroes-visuais-do-painel`.

### Passo 1 — Dependências

```bash
npm install @radix-ui/react-dialog @radix-ui/react-dropdown-menu
```

**Verificação:** `npm run build` passa.

### Passo 2 — Tokens e animações

**Arquivo:** `src/index.css`

Acrescente, depois do `@import`:

```css
@theme {
  --shadow-popover: 0 0 0 1px #00000008, 0 15px 35px 0 #0000001a, 0 5px 15px 0 #00000014;
  --shadow-dialog: 0 10px 40px #0000001f, 0 0 16px #00000014;
  --shadow-tooltip: 0 0 0 1px #00000017, 0 2px 5px #0000000a;
  --shadow-button: 0 1px 1px #0000000a;
  --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
  --animate-scale-in: scale-in 120ms var(--ease-out-expo);
  --animate-scale-out: scale-out 120ms var(--ease-out-expo);
  --animate-fade-in: fade-in 200ms ease-out;
  --animate-fade-out: fade-out 200ms ease-in;
  --animate-drawer-in: drawer-in 200ms var(--ease-out-expo);
  --animate-drawer-out: drawer-out 200ms ease-in;
  --animate-pulse-ring: pulse-ring 1.8s ease-in-out 0.5s infinite both;
  /* @keyframes scale-in, scale-out, fade-in, fade-out, drawer-in, drawer-out, pulse-ring aqui */
}

:root {
  --z-popup: 10; --z-drawer-scrim: 20; --z-drawer: 30; --z-floating: 50; --z-toast: 60;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

Keyframes: `scale-in` (0.94 e opacidade 0 → 1 e 1), `scale-out` (o inverso), `fade-in`,
`fade-out`, `drawer-in` (`translateX(-100%)` → `0`), `drawer-out` (o inverso) e
`pulse-ring` (`scale(0.1)` com opacidade 0.5 → `scale(2.5)` com opacidade 0).

**Verificação:** `npm run build` passa, e a classe `animate-scale-in` aparece no CSS
gerado (`dist/assets/*.css`).

### Passo 3 — Componentes base

**Pasta:** `src/components/ui/` (cada arquivo com no máximo 200 linhas, regra do plano
004)

| Arquivo | Contrato |
|---|---|
| `PageHeader.tsx` | Props `title`, `description?`, `actions?: ReactNode`. Renderiza `<h1>`, a descrição em texto secundário e as ações alinhadas à direita. |
| `Toolbar.tsx` | Props `children`. Linha flexível com espaçamento, usada para busca, filtros e exportar. |
| `DataTable.tsx` | Genérico `<T>`. Props `columns: { key, header, render(row: T) }[]`, `rows: T[]`, `getRowId(row)`, `emptyMessage`. Usa `<table>` semântica, mostra `emptyMessage` quando `rows` está vazio e muda o fundo da linha no hover com `transition-colors`. |
| `RowActions.tsx` | Props `label` (para leitor de tela) e `actions: { label, onSelect, danger? }[]`. Botão "⋯" (`MoreHorizontal` do lucide) com `DropdownMenu` do Radix. O conteúdo usa `data-[state=open]:animate-scale-in data-[state=closed]:animate-scale-out shadow-popover`. |
| `Dialog.tsx` | Envolve o Radix Dialog. Props `open`, `onOpenChange`, `title`, `description?` e `children`. Fundo com `animate-fade-in/out` e conteúdo com `animate-scale-in/out shadow-dialog`. |
| `StatusPulse.tsx` | Prop `online: boolean`. Ponto verde com anel `animate-pulse-ring` quando online, ponto cinza sem animação quando offline. Texto acessível "online" ou "offline" em `sr-only`. |
| `Spinner.tsx` | Ícone `Loader2` com `animate-spin` e `aria-label="Carregando"`. Substitui o giro de `FullScreenLoader.tsx`, se ele tiver um próprio. |

### Passo 4 — Gaveta no layout

**Arquivos:** `src/layouts/AdminLayout.tsx`, novo `src/layouts/MobileTopBar.tsx`

- Em `md` ou maior, nada muda.
- Abaixo de `md`: a `<aside>` fica oculta, e a `MobileTopBar` mostra o nome "TourVR Admin"
  e um botão `Menu` (`aria-label="Abrir menu"`).
- O botão abre um Radix `Dialog`, que faz o papel de gaveta: fundo com `animate-fade-in`,
  painel à esquerda (`w-64`) com `animate-drawer-in/out`, contendo o mesmo `SidebarNav` e o
  botão Sair.
- Clicar num item do menu fecha a gaveta. Para isso, `SidebarNav` ganha a prop opcional
  `onNavigate?: () => void`, repassada ao `onClick` de cada `NavLink`.

**Verificação:** com a janela a 375px de largura, o menu abre, navega e fecha. `Esc` e o
clique no fundo também fecham a gaveta.

### Passo 5 — Vitrine no dashboard

**Arquivo:** a página de dashboard criada no plano 011

Troque o título atual por `PageHeader` (título "Dashboard"), para que pelo menos uma tela
use os componentes já neste plano. Não mexa nos cartões de métricas.

## 7. Testes

| Arquivo | Teste | Verifica |
|---|---|---|
| `src/components/ui/PageHeader.test.tsx` | renderiza título, descrição e ações | contrato de props |
| `src/components/ui/DataTable.test.tsx` | linhas e colunas; estado vazio | `emptyMessage` aparece com `rows=[]` |
| `src/components/ui/RowActions.test.tsx` | abre o menu e chama `onSelect` | menu acessível por clique e teclado |
| `src/components/ui/Dialog.test.tsx` | abre, fecha com `Esc` | foco e fechamento |
| `src/components/ui/StatusPulse.test.tsx` | texto "online" e "offline" | anel só quando online |
| `src/layouts/AdminLayout.test.tsx` | botão "Abrir menu" abre a gaveta; clicar em item fecha | gaveta |
| `src/layouts/SidebarNav.test.tsx` | `onNavigate` é chamado ao clicar | nova prop |

```bash
cd services/frontend && npm run lint && npm run test:coverage && npm run build
bash scripts/validate.sh
```

## 8. Documentação a atualizar

- [ ] `docs/04-artefato-frontend.md` — nova seção "Componentes base e movimento": a pasta
  `ui/`, a tabela de tokens, a regra "use `PageHeader` + `DataTable` + `RowActions` em
  telas de listagem" e o suporte a movimento reduzido.
- [ ] `docs/07-convencoes.md` — regra: não usar `z-index` numérico nem durações soltas,
  usar os tokens.
- [ ] `docs/tasks/README.md` — linha 022 no índice.

## 9. Critérios de aceite

- [ ] Menus e diálogos entram e saem com escala e fade de 120ms.
- [ ] Com "reduzir movimento" ligado no sistema, as animações não aparecem.
- [ ] A 375px de largura, o menu vira gaveta e funciona por toque, teclado e `Esc`.
- [ ] Os sete componentes de `ui/` existem, têm teste, e a cobertura fica em 80% ou mais.
- [ ] O dashboard usa `PageHeader`.
- [ ] Nenhuma cor, logotipo ou texto da referência foi copiado.
- [ ] `bash scripts/validate.sh` passa.
- [ ] Documentação atualizada no mesmo commit.

## 10. Commits esperados

- `services/frontend` — `feat(ui): tokens de movimento, componentes base e gaveta
  responsiva` (inclui os testes).
- Orquestrador — `docs: padrões visuais do painel (plano 022)` com os docs e o ponteiro
  do submódulo.

## 11. Riscos e pontos de atenção

- **Conflito com 012 a 015:** se algum deles já estiver em execução, as telas dele não
  usarão os componentes. Execute este plano antes do 012 ou ajuste o 012 depois.
- **jsdom e Radix:** o Radix usa `PointerEvent` e `ResizeObserver`, que o jsdom não tem
  completos. Se um teste falhar por isso, crie *stubs* mínimos em `src/test/setup.ts`. Não
  desative os testes.
- **E2E:** os testes `@golden` rodam em tela larga e não devem mudar. Se algum quebrar,
  pare e reporte.

## 12. Verificação pelo aluno

1. Rode o painel (`npm run dev`) e entre como admin.
2. No dashboard, o título aparece no novo cabeçalho.
3. Diminua a janela até ficar estreita, como um celular. Aparece um botão de menu no topo.
   Clique nele: o menu desliza da esquerda. Clique em um item: o menu fecha e a tela muda.
4. No Windows, ative Configurações › Acessibilidade › Efeitos visuais › "Efeitos de
   animação" desligado. Abra o menu de novo: ele aparece sem deslizar.

---

## Prompt de delegação

```text
Você é a sessão de EXECUÇÃO do projeto TourVR.
Execute o plano docs/tasks/022-padroes-visuais-do-painel.md.
Antes de qualquer ação, leia docs/tasks/protocolo-execucao.md e siga o "Prompt 1 — EXECUTAR" etapa por etapa.
Meu nome, para registrar no plano: <SEU NOME>
```

---

## Registro de execução

**2026-11-12 — Heitor Aquino (agente Claude Code).**

O que foi feito, no submódulo `services/frontend`, branch `plano/022-padroes-visuais-do-painel`:

- Passo 1: `@radix-ui/react-dialog` e `@radix-ui/react-dropdown-menu` instalados.
- Passo 2: tokens de sombra, curva, animações e camadas em `src/index.css`, mais a regra de
  `prefers-reduced-motion`.
- Passo 3: `PageHeader`, `Toolbar`, `DataTable`, `RowActions`, `Dialog`, `StatusPulse` e
  `Spinner` em `src/components/ui/`, cada um com teste.
- Passo 4: `AdminLayout` com barra lateral fixa a partir de `md` e `MobileTopBar` com gaveta
  abaixo disso. O conteúdo comum da barra foi extraído para `SidebarPanel.tsx`, e
  `SidebarNav` ganhou `onNavigate`.
- Passo 5: o dashboard usa `PageHeader` (título "Dashboard", saudação como descrição).
- Documentação: `docs/04-artefato-frontend.md` (seção "Componentes base e movimento") e
  `docs/07-convencoes.md` (regra de tokens).

**Desvios do plano:**

1. **A barra do celular e a barra lateral não ficam as duas na página.** O plano previa
   esconder uma delas só com CSS (`md:hidden`). Assim, o texto "TourVR Admin" e o menu
   apareceriam duas vezes no HTML. O E2E `@golden` (`e2e/tests/painel-base.spec.ts:12`) usa
   `getByText('TourVR Admin')`, que falha quando acha dois elementos. A solução foi o hook
   `src/hooks/useMediaQuery.ts`: o `AdminLayout` monta **ou** a barra lateral **ou** a
   `MobileTopBar`. Em tela larga, o HTML do layout fica como antes. Os testes simulam a tela
   estreita com `src/test/matchMedia.ts`, porque o jsdom não tem `matchMedia`.
2. **O `FullScreenLoader` continua sem `Spinner`.** O passo 3 só pedia a troca se ele já
   tivesse um ícone girando, e ele não tem.
3. **Os testes não precisaram de stubs para o Radix.** O risco previsto em 11 não aconteceu.

**Dívidas novas:** nenhuma.
