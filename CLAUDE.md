# Instruções para agentes de IA — TourVR

Este arquivo é carregado automaticamente no início de cada sessão. Ele **não substitui** a
leitura de `docs/` — indica o que ler e como se comportar.

## O que é este repositório

`quest-project` é o repositório orquestrador do **TourVR**, um sistema de turismo virtual
para Meta Quest 3. Agrega três submódulos Git em `services/`: `backend` (FastAPI +
MongoDB), `frontend` (React + Vite) e `vr-app` (aplicação Quest 3 — **vazia**, ainda não
iniciada).

Hoje o sistema é um MVP de painel administrativo com autenticação. O produto de VR ainda
não existe.

## Base de conhecimento

`docs/` é a **fonte única de verdade**. Os READMEs dentro de `services/` estão
desatualizados e divergem do código — não use-os como referência de arquitetura
(ver `docs/implementacoes-futuras/DT-005-sincronizacao-documentacao-codigo.md`).

Leia conforme a tarefa:

| Tarefa | Leia antes de agir |
|---|---|
| Qualquer | `docs/README.md` |
| Entender o sistema | `docs/00-visao-geral.md`, `docs/01-arquitetura.md` |
| Alterar o backend | `docs/03-artefato-backend.md`, `docs/06-contrato-api.md` |
| Alterar o frontend | `docs/04-artefato-frontend.md`, `docs/06-contrato-api.md` |
| Escrever código | `docs/07-convencoes.md` |
| Planejar | `docs/tasks/README.md` + `docs/implementacoes-futuras/README.md` |
| Executar um plano | `docs/07-convencoes.md` + o plano em `docs/tasks/` |

## Regras de trabalho

**Submódulos.** O código está em submódulos Git que ficam em *detached HEAD*. Antes de
editar qualquer arquivo em `services/`, faça `git checkout main` e `git pull` dentro do
submódulo. Commitar em detached HEAD faz o trabalho ser perdido. Depois de commitar no
submódulo, atualize o ponteiro no orquestrador.

**Planejar antes de executar.** Este projeto separa a sessão que planeja da que executa
(ADR-0005). Se a tarefa é substancial, produza um plano em `docs/tasks/NNN-slug.md` e
aguarde validação — não implemente direto. Correções triviais seguem sem plano.

**Documentação no mesmo commit.** Alterou comportamento, atualize o documento
correspondente em `docs/` no mesmo commit.

**Evidência, não suposição.** Afirmação sobre o sistema vem acompanhada de
`arquivo:linha` verificado. Não descreva o que o README diz — verifique no código.

**Dívida encontrada, dívida registrada.** Encontrou um problema fora do escopo atual?
Registre em `docs/implementacoes-futuras/` seguindo `_template.md` e siga com o escopo
original. Não corrija por conta própria.

## Invariantes de arquitetura

**Backend** — Rota → Service → Repository → MongoDB, sem pular camadas. Service levanta
exceção de domínio, nunca `HTTPException`. Repository não contém regra de negócio.
Configuração sempre via `app.core.config.settings`. Senha nunca aparece em resposta ou log.

**Frontend** — Estado de sessão apenas via `useAuth()`. Toda chamada HTTP pela instância
`api` de `services/api.ts`. Tipos da API em `src/types/`, espelhando `docs/06-contrato-api.md`.

## Idioma

Documentação, comentários e commits em **português**. Nomes de código em **inglês**. Nomes
de arquivo sem acentos, em `kebab-case`. Detalhes em `docs/07-convencoes.md`.

## Comandos úteis

```bash
# Backend
cd services/backend && pytest -v
cd services/backend && uvicorn main:app --reload --port 8000

# Frontend
cd services/frontend && npm run dev
cd services/frontend && npm run lint

# Submódulos
git submodule update --init --recursive
git submodule foreach git checkout main
```
