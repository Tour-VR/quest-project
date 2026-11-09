# TourVR — Repositório Orquestrador

Tour do campus em duas formas: presencial, lendo QR Codes com o celular, e remota, numa
visita imersiva em 360° no **Meta Quest 3**. Projeto acadêmico desenvolvido por um grupo de alunos sob orientação docente.

Este é o **repositório orquestrador**: agrega os demais como submódulos Git, hospeda a
base de conhecimento do projeto e centraliza a automação de ambiente.

---

## Composição

| Caminho | Repositório | Papel |
|---|---|---|
| [`services/backend`](services/backend) | [Tour-VR/backend](https://github.com/Tour-VR/backend) | API REST — FastAPI + MongoDB |
| [`services/frontend`](services/frontend) | [Tour-VR/frontend](https://github.com/Tour-VR/frontend) | Painel administrativo — React + Vite |
| [`services/vr-app`](services/vr-app) | [Tour-VR/vr-app](https://github.com/Tour-VR/vr-app) | App do visitante — modo AR (celular) e modo VR (Quest 3) — **ainda não iniciado** |

---

## Primeiros passos

Pré-requisitos: [Git](https://git-scm.com/) (no Windows, use o Git Bash), o
[GitHub CLI](https://cli.github.com/) (`gh`), com uma conta que tenha acesso à
organização `Tour-VR`, e o [Docker Desktop](https://www.docker.com/products/docker-desktop/)
em execução.

```bash
gh auth login          # uma vez por computador
gh auth setup-git
git clone https://github.com/Tour-VR/quest-project.git
cd quest-project
bash scripts/setup.sh
bash scripts/up.sh
```

O `setup.sh` baixa os três submódulos e deixa cada um na branch `main`. A última linha
deve ser `[OK] Submodulos prontos: todos na branch main.` Ele não muda o protocolo de
acesso: usa o login HTTPS feito pelo `gh`.

### Alternativa: SSH

Para acessar o GitHub por SSH em vez de HTTPS, use o `ssh-setup` no lugar do `setup.sh`:

```bash
# Linux / macOS / Git Bash
bash scripts/bash/ssh-setup.sh
```

```powershell
# Windows PowerShell
.\scripts\posh\ssh-setup.ps1
```

O script exige uma chave SSH registrada na sua conta GitHub (para criar uma:
`ssh-keygen -t ed25519`). Ele testa a chave primeiro; se ela não funcionar, sai sem
alterar nada. Se funcionar, configura o Git para trocar HTTPS por SSH e prepara os
submódulos como o `setup.sh`.

### Subir o ambiente

O `up.sh` sobe MongoDB, backend e painel com Docker Compose. Na primeira vez ele cria o
`.env` a partir do `.env.example` e avisa para trocar a `JWT_SECRET_KEY`. Quando terminar:

| O quê | Endereço |
|---|---|
| Painel administrativo | http://localhost:3000 |
| Documentação da API (Swagger) | http://localhost:8000/docs |

Para entrar no painel, cadastre um usuário pelo Swagger (`POST /auth/register`).

| Comando | Faz |
|---|---|
| `bash scripts/up.sh` | Sobe (ou atualiza) o ambiente |
| `bash scripts/down.sh` | Para o ambiente; os dados do banco ficam guardados |
| `bash scripts/logs.sh [servico]` | Mostra os logs (`backend`, `frontend` ou `mongo`) |
| `bash scripts/reset-db.sh` | Apaga todos os dados do banco local (pede confirmação) |

Detalhes em [`docs/02-artefato-orquestrador.md`](docs/02-artefato-orquestrador.md#ambiente-local).

---

## ⚠️ Antes de editar qualquer código em `services/`

O `setup.sh` deixa os submódulos na branch `main`, mas um `git submodule update` os
devolve a *detached HEAD*. Commitar nesse estado **faz o trabalho ser perdido**. Antes de
editar, confira com `git branch --show-current` dentro do submódulo e, se vier vazio:

```bash
cd services/<submodulo>
git checkout main
git pull origin main
```

Procedimento completo em [`docs/07-convencoes.md`](docs/07-convencoes.md).

---

## Documentação

Toda a documentação do projeto vive em [`docs/`](docs/README.md) e é a fonte única de
verdade — os READMEs dos submódulos não devem ser usados como referência de arquitetura.

| Para | Leia |
|---|---|
| Entender o projeto | [`docs/00-visao-geral.md`](docs/00-visao-geral.md) |
| Entender a arquitetura | [`docs/01-arquitetura.md`](docs/01-arquitetura.md) |
| Integrar com a API | [`docs/06-contrato-api.md`](docs/06-contrato-api.md) |
| Escrever código | [`docs/07-convencoes.md`](docs/07-convencoes.md) |
| Saber por que algo é assim | [`docs/08-decisoes-arquiteturais.md`](docs/08-decisoes-arquiteturais.md) |
| Ver o que está pendente | [`docs/implementacoes-futuras/`](docs/implementacoes-futuras/README.md) |
| Ver os planos em andamento | [`docs/tasks/`](docs/tasks/README.md) |

---

## Como o projeto trabalha

Toda implementação segue quatro etapas com responsabilidades separadas:

**planejar → validar → delegar → executar**

Uma sessão elabora o plano; o orientador valida; o plano é versionado em `docs/tasks/`;
outra sessão executa. Detalhes em [`docs/tasks/README.md`](docs/tasks/README.md).

A execução é feita pelos alunos, em revezamento, com agentes de IA (Claude Code) que seguem
o [protocolo de execução](docs/tasks/protocolo-execucao.md): o agente reserva o plano,
implementa, testa, atualiza a documentação e abre os Pull Requests; o orientador revisa e
faz o merge.

---

## Estado atual

O que existe hoje é um MVP de painel administrativo com autenticação completa. O núcleo do
produto — a aplicação de realidade virtual — ainda não foi iniciado. Leitura honesta do
estado em [`docs/00-visao-geral.md`](docs/00-visao-geral.md).

## Licença

[MIT](LICENSE)
