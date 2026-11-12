# 02 — Artefato: Repositório Orquestrador (`quest-project`)

> Repositório: `github.com/Tour-VR/quest-project` · Branch principal: `main`
> Última verificação contra o código: 2026-11-11

## Responsabilidade

Agregar os três submódulos, hospedar a base de conhecimento e centralizar a automação de
setup, build e execução do ambiente completo.

Agregação, documentação e execução do ambiente local já existem: `scripts/setup.sh`
prepara os submódulos, `scripts/up.sh` sobe o sistema inteiro com Docker Compose (ver
[Ambiente local](#ambiente-local)) e `scripts/validate.sh` é o portão único de qualidade
(ver [Validação](#validação)). Desde o plano 006, o GitHub roda essas verificações sozinho
em todo PR e push na `main` (ver [Integração contínua](#integração-contínua)).

## Conteúdo versionado

```
quest-project/
├── .gitmodules            declaração dos 3 submódulos (URLs HTTPS, branch main)
├── .gitignore             padrões globais
├── .gitattributes         força fim de linha LF nos scripts .sh
├── .github/workflows/ci.yml  integração contínua (job `validacao`)
├── LICENSE                MIT, "Copyright (c) 2026 Tour VR"
├── README.md              porta de entrada do projeto
├── CLAUDE.md              instruções de carga de contexto para agentes de IA
├── docker-compose.yml     ambiente local: mongo + backend + frontend
├── .env.example           variáveis do ambiente local (copiar para .env)
├── .jscpd.json            configuração da detecção de duplicação (limite 3%, 50 tokens)
├── docs/                  base de conhecimento (este diretório)
├── e2e/                   testes ponta a ponta com Playwright (pacote Node próprio)
│   ├── playwright.config.ts   só Chromium; baseURL = painel
│   ├── support/               urls.ts, api.ts (createAdminUser), painel.ts (loginNoPainel)
│   └── tests/                 login.spec.ts
├── scripts/
│   ├── setup.sh               (54 linhas) — preparação principal
│   ├── validate.sh            (91 linhas) — portão único de qualidade
│   ├── e2e.sh                 (52 linhas) — sobe a pilha e roda o Playwright
│   ├── up.sh                  (35 linhas) — sobe o ambiente local
│   ├── down.sh                (19 linhas) — para o ambiente, preserva os dados
│   ├── logs.sh                (19 linhas) — acompanha os logs
│   ├── reset-db.sh            (26 linhas) — apaga o banco local, com confirmação
│   ├── bash/ssh-setup.sh      (58 linhas) — alternativa SSH
│   └── posh/ssh-setup.ps1     (80 linhas) — alternativa SSH no PowerShell
└── services/
    ├── backend/    → submódulo
    ├── frontend/   → submódulo
    └── vr-app/     → submódulo
```

## Scripts de automação

### `scripts/setup.sh` — caminho principal

Prepara o repositório sem mexer no protocolo de acesso: usa o login HTTPS feito com
`gh auth login` + `gh auth setup-git`. Sequência (`scripts/setup.sh:18-54`):

1. vai para a raiz do repositório (`git rev-parse --show-toplevel`);
2. `git submodule sync --recursive`;
3. `git submodule update --init --recursive`;
4. `git submodule foreach 'git checkout main && git pull --ff-only origin main'`;
5. confere que cada submódulo está em `main`; se algum não estiver, sai com código 1;
6. termina com `[OK] Submodulos prontos: todos na branch main.`

Mensagens em português, sem acentos, no padrão `[INFO]`, `[OK]`, `[ERRO]`.

```bash
bash scripts/setup.sh
```

### `ssh-setup` — alternativa SSH

`scripts/bash/ssh-setup.sh` e `scripts/posh/ssh-setup.ps1` são para quem prefere acessar
o GitHub por SSH. Ambos executam a mesma sequência:

1. Testam a conexão com `ssh -T git@github.com` **antes de qualquer alteração**. Se a
   chave não funcionar, saem com código 1 sem mudar a configuração do Git
   (`ssh-setup.sh:29-38`). O GitHub responde ao `ssh -T` com código 1 e escreve a mensagem
   de sucesso no fluxo de erro; por isso o teste procura o texto `successfully
   authenticated` na saída redirecionada.
2. Configuram `git config --global url."git@github.com:".insteadOf "https://github.com/"`
   — faz o Git reescrever automaticamente URLs HTTPS para SSH, inclusive as dos submódulos;
3. Reescrevem a URL do `origin` local para SSH, se ainda estiver em HTTPS;
4. Preparam os submódulos: a versão Bash chama `scripts/setup.sh`; a versão PowerShell
   repete os mesmos comandos (sync, update, checkout de `main`) para não exigir Git Bash.

```bash
# Linux / macOS / Git Bash
bash scripts/bash/ssh-setup.sh
```

```powershell
# Windows PowerShell
.\scripts\posh\ssh-setup.ps1
```

**Pré-requisito:** chave SSH gerada e registrada na conta GitHub com acesso à
organização `Tour-VR`.

### Fim de linha

O `.gitattributes` força LF nos arquivos `.sh`. Sem isso, um Git no Windows com
`core.autocrlf=true` grava os scripts com CRLF e o Bash falha ao executá-los.

## Ambiente local

`docker-compose.yml` (projeto `tourvr`) descreve o ambiente de desenvolvimento. Só existe
este ambiente; não há `docker-compose.override.yml`.

| Serviço | Imagem | Porta | Detalhes |
|---|---|---|---|
| `mongo` | `mongo:7` | 27017 | Volume `mongo-data`; healthcheck com `mongosh` ping (`docker-compose.yml:4-14`) |
| `backend` | `services/backend/Dockerfile` | 8000 | Bind mount `./services/backend:/app` e `uvicorn --reload`; espera o `mongo` ficar saudável; usa o `HEALTHCHECK` da imagem (`docker-compose.yml:16-29`) |
| `frontend` | `services/frontend/Dockerfile.dev` | 3000 | Bind mount do código + volume `frontend-node-modules` em `/app/node_modules`; `npm ci && npm run dev`; espera o `backend` ficar saudável (`docker-compose.yml:31-46`) |

**Variáveis.** Um único `.env` na raiz, criado a partir do `.env.example`, é lido pelo
`backend` e pelo `frontend` (`env_file`). Duas variáveis são fixadas no próprio compose e
não dependem do `.env`: `MONGODB_URL=mongodb://mongo:27017` (endereço interno do Docker) e
`APP_CORS_ORIGINS`, que já inclui a porta 3001 do futuro app do visitante.
`VITE_API_URL` usa `localhost`, porque quem chama a API é o navegador, fora do Docker.

**Recarga automática.** Editar código em `services/backend` ou `services/frontend`
recarrega o serviço sem rebuild. No frontend, `CHOKIDAR_USEPOLLING=true` faz o Vite
perceber alterações vindas do Windows pelo bind mount.

**`node_modules` em volume nomeado.** Os pacotes instalados no Windows não funcionam no
Linux do container; por isso `/app/node_modules` fica num volume próprio. Uma pasta
`node_modules` vazia pode aparecer em `services/frontend` — é o ponto de montagem.

| Comando | Faz |
|---|---|
| `bash scripts/up.sh` | Sai com erro se o Docker não estiver rodando; cria `.env` se faltar; `docker compose up -d --build --wait`; mostra os endereços |
| `bash scripts/down.sh` | `docker compose down` — os volumes (dados) são preservados |
| `bash scripts/logs.sh [servico]` | `docker compose logs -f`, opcionalmente de um serviço |
| `bash scripts/reset-db.sh` | Pede que se digite `APAGAR`; então `docker compose down` e remove o volume `tourvr_mongo-data` |

Portas 27017, 8000 e 3000 precisam estar livres: um MongoDB ou backend rodando fora do
Docker impede a subida.

**Primeiro administrador.** O cadastro de usuários (`POST /auth/register`) exige um
administrador. Depois de subir o ambiente, crie o primeiro pela linha de comando, dentro
do container do backend:

```bash
docker compose exec backend python -m app.cli create-admin --email <email> --password <senha>
```

Se o e-mail já existe, o comando promove o usuário a administrador sem alterar a senha; a
senha nunca é impressa. Detalhes e códigos de saída em
[03-artefato-backend.md](03-artefato-backend.md#primeiro-administrador).

## Validação

`bash scripts/validate.sh` roda todas as verificações do projeto. Ele executa **todas** as
etapas mesmo que uma falhe, imprime um resumo e sai com código 1 se alguma falhou
(`scripts/validate.sh:73-91`).

| Etapa | O que roda | Observação |
|---|---|---|
| `backend` | `ruff check .`, `ruff format --check .`, `mypy app`, `pytest --cov=app --cov-fail-under=80` | Usa `services/backend/.venv`; se não existir, cria e instala `requirements-dev.txt` |
| `frontend` | `npm run lint`, `format:check`, `test:coverage`, `build` | `npm ci` se não houver `node_modules` |
| `vr-app` | O mesmo do frontend | `[PULADO]` enquanto `services/vr-app/package.json` não existir (plano 016) |
| `duplicacao` | `npx --yes jscpd@4 --config .jscpd.json` sobre `services/backend/app`, `services/frontend/src` e `services/vr-app/src` (se existir) | Reprova acima de 3% |
| `e2e` | `bash scripts/e2e.sh` | Exige Docker; `--skip-e2e` pula |

Resumo ao final:

```
===== Resumo =====
[OK]    backend
[OK]    frontend
[PULADO] vr-app (ainda nao iniciado)
[OK]    duplicacao
[OK]    e2e
```

**`--skip-e2e`.** `bash scripts/validate.sh --skip-e2e` não toca no Docker. Serve para
máquinas sem Docker; o PR deve registrar que o E2E não foi executado.

### Testes ponta a ponta (E2E)

`bash scripts/e2e.sh [argumentos do Playwright]` (`scripts/e2e.sh:17-52`):

1. sai com erro se o Docker não estiver rodando; cria o `.env` se faltar;
2. `docker compose up -d --build --wait` — a pilha **continua rodando** ao final
   (`bash scripts/down.sh` para);
3. espera até 180 s o painel responder em `http://localhost:3000`, porque o serviço
   `frontend` não tem healthcheck ([DT-019](implementacoes-futuras/DT-019-healthcheck-painel.md));
4. em `e2e/`: `npm ci` se faltar `node_modules`, `npx playwright install chromium`
   (na CI, com `--with-deps`);
5. `npx playwright test "$@"` e sai com o código do Playwright.

Os testes criam um administrador novo a cada execução (`e2e-<timestamp>@tourvr.dev`) pelo
helper `createAdminUser()` de `e2e/support/api.ts`, que roda
`docker compose exec -T backend python -m app.cli create-admin` com `execFileSync` (sem
`shell`), a partir da raiz do repositório. Por isso o E2E exige a pilha Docker no ar. Cenários de
caminho principal levam `@golden` no início do título; `bash scripts/e2e.sh --grep @golden`
roda só eles.

| Cenário (`e2e/tests/login.spec.ts`) | Verifica |
|---|---|
| `@golden administrador entra no painel` | Administrador criado pelo `create-admin` faz login e vê "Bem-vindo(a) de volta" no dashboard |
| `credenciais invalidas mostram mensagem` | Mensagem do backend aparece e a URL continua em `/login` |

**Relatório.** Ao falhar, o script indica `cd e2e && npx playwright show-report`, que abre
no navegador o relatório HTML com os passos e o *trace* de cada teste. Resultados ficam em
`e2e/test-results/` e `e2e/playwright-report/`, ignorados pelo `.gitignore`.

## Integração contínua

Os três repositórios com código têm `.github/workflows/ci.yml` (plano 006). Todos usam
`ubuntu-latest`, disparam em `push` na `main` e em `pull_request` para a `main`, e cancelam
a execução anterior da mesma branch (`concurrency`). O job se chama `validacao`; no PR o
*status check* aparece como **`CI / validacao`** — é ele que a proteção de branch exige.

| Repositório | O que roda | Limite |
|---|---|---|
| `Tour-VR/backend` | Python 3.11 com cache de `pip`; `pip install -r requirements-dev.txt`, `ruff check .`, `ruff format --check .`, `mypy app`, `pytest --cov=app --cov-fail-under=80` | 10 min |
| `Tour-VR/frontend` | Node 22 com cache de `npm`; `npm ci`, `npm run lint`, `format:check`, `test:coverage`, `build` | 10 min |
| `Tour-VR/quest-project` | Checkout com submódulos; ponteiros na `main`; links internos; `bash scripts/validate.sh` completo (com E2E) | 30 min |

**Orquestrador, passo a passo** (`.github/workflows/ci.yml`):

1. **Ponteiros dos submódulos pertencem a `main`** — em cada submódulo,
   `git merge-base --is-ancestor HEAD origin/main`. Reprova ponteiro para commit que não
   está na `main` do respectivo repositório.
2. **Links internos da documentação** — `lycheeverse/lychee-action@v2` com `--offline`
   sobre `docs/**/*.md` e `README.md`. Só confere links para arquivos do próprio
   repositório; não acessa sites externos.
3. **Validação completa** — copia `.env.example` para `.env` e roda `bash scripts/validate.sh`
   com `CI=true` (o Playwright instala o Chromium com `--with-deps`).
4. Se algo falhar, o relatório do Playwright (`e2e/playwright-report`) fica disponível por
   7 dias como *artifact* da execução.

Num PR de plano, a CI do orquestrador testa os submódulos nos ponteiros atuais da `main`:
os ponteiros só mudam no fechamento do plano (protocolo, Prompt 3), e o código novo já foi
testado na CI do próprio submódulo.

**Como ler uma falha.** No PR, clique em *Details* ao lado de `CI / validacao`; o passo com
✗ vermelho mostra o log. Pelo terminal:

```bash
gh pr checks <numero> --watch    # acompanha até terminar
gh run view --log-failed         # mostra só o log dos passos que falharam
```

**Proteção de branch.** Configurada manualmente pelo orientador em cada repositório
(*Settings* → *Branches*): PR obrigatório, check `validacao` obrigatório e branch
atualizada antes do merge. No orquestrador, os commits de reserva e fechamento de plano
continuam indo direto para a `main`.

## Configuração dos submódulos

O `.gitmodules` declara `path`, `url` (HTTPS) e `branch = main` para os três submódulos
(`.gitmodules:1-12`). Com a branch declarada, `git submodule update --remote` sabe de qual
branch buscar.

O `git submodule update` comum, porém, continua deixando cada submódulo em **detached
HEAD** no commit fixado. O `scripts/setup.sh` resolve isso fazendo `git checkout main` em
todos ao final. Quem rodar `git submodule update` por conta própria precisa repetir o
`setup.sh` ou fazer o checkout de `main` antes de editar dentro de `services/`. Procedimento
em [07-convencoes.md](07-convencoes.md#trabalhando-com-submódulos).

## `.gitignore`

O `.gitignore` da raiz ignora (`.gitignore:1-74`):

- segredos locais: `.env` e `.env.*`, exceto `.env.example`;
- artefatos Python (`__pycache__/`, `*.py[cod]`, caches de ferramentas, `.venv/`) e Node
  (`node_modules/`, `dist/`, `build/`, `coverage/`);
- resultados dos testes ponta a ponta (`e2e/test-results/`, `e2e/playwright-report/`);
- logs, temporários e arquivos de editor/sistema (`*.log`, `*.tmp`, `.vscode/`, `.DS_Store`);
- exportações (`*.zip`, `*.apk`) e a configuração local de agentes de IA
  (`.claude/settings.local.json`).

## Histórico

8 commits, entre 2026-03-24 e 2026-03-29. Contribuintes: João Lucas, joãoaura, hzera556,
Felipe, lorenz.

## Ausências

| Item | Situação |
|---|---|
| `docker-compose.yml` e scripts `up`/`down`/`logs`/`reset-db` | ✅ Existem desde o plano 002 — ver [Ambiente local](#ambiente-local) |
| Script único de testes/validação | ✅ `scripts/validate.sh` desde o plano 005 — ver [Validação](#validação) |
| CI (`.github/workflows/ci.yml`) | ✅ Existe desde o plano 006 — ver [Integração contínua](#integração-contínua) |
| Deploy automático (CD) | 🔴 Não existe |
| Versionamento/release do conjunto | 🔴 Não definido |
