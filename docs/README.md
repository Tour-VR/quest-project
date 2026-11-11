# Base de Conhecimento — TourVR

Este diretório é a **fonte única de verdade** do projeto TourVR. Ele existe para dois
públicos, com o mesmo conteúdo:

- **Pessoas** — alunos e orientadores que entram no projeto e precisam entender o
  sistema sem ler todo o código;
- **Agentes de IA** — sessões de assistentes que precisam carregar contexto confiável
  no início do trabalho, sem redescobrir o repositório a cada vez.

Tudo aqui é versionado e commitado junto com o código. Documento desatualizado é
tratado como bug.

---

## Como esta base está organizada

```
docs/
├── README.md                      ← você está aqui: índice e protocolo de uso
│
├── 00-visao-geral.md              ← o que é o TourVR, escopo, estado atual
├── 01-arquitetura.md              ← visão de sistema, repositórios, fluxos
├── 02-artefato-orquestrador.md    ← repositório raiz (build, setup, submódulos)
├── 03-artefato-backend.md         ← serviço FastAPI + MongoDB
├── 04-artefato-frontend.md        ← painel administrativo React
├── 05-artefato-vr-app.md          ← aplicação Quest 3 (ainda não iniciada)
├── 06-contrato-api.md             ← contrato REST — fonte de verdade da integração
├── 07-convencoes.md               ← código, git, submódulos, documentação
├── 08-decisoes-arquiteturais.md   ← registro de decisões (ADR) e seus porquês
├── 09-glossario.md                ← vocabulário comum do domínio e da stack
│
├── guia-alunos/                   ← guia em PDF para os alunos executarem os planos com IA
├── implementacoes-futuras/        ← dívidas técnicas e frentes de trabalho futuras
└── tasks/                         ← planos de implementação + protocolo de execução
```

### Raiz de `docs/` — arquitetura oficial

Descreve **o que o sistema é hoje**. Cada artefato do sistema (repositório ou serviço)
tem um documento próprio. Estes documentos descrevem a realidade verificada no código,
não a intenção. Quando o código muda, eles mudam no mesmo commit.

### `implementacoes-futuras/` — dívidas técnicas

Registra **o que sabemos que está pendente ou mal resolvido**. Cada item é um arquivo
`DT-NNN-slug.md` com contexto, evidência, impacto, proposta e esforço estimado. Nada é
apagado quando resolvido: o arquivo é marcado como `Resolvida` com o link do commit,
preservando a memória da decisão.

Estes arquivos são a matéria-prima do planejamento de fases futuras.

### `tasks/` — planos de implementação

Registra **o que foi decidido fazer e como**. Este projeto opera com separação estrita
entre planejar e executar (ver protocolo abaixo).

---

## Protocolo de trabalho: planejar → validar → delegar → executar

Toda implementação neste projeto segue quatro etapas, com responsabilidades separadas:

| # | Etapa | Quem | Saída |
|---|---|---|---|
| 1 | **Planejar** | Sessão de planejamento | Plano em `docs/tasks/NNN-slug.md` |
| 2 | **Validar** | Orientador (humano) | Aprovação explícita do plano |
| 3 | **Delegar** | Sessão de planejamento | Prompt de delegação no próprio plano |
| 4 | **Executar** | Sessão de execução (outro agente) | Código + testes + docs atualizados |

A sessão que planeja **não** implementa. A sessão que implementa recebe o plano já
validado e não redecide arquitetura. Isso mantém o contexto de cada sessão pequeno,
torna o plano auditável antes de qualquer linha de código, e deixa um rastro escrito
de por que cada coisa foi feita.

Detalhes e templates em [tasks/README.md](tasks/README.md).

---

## Carga de contexto para uma sessão nova

Ordem recomendada de leitura, conforme o objetivo da sessão:

**Entender o projeto pela primeira vez**
`00-visao-geral.md` → `01-arquitetura.md` → o documento do artefato em questão.

**Planejar uma implementação**
`00-visao-geral.md` → `01-arquitetura.md` → `06-contrato-api.md` → `07-convencoes.md` →
os arquivos de `implementacoes-futuras/` relacionados ao tema.

**Executar um plano já validado**
`07-convencoes.md` → o documento do artefato afetado → `docs/tasks/NNN-slug.md`.

**Revisar código**
`07-convencoes.md` → `06-contrato-api.md` → documento do artefato afetado.

---

## Regras de manutenção

1. **Documento e código no mesmo commit.** Alterou endpoint, alterou `06-contrato-api.md`.
2. **Descreva o que existe, não o que se pretende.** Intenção vai para
   `implementacoes-futuras/`; decisão vai para `08-decisoes-arquiteturais.md`.
3. **Cite evidência.** Afirmação sobre o sistema vem acompanhada de `arquivo:linha`.
4. **Marque o que não existe.** Um documento pode descrever um artefato não iniciado —
   deve dizer isso explicitamente, não deixar em branco.
5. **Sem arquivos vazios.** Placeholder sem conteúdo é ruído; não crie o arquivo até
   ter o que escrever.

[link quebrado proposital](arquivo-que-nao-existe.md)
