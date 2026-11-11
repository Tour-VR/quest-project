# 006 — Integração contínua

| | |
|---|---|
| **Status** | Em execução — Heitor Aquino — 2026-11-11 |
| **Fase** | 0 — Fundação de qualidade |
| **Depende de** | 005 |
| **Dívidas atendidas** | DT-003 |
| **ADRs relacionadas** | nenhuma |
| **Artefatos afetados** | Orquestrador · Backend · Frontend |
| **Planejado em** | 2026-11-05 |
| **Validado em** | 2026-11-05 por Ciro Macedo |
| **Executado em** | — |

---

## 1. Objetivo

Fazer o GitHub rodar sozinho as mesmas verificações do `validate.sh` em todo Pull Request
e em todo push na `main`, nos três repositórios com código. O orientador passa a ver, no
próprio PR, se o trabalho do aluno passou em lint, tipagem, testes, cobertura, build e E2E
antes de revisar. Encerra a Fase 0.

## 2. Leia antes de começar

- `docs/02-artefato-orquestrador.md` (seção Validação, do plano 005)
- `docs/implementacoes-futuras/DT-003-pipeline-ci-cd.md`
- `docs/tasks/005-validacao-e-e2e.md` (o que cada etapa do `validate.sh` executa)

## 3. Estado esperado ao iniciar

- Plano 005 concluído: `bash scripts/validate.sh` passa localmente, inclusive E2E.
- Nenhum repositório tem `.github/workflows/` (DT-003, Evidência).
- `services/backend`: `requirements-dev.txt` e `pyproject.toml` (plano 003).
- `services/frontend`: scripts `lint`, `format:check`, `test:coverage`, `build` (plano 004).
- Os repositórios da organização `Tour-VR` são públicos (DT-017, Contexto): o checkout dos
  submódulos na CI não precisa de token extra.

## 4. Escopo

**Dentro:**

- `.github/workflows/ci.yml` em `services/backend`, `services/frontend` e no orquestrador;
- verificação, no orquestrador, de que cada ponteiro de submódulo pertence à `main` do
  respectivo repositório;
- verificação de links internos quebrados em `docs/` e `README.md`;
- selos (*badges*) de CI no `README.md` da raiz;
- instruções de proteção de branch para o orientador.

**Fora:**

- workflow do `vr-app` — criado no plano 016, no mesmo modelo do frontend;
- deploy automático;
- matriz de versões de Python ou Node;
- configurar a proteção de branch — **ação manual do orientador** (seção 6, passo 5); o
  agente não tem permissão de administrador e não deve tentar.

## 5. Decisões tomadas no planejamento

| Questão | Decisão | Motivo |
|---|---|---|
| Nome do arquivo e do job | `ci.yml`, job `validacao` em todos | O nome do job vira o nome do *status check* exigido na proteção de branch |
| Gatilhos | `push` na `main` e `pull_request` para a `main` | DT-003 |
| Sistema | `ubuntu-latest` | Tem Docker e é o padrão do GitHub |
| Versões | Python `3.11`, Node `22` | 000 §6.1 |
| Cache | `actions/setup-python` com `cache: pip`; `actions/setup-node` com `cache: npm` | Tempo abaixo de 3 minutos nos submódulos |
| Orquestrador | Roda `bash scripts/validate.sh` completo (com E2E) | Um único portão, igual ao local |
| PR de plano no orquestrador | A CI testa os submódulos nos ponteiros atuais da `main` | Os ponteiros só mudam no fechamento do plano (protocolo, Prompt 3); o código novo já foi testado na CI do submódulo |
| Verificação de ponteiros | `git merge-base --is-ancestor HEAD origin/main` em cada submódulo | Impede ponteiro para commit que não está na `main` |
| Links em `docs/` | `lycheeverse/lychee-action@v2` com `--offline` | Só links internos; não depende de sites externos |
| Concorrência | `concurrency` cancela execução anterior da mesma branch | Economiza minutos de CI |

## 6. Passos de implementação

### Passo 1 — Workflow do backend

**Repositório:** `services/backend`, branch `plano/006-integracao-continua`.
**Arquivo novo:** `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  validacao:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"
          cache: pip
          cache-dependency-path: requirements-dev.txt
      - run: pip install -r requirements-dev.txt
      - name: Lint
        run: ruff check .
      - name: Formatacao
        run: ruff format --check .
      - name: Tipagem
        run: mypy app
      - name: Testes e cobertura
        run: pytest --cov=app --cov-fail-under=80
```

### Passo 2 — Workflow do frontend

**Repositório:** `services/frontend`. **Arquivo novo:** `.github/workflows/ci.yml` — mesmo
cabeçalho (`name`, `on`, `concurrency`, job `validacao`), com os passos:

```yaml
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: npm
      - run: npm ci
      - name: Lint e tipagem
        run: npm run lint
      - name: Formatacao
        run: npm run format:check
      - name: Testes e cobertura
        run: npm run test:coverage
      - name: Build
        run: npm run build
```

### Passo 3 — Workflow do orquestrador

**Repositório:** orquestrador. **Arquivo novo:** `.github/workflows/ci.yml` — mesmo
cabeçalho, `timeout-minutes: 30`, com os passos:

```yaml
      - uses: actions/checkout@v4
        with:
          submodules: recursive
          fetch-depth: 0
      - name: Ponteiros dos submodulos pertencem a main
        run: |
          git submodule foreach --quiet '
            git fetch --quiet origin main
            if git merge-base --is-ancestor HEAD origin/main; then
              echo "[OK] $name"
            else
              echo "[ERRO] $name aponta para commit fora da main"; exit 1
            fi'
      - name: Links internos da documentacao
        uses: lycheeverse/lychee-action@v2
        with:
          args: --offline --no-progress 'docs/**/*.md' README.md
          fail: true
      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
      - name: Ambiente
        run: cp .env.example .env
      - name: Validacao completa
        run: bash scripts/validate.sh
        env:
          CI: "true"
      - name: Relatorio do Playwright
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: e2e/playwright-report
          retention-days: 7
```

Se o `lychee` acusar links quebrados que **já existem** em `docs/`, corrija-os neste plano
(é documentação do próprio orquestrador). Se o link quebrado aponta para um arquivo que um
plano futuro vai criar, troque o link por texto simples com o nome do arquivo.

### Passo 4 — Rodar a CI de verdade

1. Envie as branches e abra os PRs (Etapa 9 do protocolo).
2. Nos três PRs, a verificação `CI / validacao` precisa ficar verde. Acompanhe com
   `gh pr checks <número> --watch`.
3. Se falhar, leia o log (`gh run view --log-failed`) e corrija dentro do escopo.
4. Registre no PR o tempo de cada execução (`gh run list --limit 1`). Meta: abaixo de
   3 minutos no backend e no frontend.

### Passo 5 — Proteção de branch (ação do orientador)

**O agente não executa este passo.** Ele apenas o inclui, como lista, no corpo do PR do
orquestrador, e o aluno avisa o orientador no grupo.

Em cada um dos repositórios `Tour-VR/backend`, `Tour-VR/frontend`, `Tour-VR/quest-project`
(e, após o plano 016, `Tour-VR/vr-app`):

1. *Settings* → *Branches* → *Add branch protection rule* (ou *Rulesets* → *New ruleset*)
   para a branch `main`.
2. Marcar **Require a pull request before merging**.
3. Marcar **Require status checks to pass** e selecionar `validacao`.
4. Marcar **Require branches to be up to date before merging**.
5. **Não** bloquear pushes diretos de administradores no orquestrador, ou acrescentar uma
   exceção: os commits de reserva e fechamento de plano (protocolo, Etapa 3 e Prompt 3)
   vão direto para a `main`. Alternativa: permitir push direto aos membros da turma só
   no orquestrador.

### Passo 6 — Documentação

- `README.md` (raiz): selos de CI logo abaixo do título, um por repositório:
  `![CI backend](https://github.com/Tour-VR/backend/actions/workflows/ci.yml/badge.svg)`
  (idem frontend e quest-project).
- `docs/02-artefato-orquestrador.md`: nova seção **Integração contínua** (o que roda em
  cada repositório, nome do check, como ler um log com falha); tabela "Ausências": CI
  passa a existir.
- `docs/03-artefato-backend.md` e `docs/04-artefato-frontend.md`: uma linha na seção
  Testes apontando para o workflow.
- `docs/07-convencoes.md`, seção Branches: "PR só é mergeado com `CI / validacao` verde."
- `docs/tasks/protocolo-execucao.md`, Etapa 9: acrescentar o item "Espere `gh pr checks
  --watch` ficar verde antes do relatório ao aluno; se falhar, corrija." **Esta é a única
  alteração permitida no protocolo neste plano.**

## 7. Testes

| Onde | Verificação | Resultado esperado |
|---|---|---|
| PR no backend | `CI / validacao` | Verde, abaixo de 3 min |
| PR no frontend | `CI / validacao` | Verde, abaixo de 3 min |
| PR no orquestrador | `CI / validacao` | Verde (ponteiros, links, validate completo) |
| Prova de falha | Commit temporário com erro de lint num PR de teste | Check vermelho; depois reverter |

A prova de falha: no PR do frontend, faça um commit com uma variável não usada, confirme
o check vermelho, e reverta com `git revert HEAD` (não use `push --force`).

## 8. Documentação a atualizar

- [ ] `README.md` — selos
- [ ] `docs/02-artefato-orquestrador.md` — passo 6
- [ ] `docs/03-artefato-backend.md`, `docs/04-artefato-frontend.md` — passo 6
- [ ] `docs/07-convencoes.md` — passo 6
- [ ] `docs/tasks/protocolo-execucao.md` — passo 6 (somente o item indicado)
- [ ] `docs/implementacoes-futuras/DT-003-...md` — `Resolvida` (proteção de branch
      registrada como ação do orientador)
- [ ] `docs/implementacoes-futuras/README.md` — índice

## 9. Critérios de aceite

- [ ] Os três workflows rodam em PR e em push na `main`
- [ ] Check `validacao` verde nos três PRs deste plano
- [ ] Check vermelho comprovado com erro proposital (e revertido)
- [ ] Backend e frontend abaixo de 3 minutos
- [ ] Orquestrador reprova ponteiro fora da `main` e link interno quebrado
- [ ] Instruções de proteção de branch no corpo do PR do orquestrador
- [ ] Documentação atualizada

## 10. Commits esperados

`services/backend` e `services/frontend` (um em cada):

```
ci: adiciona workflow de validacao em pull requests
```

Orquestrador:

```
ci: adiciona workflow com ponteiros, links e validate.sh
docs: corrige links internos quebrados              (somente se necessario)
docs: documenta a integracao continua e adiciona selos
docs: marca DT-003 como resolvida
```

## 11. Riscos e pontos de atenção

- **E2E na CI mais lento que local**: build das imagens sem cache. `timeout-minutes: 30`
  cobre; se passar disso, pare e reporte.
- **`APP_DEBUG=true` do `.env.example` na CI**: aceitável, a pilha é descartável.
- **Primeiro PR com workflow novo**: o GitHub só mostra o check depois da primeira
  execução; a lista de checks na proteção de branch só aparece depois que o workflow rodou
  uma vez na `main` (após o merge). Isso afeta o passo 5, do orientador.
- **Minutos de CI**: repositórios públicos não consomem cota.

## 12. Verificação pelo aluno

1. Abra no navegador o PR do frontend. Na parte de baixo aparece "All checks have
   passed", com um ✓ verde ao lado de `CI / validacao`.
2. Clique em *Details* para ver os passos que o GitHub executou (Lint, Testes, Build).
3. Depois do merge, abra o `README.md` do `quest-project` no GitHub: aparecem os selos
   verdes "passing".
4. Avise o orientador no grupo que a proteção de branch (passo 5) está pronta para ser
   configurada.

---

## Prompt de delegação

Cole no Claude Code, na pasta `quest-project`, trocando o nome:

```text
Você é a sessão de EXECUÇÃO do projeto TourVR.
Execute o plano docs/tasks/006-integracao-continua.md.
Antes de qualquer ação, leia docs/tasks/protocolo-execucao.md e siga o "Prompt 1 — EXECUTAR" etapa por etapa.
Meu nome, para registrar no plano: <SEU NOME>
```
