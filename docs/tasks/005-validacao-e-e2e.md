# 005 — Validação única e primeiro E2E

| | |
|---|---|
| **Status** | Em revisão — Heitor Aquino |
| **Fase** | 0 — Fundação de qualidade |
| **Depende de** | 003, 004 |
| **Dívidas atendidas** | nenhuma (implementa o critério de verificação do plano 000 §7) |
| **ADRs relacionadas** | nenhuma |
| **Artefatos afetados** | Orquestrador |
| **Planejado em** | 2026-11-05 |
| **Validado em** | 2026-11-05 por Ciro Macedo |
| **Executado em** | 2026-11-11 por Heitor Aquino |

---

## 1. Objetivo

Criar o portão único de qualidade do projeto: `bash scripts/validate.sh` roda lint,
formatação, tipagem, testes com cobertura e build de todos os serviços, detecta duplicação
de código e executa os testes ponta a ponta (E2E) contra a pilha em Docker. Junto, o
primeiro cenário E2E de caminho principal (`@golden`): o administrador entra no painel. A
partir daqui, todo plano termina com esse comando passando.

## 2. Leia antes de começar

- `docs/02-artefato-orquestrador.md`
- `docs/tasks/000-visao-macro-opcao-b.md` §4, §6.1 e §7
- `docs/tasks/003-qualidade-backend.md` e `004-qualidade-frontend.md`, seções Testes (os
  comandos que o `validate.sh` vai chamar)

## 3. Estado esperado ao iniciar

- Plano 002 concluído: `docker-compose.yml`, `.env.example`, `scripts/up.sh` existem.
- Plano 003 concluído: em `services/backend`, `requirements-dev.txt` e `pyproject.toml`
  existem; passam `ruff check .`, `ruff format --check .`, `mypy app`,
  `pytest --cov=app --cov-fail-under=80`.
- Plano 004 concluído: em `services/frontend`, passam `npm run lint`,
  `npm run format:check`, `npm run test:coverage`, `npm run build`.
- `services/vr-app` ainda vazio (só `README.md` e `LICENSE`) — o plano 016 o preenche.
- `POST /auth/register` ainda aberto, sem exigir token
  (`services/backend/app/api/v1/routes/auth.py:15`). O plano 008 fecha essa rota.
- Tela de login: inputs de e-mail e senha com `<label>` associado (plano 004, passo 6) e
  botão "Entrar no Painel"; dashboard mostra "Bem-vindo(a) de volta, <nome>."
- Não existem `scripts/validate.sh`, `scripts/e2e.sh`, `e2e/` nem `.jscpd.json`.

## 4. Escopo

**Dentro:**

- `scripts/validate.sh` com a opção `--skip-e2e`;
- `scripts/e2e.sh`;
- pacote `e2e/` com Playwright, helpers de API e dois cenários de login;
- `.jscpd.json` na raiz;
- documentação de como validar.

**Fora:**

- CI — plano 006 (ele só chamará `validate.sh`);
- cenários E2E de domínio (pontos, QR, visitante) — planos 017, 018 e 021;
- qualquer mudança em `services/` (se um serviço reprovar, o plano anterior está
  incompleto: pare e reporte).

## 5. Decisões tomadas no planejamento

| Questão | Decisão | Motivo |
|---|---|---|
| Comportamento em falha | Roda todas as etapas, imprime um resumo e sai com 1 se alguma falhou | O aluno vê de uma vez tudo o que precisa corrigir |
| Ambiente Python | O script usa `services/backend/.venv`; se não existir, cria e instala `requirements-dev.txt` | Funciona igual no computador do aluno e na CI |
| `node_modules` | `npm ci` quando a pasta não existir | Idem |
| vr-app | Etapa pulada com aviso se `services/vr-app/package.json` não existir | Plano 016 ativa sozinho, sem editar o script |
| Duplicação | `npx --yes jscpd@4` com `.jscpd.json` (limite 3%, mínimo 50 tokens) sobre `services/backend/app`, `services/frontend/src` e `services/vr-app/src` (se existir) | 000 §6.1 |
| Ferramenta E2E | `@playwright/test`, só Chromium | Um navegador basta; instalação menor |
| Pilha do E2E | A mesma do `up.sh` (`docker compose up -d --build --wait`), que **continua rodando** ao final | Reexecutar fica rápido; `down.sh` para quando quiser |
| Dados de teste | Cada execução cria usuário com e-mail único (`e2e-<timestamp>@tourvr.dev`) | Não depende de limpar o banco |
| Criação do usuário de teste | Helper `createAdminUser()` em `e2e/support/api.ts`, hoje via `POST /auth/register` | O plano 008 troca a implementação pela linha de comando, sem mudar os testes |
| Tag | Título do teste começa com `@golden` nos caminhos principais | `--grep @golden` filtra |

## 6. Passos de implementação

Todos no orquestrador, branch `plano/005-validacao-e-e2e`.

### Passo 1 — Configuração de duplicação

**Arquivo novo:** `.jscpd.json`

```json
{
  "threshold": 3,
  "minTokens": 50,
  "reporters": ["console"],
  "ignore": ["**/*.test.ts", "**/*.test.tsx", "**/tests/**", "**/*.d.ts", "**/node_modules/**"],
  "absolute": false
}
```

### Passo 2 — Pacote de E2E

**Arquivo novo:** `e2e/package.json`

```json
{
  "name": "tourvr-e2e",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "playwright test",
    "test:golden": "playwright test --grep @golden"
  },
  "devDependencies": {
    "@playwright/test": "^1.56.0",
    "typescript": "~5.8.2"
  }
}
```

Rode `cd e2e && npm install` para gerar `e2e/package-lock.json` (versionado).

**Arquivo novo:** `e2e/playwright.config.ts`

```ts
import { defineConfig, devices } from '@playwright/test';
import { URLS } from './support/urls';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: URLS.painel, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
```

**Arquivo novo:** `e2e/support/urls.ts` — endereços usados por todos os testes (ficam
fora do `playwright.config.ts` porque testes não devem importar o arquivo de configuração):

```ts
export const URLS = {
  painel: 'http://localhost:3000',
  visitante: 'http://localhost:3001',
  api: 'http://localhost:8000',
} as const;
```

**Arquivo novo:** `e2e/tsconfig.json` mínimo (`strict: true`, `module: ESNext`,
`moduleResolution: bundler`, `noEmit: true`).

**Arquivo novo:** `e2e/support/api.ts`

```ts
import type { APIRequestContext } from '@playwright/test';
import { URLS } from './urls';

export interface TestUser { email: string; password: string; }

/** Cria um usuario de teste unico. O plano 008 troca a implementacao para a CLI. */
export async function createAdminUser(request: APIRequestContext): Promise<TestUser> {
  const user = { email: `e2e-${Date.now()}@tourvr.dev`, password: 'senhaE2E123' };
  const response = await request.post(`${URLS.api}/auth/register`, { data: user });
  if (!response.ok()) throw new Error(`Falha ao criar usuario: ${response.status()}`);
  return user;
}
```

**Arquivo novo:** `e2e/support/painel.ts` — função `loginNoPainel(page, user)` que abre
`/login`, preenche `getByLabel('Email')` e `getByLabel('Senha')` e clica em
`getByRole('button', { name: 'Entrar no Painel' })`.

**Arquivo novo:** `e2e/tests/login.spec.ts`

```ts
import { expect, test } from '@playwright/test';
import { createAdminUser } from '../support/api';
import { loginNoPainel } from '../support/painel';

test('@golden administrador entra no painel', async ({ page, request }) => {
  const user = await createAdminUser(request);
  await loginNoPainel(page, user);
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText(/Bem-vindo\(a\) de volta/)).toBeVisible();
});

test('credenciais invalidas mostram mensagem', async ({ page }) => {
  await loginNoPainel(page, { email: 'ninguem@tourvr.dev', password: 'errada123' });
  await expect(page.getByText('Credenciais invalidas.')).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});
```

### Passo 3 — `scripts/e2e.sh`

**Arquivo novo:** `scripts/e2e.sh` (`#!/usr/bin/env bash`, `set -euo pipefail`, `cd` para a
raiz, `git update-index --chmod=+x`). Comportamento:

1. Falha com mensagem clara se `docker info` falhar ("Abra o Docker Desktop").
2. Se `.env` não existir, copia de `.env.example`.
3. `docker compose up -d --build --wait`.
4. `cd e2e`; `npm ci` se não houver `node_modules`; `npx playwright install chromium`
   (na CI, com `--with-deps`: use `${CI:+--with-deps}`).
5. `npx playwright test "$@"` — repassa argumentos (ex.: `--grep @golden`).
6. Sai com o código do Playwright. Ao falhar, imprime: "Relatorio: cd e2e && npx
   playwright show-report".

### Passo 4 — `scripts/validate.sh`

**Arquivo novo:** `scripts/validate.sh`. Estrutura:

```bash
#!/usr/bin/env bash
# Portao unico de qualidade do TourVR. Uso: bash scripts/validate.sh [--skip-e2e]
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"

SKIP_E2E=false
[[ "${1:-}" == "--skip-e2e" ]] && SKIP_E2E=true

declare -a RESULTS=()
run_stage() {            # run_stage "<nome>" <funcao>
  local name="$1"; shift
  echo "==> [INFO] $name"
  if "$@"; then RESULTS+=("[OK]    $name"); else RESULTS+=("[FALHA] $name"); fi
}

python_bin() { command -v python3 || command -v python; }
venv_activate() {
  local venv="services/backend/.venv"
  if [[ ! -d "$venv" ]]; then
    "$(python_bin)" -m venv "$venv" && source_venv "$venv" \
      && pip install -q -r services/backend/requirements-dev.txt
  else
    source_venv "$venv"
  fi
}
source_venv() {          # Windows usa Scripts/, Linux e macOS usam bin/
  if [[ -f "$1/Scripts/activate" ]]; then source "$1/Scripts/activate"; else source "$1/bin/activate"; fi
}

stage_backend() (
  venv_activate && cd services/backend \
    && ruff check . && ruff format --check . && mypy app \
    && pytest --cov=app --cov-fail-under=80
)

stage_node() (           # stage_node <pasta>
  cd "$1" && { [[ -d node_modules ]] || npm ci; } \
    && npm run lint && npm run format:check && npm run test:coverage && npm run build
)

stage_duplication() {
  local paths=(services/backend/app services/frontend/src)
  [[ -d services/vr-app/src ]] && paths+=(services/vr-app/src)
  npx --yes jscpd@4 --config .jscpd.json "${paths[@]}"
}

run_stage "backend" stage_backend
run_stage "frontend" stage_node services/frontend
if [[ -f services/vr-app/package.json ]]; then
  run_stage "vr-app" stage_node services/vr-app
else
  RESULTS+=("[PULADO] vr-app (ainda nao iniciado)")
fi
run_stage "duplicacao" stage_duplication
if $SKIP_E2E; then RESULTS+=("[PULADO] e2e (--skip-e2e)"); else run_stage "e2e" bash scripts/e2e.sh; fi

echo; echo "===== Resumo ====="; printf '%s\n' "${RESULTS[@]}"
printf '%s\n' "${RESULTS[@]}" | grep -q '^\[FALHA\]' && exit 1
exit 0
```

O executor pode reorganizar o código para passar no `bash -n` e no `shellcheck` (se
instalado), mantendo as etapas, os nomes e o resumo.

### Passo 5 — Executar e conferir

1. `bash scripts/validate.sh --skip-e2e` → resumo com `[OK]` em backend, frontend e
   duplicação, `[PULADO]` em vr-app e e2e; código 0.
2. `bash scripts/validate.sh` → também `[OK] e2e`, com os 2 cenários passando.
3. Prova de que o portão reprova: acrescente temporariamente uma variável não usada em
   `services/frontend/src/App.tsx`, rode `bash scripts/validate.sh --skip-e2e`, confirme
   `[FALHA] frontend` e código 1, e **desfaça** com `git -C services/frontend checkout --
   src/App.tsx`.

### Passo 6 — Documentação

- `docs/02-artefato-orquestrador.md`: árvore com `e2e/`, `.jscpd.json`, `validate.sh`,
  `e2e.sh`; nova seção **Validação** (etapas, opção `--skip-e2e`, onde ver o relatório
  do Playwright).
- `README.md` (raiz): seção curta "Validar antes de abrir PR" com
  `bash scripts/validate.sh`.
- `docs/07-convencoes.md`: nova seção **Validação** — todo PR precisa de
  `validate.sh` passando; cenários `@golden` só são removidos com aprovação do orientador.
- `docs/09-glossario.md`: termos **E2E** e **golden path**, se ainda não estiverem.

## 7. Testes

| Arquivo | Teste | Verifica |
|---|---|---|
| `e2e/tests/login.spec.ts` | `@golden administrador entra no painel` | Usuário criado pela API faz login e vê o dashboard |
| | `credenciais invalidas mostram mensagem` | Mensagem do backend aparece e não há redirecionamento |

```bash
bash -n scripts/validate.sh scripts/e2e.sh
bash scripts/validate.sh --skip-e2e
bash scripts/validate.sh
bash scripts/e2e.sh --grep @golden
```

## 8. Documentação a atualizar

- [x] `docs/02-artefato-orquestrador.md` — passo 6
- [x] `README.md` — passo 6
- [x] `docs/07-convencoes.md` — passo 6
- [x] `docs/09-glossario.md` — passo 6

## 9. Critérios de aceite

- [x] `bash scripts/validate.sh` termina com código 0 numa máquina com Docker
- [x] `--skip-e2e` funciona sem Docker
- [x] O portão reprova quando um serviço quebra (passo 5.3)
- [x] vr-app ausente aparece como `[PULADO]`, não como falha
- [x] Os 2 cenários E2E passam; o primeiro tem a tag `@golden`
- [x] `e2e/package-lock.json` versionado; `e2e/node_modules`, `e2e/test-results` e
      `e2e/playwright-report` ignorados (já cobertos pelo `.gitignore` do plano 001)
- [x] Documentação atualizada

## 10. Commits esperados

Orquestrador:

```
build: adiciona configuracao do jscpd
test(e2e): adiciona pacote playwright e cenarios de login
feat(scripts): adiciona e2e.sh
feat(scripts): adiciona validate.sh como portao unico de qualidade
docs: documenta a validacao e os testes ponta a ponta
```

## 11. Riscos e pontos de atenção

- **Primeira execução é lenta** (build das imagens e download do Chromium): vários
  minutos. Avise o aluno.
- **Rótulo "Email"** no teste depende do `<label htmlFor>` do plano 004. Se o
  `getByLabel` não encontrar, confira o `IconInput` antes de mudar o teste — não use
  seletores CSS frágeis.
- **jscpd pode acusar duplicação real** entre testes ou componentes. Corrigir está fora
  do escopo deste plano: registre a dívida e, se o limite for estourado, pare e reporte.
- **`set -e` não é usado no `validate.sh` de propósito**: ele precisa continuar depois de
  uma etapa com falha para montar o resumo. As funções de etapa usam `&&` em cadeia.

## 12. Verificação pelo aluno

1. Abra o Docker Desktop. No terminal, na pasta `quest-project`, rode
   `bash scripts/validate.sh`. Espere — da primeira vez demora.
2. No fim aparece `===== Resumo =====` com `[OK]` em backend, frontend, duplicacao e e2e,
   e `[PULADO]` em vr-app.
3. Rode `cd e2e && npx playwright show-report`: abre no navegador um relatório com os 2
   testes em verde. Clique no primeiro para ver os passos que o robô fez no painel.

---

## Registro de execução

**Executado por** Heitor Aquino em 2026-11-11, com Claude Code, branch
`plano/005-validacao-e-e2e` (só o orquestrador).

**O que foi feito**

- `.jscpd.json`, pacote `e2e/` (Playwright 1.65, só Chromium) com `support/urls.ts`,
  `support/api.ts`, `support/painel.ts` e os 2 cenários de `tests/login.spec.ts`;
  `e2e/package-lock.json` versionado.
- `scripts/e2e.sh` e `scripts/validate.sh`, ambos com bit de execução no Git.
- Verificação (passo 5):
  - `bash scripts/validate.sh --skip-e2e` → `[OK]` backend (82% de cobertura, 25 testes),
    frontend (26 testes), duplicação (1,5%); `[PULADO]` vr-app e e2e; código 0.
  - `bash scripts/validate.sh` → também `[OK] e2e`, 2 cenários passando; código 0.
  - `bash scripts/e2e.sh --grep @golden` com a pilha parada → 1 cenário passando.
  - Variável não usada em `services/frontend/src/App.tsx` → `[FALHA] frontend` e código 1;
    arquivo restaurado com `git checkout`.
- Documentação: `docs/02-artefato-orquestrador.md` (árvore e seção Validação),
  `README.md`, `docs/07-convencoes.md`, `docs/09-glossario.md`.

**Desvios do plano**

1. `scripts/e2e.sh` espera até 180 s o painel responder em `http://localhost:3000` antes
   do Playwright. Com a pilha parada, o `--wait` voltava antes de o contêiner do painel
   terminar `npm ci && vite` (ele não tem healthcheck) e o cenário `@golden` falhava.
   Registrado como DT-019.
2. `python_bin()` no `validate.sh` testa se o interpretador executa (`--version`), em vez
   de só `command -v`. No Windows, `python3` costuma ser um atalho da Microsoft Store que
   existe mas não roda.
3. `@types/node` (^22) adicionado às dependências de `e2e/`: sem ele, o `tsconfig.json`
   estrito não reconhece `process.env.CI` em `playwright.config.ts`.

**Dívidas novas**

- [DT-018](../implementacoes-futuras/DT-018-duplicacao-backend.md) — dois clones no
  backend apontados pelo `jscpd` (2,49% das linhas Python, abaixo do limite de 3%).
- [DT-019](../implementacoes-futuras/DT-019-healthcheck-painel.md) — painel sem
  healthcheck no Docker Compose.

**Observação de ambiente.** Na máquina de execução, o PATH do Windows tinha uma entrada com
aspas soltas (`C:\Program Files (x86)\PowerShell\7"`), que impede o `cmd` de achar o
`node` e quebra `npx` e `npm run`. Não é problema do projeto; a validação foi feita com o
PATH corrigido apenas na sessão.

---

## Prompt de delegação

Cole no Claude Code, na pasta `quest-project`, trocando o nome:

```text
Você é a sessão de EXECUÇÃO do projeto TourVR.
Execute o plano docs/tasks/005-validacao-e-e2e.md.
Antes de qualquer ação, leia docs/tasks/protocolo-execucao.md e siga o "Prompt 1 — EXECUTAR" etapa por etapa.
Meu nome, para registrar no plano: <SEU NOME>
```
