# 023 — Implantação em produção (VM única)

| | |
|---|---|
| **Status** | Em revisão — Ciro Macedo |
| **Fase** | 5 — Produção |
| **Depende de** | 019 |
| **Dívidas atendidas** | DT-014 (conclusão: imagem de produção do frontend) |
| **ADRs relacionadas** | ADR-0010 (registrada por este plano) · ADR-0006 · ADR-0008 |
| **Artefatos afetados** | Orquestrador |
| **Planejado em** | 2026-11-26 |
| **Validado em** | 2026-11-26 por Ciro Macedo |
| **Executado em** | 2026-11-26 pelo agente na sessão do orientador — PR: [Tour-VR/quest-project#23](https://github.com/Tour-VR/quest-project/pull/23) |

---

## 1. Objetivo

Colocar a primeira versão do TourVR no ar numa VM com IP público: backend, banco, painel e
app do visitante, com HTTPS. HTTPS é obrigatório porque a câmera do celular (leitor de QR) e
o WebXR do Quest só funcionam em contexto seguro, e uma página HTTPS não pode chamar uma API
HTTP.

O plano tem duas partes:

- **Parte A — artefatos de produção** (este plano, executado por aluno com agente, pelo
  protocolo): `deploy/`, script de implantação e documentação. Testada localmente.
- **Parte B — implantação na VM** (executada pelo orientador, que tem o acesso de root),
  seguindo o roteiro `docs/11-implantacao.md` criado na Parte A.

## 2. Leia antes de começar

- `docs/02-artefato-orquestrador.md` — compose e scripts atuais
- `docs/03-artefato-backend.md` — configuração (`APP_ENV`, `JWT_SECRET_KEY`, `MEDIA_DIR`)
- `docs/05-artefato-vr-app.md` — chamadas relativas `/api` e `/media`
- `docs/08-decisoes-arquiteturais.md` — ADR-0006 e ADR-0008
- `docs/implementacoes-futuras/DT-014-containerizacao-completa.md`

## 3. Estado esperado ao iniciar

Verificado no planejamento (2026-11-26):

- `docker-compose.yml` é **só de desenvolvimento**: publica o Mongo em `27017` sem senha
  (`docker-compose.yml:6-7`), roda o backend com `--reload` e código montado
  (`:18`, `:26`), painel e app do visitante com servidor de desenvolvimento do Vite.
- `services/backend/Dockerfile` já é adequado para produção: usuário não-root, `HEALTHCHECK`
  em `/health/`, sem `--reload`, `/app/media` pertencente a `appuser`.
- `services/backend/app/core/config.py`: `ensure_secure_settings` recusa subir com a chave
  JWT padrão quando `APP_ENV != "development"`; `app_debug` padrão `False`;
  `APP_CORS_ORIGINS` separado por vírgula.
- O limitador de login usa `request.client.host` (`app/api/v1/routes/auth.py:57`). Atrás de
  um proxy, sem `--proxy-headers`, todos os acessos teriam o IP do proxy.
- Painel: lê `VITE_API_URL` e `VITE_VISITOR_APP_URL` em tempo de **build**
  (`src/services/api.ts:5`, `src/constants/qr.ts:4`); `npm run build` gera `dist/`.
- App do visitante: chama a API por caminho relativo `/api/...` e `/media/...`; em
  desenvolvimento o proxy está em `vite.config.ts`. `npm run build` gera `dist/`.
- Não existe pasta `deploy/` nem imagem de produção para painel e app do visitante.

**VM de destino** (inspecionada em 2026-11-26): Ubuntu 24.04, 1 vCPU, 2 GB de RAM, sem swap,
26 GB livres, CPU com AVX (exigido pelo `mongo:7`), sem Docker, firewall `ufw` inativo,
nenhum serviço além de SSH. IP público `201.79.39.177`, sem domínio próprio.

## 4. Escopo

**Dentro:**

- `deploy/docker-compose.prod.yml`, `deploy/Caddyfile`, `deploy/web.Dockerfile`,
  `deploy/.env.prod.example`;
- `scripts/deploy.sh` (sobe ou atualiza a pilha de produção);
- teste local da pilha de produção;
- `docs/11-implantacao.md` (roteiro da Parte B), ADR-0010 e atualização dos documentos.

**Fora:**

- alterar código do backend, painel ou app do visitante — nenhum submódulo muda;
- domínio próprio — usa `sslip.io`; trocar depois é mudar uma variável;
- backup automático do MongoDB e da mídia — registrar como dívida (passo 7);
- deploy automático pela CI — implantação manual por `scripts/deploy.sh`;
- monitoramento e alertas;
- desligar `/docs` em produção — mantido para verificação pelo orientador.

## 5. Decisões tomadas no planejamento

| Questão | Decisão | Motivo |
|---|---|---|
| Topologia | Uma VM, Docker Compose com 3 serviços: `mongo`, `backend`, `web` (Caddy) | Volume de acesso de projeto acadêmico; mesma ferramenta que os alunos já usam |
| HTTPS | Caddy com certificado automático (Let's Encrypt) | Zero configuração de certificado; renovação automática |
| Nomes sem domínio | `sslip.io`: `api.`, `painel.` e `tour.` + `201-79-39-177.sslip.io`, via variável `TOURVR_DOMAIN` | Resolve para o IP sem registrar domínio; Let's Encrypt aceita |
| Painel e app do visitante | Build estático dentro de `deploy/web.Dockerfile` (multi-stage) e servido pelo próprio Caddy | Um container a menos; sem Nginx |
| `/api` e `/media` do app do visitante | Caddy em `tour.` encaminha `/api/*` (removendo o prefixo) e `/media/*` ao backend | Mesmo contrato do proxy do Vite; mesma origem, sem CORS |
| Painel → API | `VITE_API_URL=https://api.<domínio>`; CORS do backend libera só `https://painel.<domínio>` | Origens explícitas |
| QR Codes | `VITE_VISITOR_APP_URL=https://tour.<domínio>` | QR impresso aponta para produção |
| MongoDB | `mongo:7` **sem porta publicada**, com usuário root por variável, `--wiredTigerCacheSizeGB 0.25` | Banco inacessível de fora; cabe em 2 GB de RAM |
| IP real do cliente | `uvicorn --proxy-headers --forwarded-allow-ips=*` | Limitador de login por IP correto; backend só é alcançável pela rede interna |
| Onde compilar | Na própria VM, com swap de 2 GB | Sem registro de imagens; o build do app VR precisa de mais que 2 GB de RAM |
| Reinício | `restart: unless-stopped` em todos os serviços | Volta sozinho após reboot da VM |
| Logs | Driver `json-file` com `max-size: 10m`, `max-file: 3` | Disco não enche |
| Segredos | `deploy/.env.prod` na VM, nunca versionado; gerados com `openssl rand -hex 32` | Regra de segurança 1 e 2 de `07-convencoes.md` |

## 6. Passos de implementação

Tudo no orquestrador, branch `plano/023-implantacao-em-producao`. Nenhum submódulo é
alterado.

### Passo 1 — Variáveis de produção

**Arquivo novo:** `deploy/.env.prod.example`

```bash
# Copie para deploy/.env.prod NA VM. Nunca versione o .env.prod.
# Dominio base: api., painel. e tour. sao prefixados a ele.
TOURVR_DOMAIN=201-79-39-177.sslip.io

# Gere cada segredo com: openssl rand -hex 32
JWT_SECRET_KEY=troque
MONGO_ROOT_USER=tourvr
MONGO_ROOT_PASSWORD=troque
MONGODB_DB=tourvr_db
LOG_LEVEL=INFO
```

Acrescente ao `.gitignore` da raiz a linha `deploy/.env.prod` (o padrão `.env.*` não cobre
esse nome).

### Passo 2 — Imagem web (painel + app do visitante + Caddy)

**Arquivo novo:** `deploy/web.Dockerfile` (contexto de build = raiz do orquestrador)

```dockerfile
# Estagio 1: painel administrativo
FROM node:22-alpine AS painel
WORKDIR /app
COPY services/frontend/package.json services/frontend/package-lock.json ./
RUN npm ci
COPY services/frontend/ ./
ARG VITE_API_URL
ARG VITE_VISITOR_APP_URL
RUN npm run build

# Estagio 2: app do visitante
FROM node:22-alpine AS tour
WORKDIR /app
COPY services/vr-app/package.json services/vr-app/package-lock.json ./
RUN npm ci
COPY services/vr-app/ ./
RUN npm run build

# Estagio final: Caddy servindo os dois builds e fazendo o proxy da API
FROM caddy:2-alpine
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=painel /app/dist /srv/painel
COPY --from=tour /app/dist /srv/tour
```

Se `services/frontend/.dockerignore` ou `services/vr-app/.dockerignore` não existirem,
**não** os crie (estariam em submódulo); o `.dockerignore` da raiz (passo 4) cobre
`node_modules` e `dist`.

### Passo 3 — Caddyfile

**Arquivo novo:** `deploy/Caddyfile`

```caddyfile
api.{$TOURVR_DOMAIN} {
	encode gzip
	request_body {
		max_size 25MB
	}
	reverse_proxy backend:8000
}

painel.{$TOURVR_DOMAIN} {
	encode gzip
	root * /srv/painel
	try_files {path} /index.html
	file_server
}

tour.{$TOURVR_DOMAIN} {
	encode gzip
	handle_path /api/* {
		reverse_proxy backend:8000
	}
	handle /media/* {
		reverse_proxy backend:8000
	}
	handle {
		root * /srv/tour
		try_files {path} /index.html
		file_server
	}
}
```

`25MB` dá folga sobre o limite de upload do backend (`media_max_bytes`, 20 MB).

### Passo 4 — Compose de produção

**Arquivo novo:** `deploy/docker-compose.prod.yml`

```yaml
name: tourvr-prod

x-logging: &logging
  driver: json-file
  options:
    max-size: "10m"
    max-file: "3"

services:
  mongo:
    image: mongo:7
    command: ["--wiredTigerCacheSizeGB", "0.25"]
    restart: unless-stopped
    environment:
      MONGO_INITDB_ROOT_USERNAME: ${MONGO_ROOT_USER}
      MONGO_INITDB_ROOT_PASSWORD: ${MONGO_ROOT_PASSWORD}
    volumes:
      - mongo-data:/data/db
    healthcheck:
      test: ["CMD", "mongosh", "--quiet", "--eval", "db.adminCommand('ping')"]
      interval: 10s
      timeout: 5s
      retries: 5
    logging: *logging
    # Sem "ports": o banco so e acessivel pela rede interna do compose.

  backend:
    build: ../services/backend
    command: ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000",
              "--proxy-headers", "--forwarded-allow-ips=*"]
    restart: unless-stopped
    environment:
      APP_NAME: TourVR API
      APP_ENV: production
      APP_DEBUG: "false"
      LOG_LEVEL: ${LOG_LEVEL:-INFO}
      JWT_SECRET_KEY: ${JWT_SECRET_KEY}
      MONGODB_URL: mongodb://${MONGO_ROOT_USER}:${MONGO_ROOT_PASSWORD}@mongo:27017/?authSource=admin
      MONGODB_DB: ${MONGODB_DB}
      APP_CORS_ORIGINS: https://painel.${TOURVR_DOMAIN}
      MEDIA_DIR: media
    volumes:
      - media-data:/app/media
    depends_on:
      mongo:
        condition: service_healthy
    logging: *logging

  web:
    build:
      context: ..
      dockerfile: deploy/web.Dockerfile
      args:
        VITE_API_URL: https://api.${TOURVR_DOMAIN}
        VITE_VISITOR_APP_URL: https://tour.${TOURVR_DOMAIN}
    restart: unless-stopped
    environment:
      TOURVR_DOMAIN: ${TOURVR_DOMAIN}
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - caddy-data:/data
      - caddy-config:/config
    depends_on:
      backend:
        condition: service_healthy
    logging: *logging

volumes:
  mongo-data:
  media-data:
  caddy-data:
  caddy-config:
```

**Arquivo novo:** `.dockerignore` na raiz do orquestrador:

```
**/node_modules
**/dist
**/coverage
**/.env
**/.env.*
.git
e2e
docs
```

**Verificação:** `docker compose -f deploy/docker-compose.prod.yml --env-file
deploy/.env.prod.example config` termina sem erro.

### Passo 5 — Script de implantação

**Arquivo novo:** `scripts/deploy.sh` (marcar executável com
`git update-index --chmod=+x`)

Comportamento, nesta ordem, com mensagens `[INFO]`/`[OK]`/`[ERRO]` em português sem
acentos:

1. `set -euo pipefail`; `cd` para a raiz do repositório.
2. Se `deploy/.env.prod` não existir: erro explicando `cp deploy/.env.prod.example
   deploy/.env.prod` e o preenchimento; sai com 1.
3. Se o arquivo ainda contiver o valor `troque` em qualquer variável: erro; sai com 1.
4. `git pull --ff-only origin main` e `bash scripts/setup.sh` (submódulos em `main`
   atualizada). Opção `--no-pull` pula este passo (usada no teste local).
5. `docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod up -d
   --build --wait`.
6. Verificação (lendo `TOURVR_DOMAIN` do `deploy/.env.prod`):
   `curl -fsS https://api.$TOURVR_DOMAIN/health/` deve conter `"status":"ok"`; se
   `DEPLOY_INSECURE=1`, acrescenta `-k` (certificado local no teste em `localhost`);
   em falha, imprime `docker compose ... logs --tail 50 backend web` e sai com 1.
7. Imprime os três endereços (`https://painel.`, `https://tour.`, `https://api.`) e o
   comando para criar o primeiro administrador:
   `docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod exec
   backend python -m app.cli create-admin --email <email> --password <senha>`.

### Passo 6 — Teste local da pilha de produção

Na máquina do aluno, com Docker Desktop:

1. Crie `deploy/.env.prod` (não versionado) com `TOURVR_DOMAIN=localhost` e segredos
   gerados.
2. Com `TOURVR_DOMAIN=localhost`, o Caddy usa sua autoridade certificadora local para
   `api.localhost`, `painel.localhost` e `tour.localhost` (o navegador mostrará aviso de
   certificado; aceite para o teste).
3. `DEPLOY_INSECURE=1 bash scripts/deploy.sh --no-pull`.
4. Crie um admin pelo comando impresso, entre em `https://painel.localhost`, crie e
   publique um ponto com foto, abra `https://tour.localhost/p/<slug>` e confirme que a
   página e a foto aparecem.
5. Confirme que o banco não está exposto: `docker compose -f deploy/docker-compose.prod.yml
   --env-file deploy/.env.prod port mongo 27017` não retorna nada.
6. Derrube: `docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod
   down` (sem `-v`, para não apagar os volumes de teste sem querer; o aluno decide).

Registre no PR a saída dos passos 3 a 5.

### Passo 7 — Documentação, ADR e dívida

**Arquivo novo:** `docs/11-implantacao.md` — roteiro da Parte B, para o orientador, com:

1. **Acesso:** `ssh root@201.79.39.177`.
2. **Swap de 2 GB:** `fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile
   && swapon /swapfile && echo '/swapfile none swap sw 0 0' >> /etc/fstab`.
3. **Docker:** `curl -fsSL https://get.docker.com | sh` e `docker compose version`.
4. **Firewall:** `ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp && ufw --force
   enable`. Conferir também no painel do provedor da VM se as portas 80 e 443 estão
   liberadas.
5. **Código:** `git clone https://github.com/Tour-VR/quest-project.git /opt/tourvr && cd
   /opt/tourvr && bash scripts/setup.sh`.
6. **Segredos:** `cp deploy/.env.prod.example deploy/.env.prod`, gerar cada segredo com
   `openssl rand -hex 32`; `chmod 600 deploy/.env.prod`.
7. **Subir:** `bash scripts/deploy.sh` (o primeiro build leva de 5 a 15 minutos).
8. **Primeiro administrador:** comando impresso pelo script.
9. **Conferir:** os três endereços no navegador; QR Code de um ponto lido pelo celular.
10. **Atualizar a produção** (seção própria do roteiro): quando, quem e como levar os
    merges para a VM — `cd /opt/tourvr && bash scripts/deploy.sh`, conferência pós-
    atualização e como voltar à versão anterior (`git checkout <commit anterior>` +
    `bash scripts/setup.sh` + `bash scripts/deploy.sh --no-pull`).
11. **Endurecer o SSH** (recomendado, depois de confirmar o acesso por chave): criar
    usuário com chave pública, `PermitRootLogin no` e `PasswordAuthentication no` em
    `/etc/ssh/sshd_config.d/`, `systemctl reload ssh`. Testar em outra janela antes de
    fechar a sessão atual.
12. **Trocar para domínio próprio** (quando houver): apontar `api.`, `painel.` e `tour.`
    para o IP, mudar `TOURVR_DOMAIN` e rodar `bash scripts/deploy.sh`; reimprimir os QR
    Codes (a URL muda).

**ADR-0010** em `docs/08-decisoes-arquiteturais.md` (índice e seção):

> **ADR-0010 — Implantação em VM única com Docker Compose e Caddy.** *Data:* data da
> execução · *Estado:* Aceita.
> **Contexto.** Primeira versão para testes reais no campus; VM única (1 vCPU, 2 GB),
> sem domínio próprio; câmera e WebXR exigem HTTPS.
> **Decisão.** Compose de produção em `deploy/` com `mongo` sem porta exposta, `backend`
> e `web` (Caddy servindo os builds do painel e do app do visitante, com certificado
> automático). Nomes via `sslip.io` parametrizados por `TOURVR_DOMAIN`.
> **Consequências.** ➕ Um comando para subir e atualizar; HTTPS sem custo; mesma
> ferramenta do desenvolvimento. ➖ Ponto único de falha; build na VM é lento; sem backup
> automático (DT nova); `sslip.io` é serviço de terceiros — trocar por domínio próprio
> antes de imprimir as placas definitivas.

**Dívida nova** em `docs/implementacoes-futuras/` (próximo número livre, seguindo
`_template.md`): "Backup do MongoDB e da mídia em produção" — proposta: `mongodump` diário
por `cron` e cópia do volume `media-data` para fora da VM.

## 7. Testes

Não há teste automatizado novo: o plano não altera código. Verificação:

| Verificação | Resultado esperado |
|---|---|
| `docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod.example config` | Sem erro |
| `bash -n scripts/deploy.sh` | Sem erro de sintaxe |
| `bash scripts/deploy.sh` com `.env.prod` ausente | Mensagem de erro clara, código 1 |
| `bash scripts/deploy.sh` com valor `troque` | Mensagem de erro clara, código 1 |
| Passo 6 completo | Ponto publicado visível em `https://tour.localhost/p/<slug>`, com foto |
| `docker compose ... port mongo 27017` | Nenhuma saída |
| `bash scripts/validate.sh --skip-e2e` | Continua passando (nada nos submódulos mudou) |

## 8. Documentação a atualizar

- [ ] `docs/11-implantacao.md` — novo (passo 7)
- [ ] `docs/08-decisoes-arquiteturais.md` — ADR-0010
- [ ] `docs/02-artefato-orquestrador.md` — pasta `deploy/`, `scripts/deploy.sh`,
      diferença entre compose de desenvolvimento e de produção
- [ ] `docs/01-arquitetura.md` — visão de implantação (diagrama com Caddy, backend, Mongo)
- [ ] `docs/00-visao-geral.md` — linha de CI/CD e orquestração no "Estado atual"
- [ ] `docs/README.md` — incluir `11-implantacao.md` na árvore
- [ ] `docs/implementacoes-futuras/DT-014-...md` — `Resolvida` (imagem de produção do painel)
- [ ] `docs/implementacoes-futuras/README.md` — DT-014 e a dívida nova
- [ ] `README.md` da raiz — seção curta "Produção" apontando para `docs/11-implantacao.md`

## 9. Critérios de aceite

- [ ] Todas as verificações da seção 7 com o resultado esperado
- [ ] Nenhum segredo real versionado (`git grep -n "MONGO_ROOT_PASSWORD=" -- ':!deploy/.env.prod.example'` vazio)
- [ ] MongoDB sem porta publicada no compose de produção
- [ ] Roteiro `docs/11-implantacao.md` executável por quem nunca viu o projeto
- [ ] Documentação da seção 8 atualizada

## 10. Commits esperados

Orquestrador, branch `plano/023-implantacao-em-producao`:

```
build(deploy): adiciona compose de producao com mongo fechado e caddy
build(deploy): adiciona imagem web com builds do painel e do app do visitante
feat(scripts): adiciona deploy.sh para subir e atualizar a producao
docs: adiciona roteiro de implantacao e registra a ADR-0010
docs: marca DT-014 como resolvida e registra divida de backup
```

## 11. Riscos e pontos de atenção

- **Memória no build.** O build do app do visitante (Three.js) pode passar de 2 GB. Sem a
  swap do roteiro, o build morre sem mensagem clara (`Killed`). No teste local isso não
  aparece.
- **Let's Encrypt e portas.** O certificado só sai se as portas 80 e 443 estiverem abertas
  também no firewall do provedor. Falha aparece nos logs do serviço `web`.
- **Limite do Let's Encrypt para `sslip.io`.** É domínio compartilhado; se a emissão falhar
  por limite de taxa, aguardar ou usar domínio próprio (passo 12 do roteiro).
- **Mudança de domínio invalida QR Codes impressos.** Imprimir placas definitivas só depois
  de decidir o domínio.
- **`--forwarded-allow-ips=*`** só é seguro porque o backend não publica porta; nunca
  acrescentar `ports` ao serviço `backend` no compose de produção.
- **Windows e fim de linha.** `deploy.sh` e `Caddyfile` precisam de LF; o
  `.gitattributes` da raiz já força `*.sh` — acrescente `Caddyfile text eol=lf`.

## 12. Verificação pelo aluno

1. Com o Docker Desktop aberto, peça ao agente para mostrar o passo 6 funcionando.
2. Abra `https://painel.localhost` no navegador, aceite o aviso de certificado e entre com
   o administrador criado pelo agente.
3. Crie um ponto com foto e publique.
4. Abra `https://tour.localhost/p/<slug do ponto>`: o nome, a história e a foto aparecem.
5. Confira nos PRs que nenhum arquivo `.env.prod` foi enviado.

---

## Prompt de delegação

Cole no Claude Code, na pasta `quest-project`, trocando o nome:

```text
Você é a sessão de EXECUÇÃO do projeto TourVR.
Execute o plano docs/tasks/023-implantacao-em-producao.md.
Antes de qualquer ação, leia docs/tasks/protocolo-execucao.md e siga o "Prompt 1 — EXECUTAR" etapa por etapa.
Meu nome, para registrar no plano: <SEU NOME>
```

---

## Registro de execução

Executado em 2026-11-26 pelo agente de planejamento, na sessão do orientador, a pedido dele,
para colocar a primeira versão no ar com a turma presente.

**Feito:** arquivos de `deploy/`, `.dockerignore` da raiz, `scripts/deploy.sh`,
`docs/11-implantacao.md` (com a rotina de atualização e a volta de versão), ADR-0010,
DT-027 (backup) e DT-014 resolvida. A Parte B foi executada na VM no mesmo dia, a partir da
branch deste plano.

**Desvios do plano:**

1. `ACME_EMAIL` removido: o Caddy emite certificados sem e-mail, e evita-se registrar um
   endereço pessoal na Let's Encrypt.
2. `deploy.sh` não chama `setup.sh`: usa `git submodule update --init` para posicionar os
   submódulos **nos commits fixados** pelo orquestrador, e não na `main` de cada um. Assim só
   vai ao ar o que passou pelo fechamento do plano, e a volta de versão por
   `git checkout <commit>` do orquestrador é exata.
3. Teste local (passo 6) substituído pelo teste direto na VM de produção, com a turma
   presente: `docker compose config` validado localmente; build, HTTPS e fluxo do painel ao
   visitante conferidos na VM.
4. `.gitignore`: acrescentado `!.env.prod.example` (o padrão `.env.*` ignorava o modelo);
   `deploy/.env.prod` já era coberto por `.env.*`.

