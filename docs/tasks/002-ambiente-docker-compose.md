# 002 — Ambiente Docker Compose

| | |
|---|---|
| **Status** | Validado |
| **Fase** | 0 — Fundação de qualidade |
| **Depende de** | 001 |
| **Dívidas atendidas** | DT-002, DT-005, DT-014 |
| **ADRs relacionadas** | ADR-0001 (submódulos) |
| **Artefatos afetados** | Orquestrador · Backend · Frontend |
| **Planejado em** | 2026-11-05 |
| **Validado em** | 2026-11-05 por Ciro Macedo |
| **Executado em** | — |

---

## 1. Objetivo

Subir o sistema inteiro (MongoDB, backend e painel) com um comando, igual em todas as
máquinas, com recarga automática ao editar código. Também corrige o `Dockerfile` do backend,
que hoje pode embutir o `.env` com segredos na imagem, e reduz os READMEs dos submódulos a
instruções curtas e corretas. Sem isso, cada aluno monta o ambiente de um jeito e os testes
ponta a ponta do plano 005 não têm onde rodar.

## 2. Leia antes de começar

- `docs/02-artefato-orquestrador.md`
- `docs/03-artefato-backend.md` (seções Configuração e Execução)
- `docs/04-artefato-frontend.md` (seções Configuração e Execução)
- `docs/implementacoes-futuras/DT-002-orquestracao-ambiente-local.md`
- `docs/implementacoes-futuras/DT-005-sincronizacao-documentacao-codigo.md`
- `docs/implementacoes-futuras/DT-014-containerizacao-completa.md`

## 3. Estado esperado ao iniciar

- Plano 001 concluído: `.gitignore` corrigido, `scripts/setup.sh` existe, submódulos em `main`.
- Não existe `docker-compose.yml` nem `.env.example` na raiz do orquestrador.
- `services/backend/Dockerfile:1-9` — `COPY . .` antes do `pip install`, roda como root, sem
  `HEALTHCHECK`; não existe `services/backend/.dockerignore`.
- `services/backend/app/core/config.py:16-17` — `mongodb_url` e `mongodb_db` lidos do
  ambiente (pydantic-settings, `case_sensitive=False`): `MONGODB_URL` no ambiente do
  container sobrescreve o padrão.
- `services/backend/app/api/v1/routes/health.py:10` — `GET /health/` responde mesmo com o
  banco fora (`status: degraded`).
- `services/frontend/package.json:7` — `dev` já usa `--port=3000 --host=0.0.0.0`.
- `services/frontend/src/services/api.ts:5` — base da API vem de `VITE_API_URL`.
- Não existe Dockerfile no frontend.
- `services/backend/README.md` (619 linhas) e `services/frontend/README.md` (524 linhas)
  citam scripts inexistentes (`install-backend.ps1`, `run-backend.ps1`).

## 4. Escopo

**Dentro:**

- `docker-compose.yml` e `.env.example` na raiz;
- scripts `scripts/up.sh`, `scripts/down.sh`, `scripts/logs.sh`, `scripts/reset-db.sh`;
- backend: `Dockerfile` reordenado, não-root, com `HEALTHCHECK`; `.dockerignore`;
- frontend: `Dockerfile.dev` e `.dockerignore`;
- READMEs curtos nos dois submódulos (DT-005);
- documentação do novo procedimento.

**Fora:**

- imagem de produção do frontend com Nginx (DT-014 item 5) — não há deploy previsto; fica
  registrada como pendência restante da DT-014;
- serviço `vr-app` no compose — plano 016;
- volume de mídia — plano 013;
- qualquer mudança de código Python ou TypeScript.

## 5. Decisões tomadas no planejamento

| Questão | Decisão | Motivo |
|---|---|---|
| Imagem do MongoDB | `mongo:7` | Versão estável; a mesma em todas as máquinas |
| Backend em desenvolvimento | Imagem do `Dockerfile`, com bind mount `./services/backend:/app` e `uvicorn --reload` no `command` do compose | Edição recarrega sem rebuild |
| Frontend em desenvolvimento | `Dockerfile.dev` (`node:22`), bind mount + volume nomeado em `/app/node_modules` | `node_modules` do Windows não funciona no Linux do container (DT-002, nota) |
| `.env` do compose | Um único `.env` na raiz; `MONGODB_URL` fixado no `environment` do compose | Um só arquivo para o aluno; a URL interna do Docker não é configurável por engano |
| Valor de `JWT_SECRET_KEY` no `.env.example` | Texto `troque-por-uma-chave-gerada` + comando para gerar | Segredo real nunca versionado |
| Banco | `MONGODB_DB=tourvr_db` | Nome do produto atual |
| `docker-compose.override.yml` | Não criar | Só existe ambiente de desenvolvimento |
| READMEs dos submódulos | Máximo 50 linhas, apontando para `docs/` do orquestrador | DT-005 |
| Scripts em PowerShell | Não criar | Git Bash é o shell do projeto (000 §6.1) |

## 6. Passos de implementação

### Passo 1 — `.dockerignore` e `Dockerfile` do backend

**Repositório:** `services/backend` (branch `plano/002-ambiente-docker-compose`)

**Arquivo novo:** `.dockerignore`

```
.venv/
venv/
.git/
__pycache__/
*.py[cod]
.pytest_cache/
.mypy_cache/
.ruff_cache/
.coverage
htmlcov/
tests/
*.md
.env
.env.*
!.env.example
```

**Arquivo:** `Dockerfile` — substituir por:

```dockerfile
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Dependencias primeiro: alterar codigo nao reinstala pacotes (cache de camadas).
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Usuario sem privilegios: o processo nao precisa de root.
RUN useradd --create-home --uid 1000 appuser && chown -R appuser /app
USER appuser

EXPOSE 8000

HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health/')" || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Verificação:** `docker build -t tourvr-backend-teste services/backend` termina sem erro;
`docker run --rm tourvr-backend-teste whoami` imprime `appuser`; com um `.env` falso na
pasta, `docker run --rm tourvr-backend-teste ls -a` **não** lista `.env`. Remova a imagem
de teste (`docker rmi tourvr-backend-teste`).

### Passo 2 — `Dockerfile.dev` e `.dockerignore` do frontend

**Repositório:** `services/frontend`

**Arquivo novo:** `.dockerignore` com `node_modules/`, `dist/`, `coverage/`, `.git/`,
`.env`, `.env.*`, `!.env.example`.

**Arquivo novo:** `Dockerfile.dev`

```dockerfile
FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]
```

### Passo 3 — `.env.example` da raiz

**Repositório:** orquestrador. **Arquivo novo:** `.env.example`

```dotenv
# Copie para .env (cp .env.example .env). O .env nunca e versionado.

# Backend
APP_ENV=development
APP_DEBUG=true
# Gere uma chave: python -c "import secrets; print(secrets.token_hex(32))"
JWT_SECRET_KEY=troque-por-uma-chave-gerada
MONGODB_DB=tourvr_db

# Painel administrativo (lido pelo navegador: use localhost, nao o nome do servico)
VITE_API_URL=http://localhost:8000
```

### Passo 4 — `docker-compose.yml`

**Arquivo novo:** `docker-compose.yml` (raiz)

```yaml
name: tourvr

services:
  mongo:
    image: mongo:7
    ports:
      - "27017:27017"
    volumes:
      - mongo-data:/data/db
    healthcheck:
      test: ["CMD", "mongosh", "--quiet", "--eval", "db.adminCommand('ping')"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build: ./services/backend
    command: uvicorn main:app --host 0.0.0.0 --port 8000 --reload
    env_file: .env
    environment:
      MONGODB_URL: mongodb://mongo:27017
      APP_CORS_ORIGINS: http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001
    ports:
      - "8000:8000"
    volumes:
      - ./services/backend:/app
    depends_on:
      mongo:
        condition: service_healthy

  frontend:
    build:
      context: ./services/frontend
      dockerfile: Dockerfile.dev
    command: sh -c "npm ci && npm run dev"
    env_file: .env
    ports:
      - "3000:3000"
    volumes:
      - ./services/frontend:/app
      - frontend-node-modules:/app/node_modules
    depends_on:
      backend:
        condition: service_healthy

volumes:
  mongo-data:
  frontend-node-modules:
```

Observações para o executor:

- O `HEALTHCHECK` vem do `Dockerfile` do backend; `condition: service_healthy` usa ele.
- `APP_CORS_ORIGINS` já inclui a porta `3001` do app do visitante (plano 016), para não
  precisar reabrir este arquivo depois.
- O Vite dentro do container precisa observar arquivos por *polling* no Windows. Se a
  recarga não funcionar no passo 6, acrescente `CHOKIDAR_USEPOLLING: "true"` ao
  `environment` do `frontend` (única alteração permitida fora do trecho acima).

### Passo 5 — Scripts de conveniência

**Arquivos novos** em `scripts/` (todos com `#!/usr/bin/env bash`, `set -euo pipefail`,
`cd "$(git rev-parse --show-toplevel)"`, mensagens `[INFO]/[OK]/[ERRO]` em português sem
acentos, e `git update-index --chmod=+x`):

| Script | Faz |
|---|---|
| `scripts/up.sh` | Se `.env` não existir, copia de `.env.example` e avisa para trocar a chave. Depois `docker compose up -d --build --wait` e imprime os endereços: painel `http://localhost:3000`, API `http://localhost:8000/docs` |
| `scripts/down.sh` | `docker compose down` (preserva os dados) |
| `scripts/logs.sh` | `docker compose logs -f "$@"` — aceita o nome de um serviço (`backend`, `frontend`, `mongo`) |
| `scripts/reset-db.sh` | Pergunta "Isto apaga TODOS os dados do banco local. Digite APAGAR para confirmar:"; só com `APAGAR` faz `docker compose down` e `docker volume rm tourvr_mongo-data` |

Se o Docker não estiver rodando (`docker info` falha), `up.sh` sai com
`[ERRO] Docker nao esta em execucao. Abra o Docker Desktop e tente de novo.`

### Passo 6 — Verificar o ambiente completo

1. `bash scripts/up.sh` — os três serviços ficam `healthy`/`running`
   (`docker compose ps`).
2. `curl -s http://localhost:8000/health/` → `"status":"ok"` e `"connected":true`.
3. Criar um usuário de teste via `curl -X POST http://localhost:8000/auth/register -H
   "Content-Type: application/json" -d '{"email":"teste@tourvr.dev","password":"abc12345"}'`
   e fazer login no painel em `http://localhost:3000`.
4. Editar um texto qualquer em `services/frontend/src/pages/Login.tsx`, ver o navegador
   recarregar, e **desfazer a edição** (`git checkout -- <arquivo>`).
5. `bash scripts/down.sh` e `bash scripts/up.sh` de novo: o usuário criado ainda consegue
   fazer login (dados persistiram).

### Passo 7 — READMEs curtos nos submódulos

**Repositórios:** `services/backend` e `services/frontend`. Substituir o `README.md` de cada
um por uma versão de no máximo 50 linhas, com estas seções:

1. Título e uma frase do papel do serviço;
2. **Stack** (uma linha);
3. **Como rodar** — via orquestrador: `bash scripts/up.sh` na raiz do `quest-project`;
   alternativa sem Docker com os comandos reais (`pip install -r requirements.txt` +
   `uvicorn main:app --reload --port 8000`; `npm ci` + `npm run dev`);
4. **Como testar** — backend `pytest -v`; frontend `npm run lint`;
5. **Documentação** — link para
   `https://github.com/Tour-VR/quest-project/tree/main/docs` e o documento do artefato
   (`03-artefato-backend.md` ou `04-artefato-frontend.md`).

Nenhum script inexistente citado. Antes de substituir, confira se algo correto e útil do
README antigo ainda não está em `docs/` (DT-005, Notas); se houver, leve para o documento
do artefato correspondente no orquestrador.

### Passo 8 — Documentação no orquestrador

- `README.md` (raiz), "Primeiros passos": depois do `bash scripts/setup.sh`, acrescentar
  `bash scripts/up.sh` e os endereços. Remover a nota sobre DT-002.
- `docs/02-artefato-orquestrador.md`: árvore com `docker-compose.yml`, `.env.example` e os
  scripts; nova seção **Ambiente local** (serviços, portas, volumes, comandos); tabela
  "Ausências": `docker-compose.yml` e scripts passam a existir.
- `docs/03-artefato-backend.md`, seção Execução: Docker como caminho principal; mencionar
  `.dockerignore`, usuário não-root e `HEALTHCHECK`.
- `docs/04-artefato-frontend.md`, seção Execução: idem, com `Dockerfile.dev`.
- `docs/03` e `docs/04`, seção "Nota sobre o README do submódulo": o README agora é curto
  e correto.

## 7. Testes

Este plano não altera código; a verificação é operacional.

| Comando | Resultado esperado |
|---|---|
| `docker compose config -q` | Sem erro |
| `bash scripts/up.sh` | Três serviços em execução, backend `healthy` |
| `curl -s localhost:8000/health/` | `"status":"ok"` |
| `docker compose exec backend whoami` | `appuser` |
| `docker compose exec backend ls -a /app` | Lista o código (bind mount); a **imagem** sem bind mount não contém `.env` (passo 1) |
| `cd services/backend && pytest -v` | 24 testes passando (nada quebrou) |
| `cd services/frontend && npm run lint` | Sem erros |
| `wc -l services/*/README.md` | Cada um com 50 linhas ou menos |

## 8. Documentação a atualizar

- [ ] `README.md` (raiz) — passo 8
- [ ] `docs/02-artefato-orquestrador.md` — passo 8
- [ ] `docs/03-artefato-backend.md` — passo 8
- [ ] `docs/04-artefato-frontend.md` — passo 8
- [ ] `docs/implementacoes-futuras/DT-002-...md` e `DT-005-...md` — `Resolvida` (plano 002)
- [ ] `docs/implementacoes-futuras/DT-014-...md` — `Parcialmente resolvida`: falta a imagem
      de produção do frontend
- [ ] `docs/implementacoes-futuras/README.md` — índice

## 9. Critérios de aceite

- [ ] `bash scripts/up.sh` em clone novo (após `setup.sh`) sobe MongoDB, backend e painel,
      e o login no painel funciona
- [ ] Editar código do backend ou do frontend recarrega sem rebuild
- [ ] Dados do MongoDB persistem entre `down.sh` e `up.sh`
- [ ] Imagem do backend sem `.env`, como usuário não-root, com `HEALTHCHECK`
- [ ] READMEs dos submódulos com até 50 linhas e sem citação de script inexistente
- [ ] Testes do backend e lint do frontend continuam passando
- [ ] Documentação da seção 8 atualizada

## 10. Commits esperados

`services/backend`, branch `plano/002-ambiente-docker-compose`:

```
build: adiciona .dockerignore e reordena o Dockerfile com usuario nao-root e healthcheck
docs: reduz o README a instrucoes operacionais e aponta para docs/
```

`services/frontend`:

```
build: adiciona Dockerfile.dev e .dockerignore
docs: reduz o README a instrucoes operacionais e aponta para docs/
```

Orquestrador:

```
build: adiciona docker-compose.yml e .env.example da raiz
feat(scripts): adiciona up, down, logs e reset-db
docs: documenta o ambiente local com Docker Compose
docs: marca DT-002 e DT-005 como resolvidas e DT-014 como parcial
```

## 11. Riscos e pontos de atenção

- **Docker Desktop no Windows** precisa do WSL 2 ativo. Se `docker info` falhar, pare e
  peça ao aluno para abrir o Docker Desktop (protocolo, "Quando parar").
- **Porta ocupada** (27017, 8000 ou 3000): um MongoDB ou backend local já rodando. Peça
  ao aluno para encerrá-lo; não troque as portas (000 §6.1).
- **Bind mount sobrescreve o usuário da imagem**: arquivos criados pelo container no
  `/app` pertencem ao uid 1000. Não é problema no Windows; no Linux é o mesmo uid do
  primeiro usuário.
- **`.env` antigo no backend** (`services/backend/.env`) pode existir na máquina do aluno.
  O `env_file` do compose e o `environment` têm precedência; não apague o arquivo dele.

## 12. Verificação pelo aluno

1. Abra o Docker Desktop e espere aparecer "Engine running".
2. No terminal do VS Code, na pasta `quest-project`, rode `bash scripts/up.sh`.
3. Abra `http://localhost:8000/docs` — aparece a documentação da API.
4. Abra `http://localhost:3000` — aparece a tela de login do painel.
5. No Docker Desktop, em "Containers", aparece o grupo `tourvr` com três itens verdes.
6. Rode `bash scripts/down.sh` — os três param.

---

## Prompt de delegação

Cole no Claude Code, na pasta `quest-project`, trocando o nome:

```text
Você é a sessão de EXECUÇÃO do projeto TourVR.
Execute o plano docs/tasks/002-ambiente-docker-compose.md.
Antes de qualquer ação, leia docs/tasks/protocolo-execucao.md e siga o "Prompt 1 — EXECUTAR" etapa por etapa.
Meu nome, para registrar no plano: <SEU NOME>
```
