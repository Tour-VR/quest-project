# TourVR — Repositório Orquestrador

Sistema de turismo virtual para óculos **Meta Quest 3**, com painel administrativo web e
API REST. Projeto acadêmico desenvolvido por um grupo de alunos sob orientação docente.

Este é o **repositório orquestrador**: agrega os demais como submódulos Git, hospeda a
base de conhecimento do projeto e centraliza a automação de ambiente.

---

## Composição

| Caminho | Repositório | Papel |
|---|---|---|
| [`services/backend`](services/backend) | [Tour-VR/backend](https://github.com/Tour-VR/backend) | API REST — FastAPI + MongoDB |
| [`services/frontend`](services/frontend) | [Tour-VR/frontend](https://github.com/Tour-VR/frontend) | Painel administrativo — React + Vite |
| [`services/vr-app`](services/vr-app) | [Tour-VR/vr-app](https://github.com/Tour-VR/vr-app) | Aplicação Quest 3 — **ainda não iniciada** |

---

## Primeiros passos

```bash
git clone https://github.com/Tour-VR/quest-project.git
cd quest-project
```

Configure o acesso e inicialize os submódulos:

```bash
# Linux / macOS / Git Bash
bash scripts/bash/ssh-setup.sh
```

```powershell
# Windows PowerShell
.\scripts\posh\ssh-setup.ps1
```

O script exige uma chave SSH registrada na sua conta GitHub com acesso à organização
`Tour-VR`. Se ainda não tiver uma: `ssh-keygen -t ed25519`.

Em seguida, siga as instruções de execução de cada serviço:

- Backend — [`docs/03-artefato-backend.md`](docs/03-artefato-backend.md)
- Frontend — [`docs/04-artefato-frontend.md`](docs/04-artefato-frontend.md)

> Ainda não há orquestração de ambiente com um comando único. Registrado como
> [DT-002](docs/implementacoes-futuras/DT-002-orquestracao-ambiente-local.md).

---

## ⚠️ Antes de editar qualquer código em `services/`

Os submódulos ficam em *detached HEAD* após a inicialização. Commitar nesse estado **faz o
trabalho ser perdido**. Sempre:

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

---

## Estado atual

O que existe hoje é um MVP de painel administrativo com autenticação completa. O núcleo do
produto — a aplicação de realidade virtual — ainda não foi iniciado. Leitura honesta do
estado em [`docs/00-visao-geral.md`](docs/00-visao-geral.md).

## Licença

[MIT](LICENSE)
