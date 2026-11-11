# Tasks — Planos de Implementação

Aqui ficam os planos de implementação produzidos em sessões de planejamento, validados
pelo orientador e delegados a sessões de execução.

Formalizado na [ADR-0005](../08-decisoes-arquiteturais.md).

## O ciclo

```
┌─ 1. PLANEJAR ──────────────────────────────────────────────┐
│  Sessão de planejamento                                    │
│  · carrega contexto de docs/                               │
│  · escolhe uma dívida em implementacoes-futuras/           │
│  · investiga o código e produz o plano                     │
│  · NÃO escreve código de produção                          │
│  → docs/tasks/NNN-slug.md (Status: Aguardando validação)   │
└────────────────────────────┬───────────────────────────────┘
                             ▼
┌─ 2. VALIDAR ───────────────────────────────────────────────┐
│  Orientador (humano)                                       │
│  · lê o plano, ajusta escopo, aprova ou devolve            │
│  → Status: Validado · data · nome                          │
└────────────────────────────┬───────────────────────────────┘
                             ▼
┌─ 3. DELEGAR ───────────────────────────────────────────────┐
│  Sessão de planejamento                                    │
│  · escreve o prompt de delegação no fim do próprio plano   │
│  · commita o plano                                         │
│  → seção "Prompt de delegação"                             │
└────────────────────────────┬───────────────────────────────┘
                             ▼
┌─ 4. EXECUTAR ──────────────────────────────────────────────┐
│  Sessão de execução (outro agente, contexto limpo)         │
│  · recebe o prompt, lê o plano e os documentos indicados   │
│  · implementa, testa, atualiza a documentação              │
│  · NÃO redecide arquitetura — divergência volta ao plano   │
│  → código + testes + docs, no mesmo commit                 │
└────────────────────────────┬───────────────────────────────┘
                             ▼
              Status: Concluído · commit registrado
              Dívida correspondente marcada como Resolvida
```

## Regras

**Da sessão de planejamento**

- Investigar o código de verdade antes de planejar. Plano baseado em suposição gera
  execução errada.
- Decidir tudo o que precisa de decisão. Se o executor precisar escolher entre duas
  abordagens, o plano está incompleto.
- Listar arquivos e caminhos concretos, não descrições vagas.
- Definir critérios de aceite verificáveis.
- Declarar explicitamente o que está **fora** de escopo.
- Não escrever código de produção. Trecho ilustrativo no plano é permitido e útil.

**Da validação**

- Nenhum plano vai para execução sem aprovação registrada no próprio arquivo.
- Ajuste de escopo é feito no plano, antes da execução — nunca durante.

**Da sessão de execução**

- Ler o plano inteiro antes de tocar em qualquer arquivo.
- Seguir as convenções de [`../07-convencoes.md`](../07-convencoes.md).
- Encontrou algo que invalida o plano? **Parar e reportar**, não improvisar.
- Encontrou uma dívida técnica nova pelo caminho? Registrar em
  [`../implementacoes-futuras/`](../implementacoes-futuras/README.md) e seguir o escopo
  original.
- Atualizar a documentação afetada no mesmo commit.

## Nomenclatura

`NNN-slug-descritivo.md` — número sequencial de três dígitos, sem reaproveitamento.

```
001-corrigir-gitignore.md
002-indices-unicos-mongodb.md
003-orquestracao-docker-compose.md
```

## Executando planos com agentes de IA

A turma executa os planos com Claude Code, em revezamento, seguindo o
[**protocolo de execução**](protocolo-execucao.md). Regra de escolha: pegue o **menor
número** com status `Validado` cujas dependências estejam todas `Concluído`. O agente
reserva o plano com o seu nome antes de começar.

## Índice de planos

| # | Plano | Fase | Depende de | Dívidas | Status |
|---|---|---|---|---|---|
| [000](000-visao-macro-opcao-b.md) | Visão macro — Opção B *(porta de entrada, não executável)* | — | — | — | Validado |
| [001](001-higiene-orquestrador.md) | Higiene do orquestrador | 0 | — | DT-001, DT-004, DT-017 | Concluído |
| [002](002-ambiente-docker-compose.md) | Ambiente Docker Compose | 0 | 001 | DT-002, DT-005, DT-014 | Concluído |
| [003](003-qualidade-backend.md) | Qualidade do backend | 0 | 002 | — | Concluído |
| [004](004-qualidade-frontend.md) | Qualidade do frontend | 0 | 002 | DT-013 | Concluído |
| [005](005-validacao-e-e2e.md) | Validação única e primeiro E2E | 0 | 003, 004 | — | Concluído |
| [006](006-integracao-continua.md) | Integração contínua | 0 | 005 | DT-003 | Concluído |
| [007](007-seguranca-backend.md) | Segurança do backend | 1 | 006 | DT-006, DT-007, DT-009 | Concluído |
| [008](008-papeis-e-administrador.md) | Papéis e administrador | 1 | 007 | DT-008 | Validado |
| [009](009-pontos-de-interesse-backend.md) | Pontos de interesse no backend | 1 | 008 | DT-016 (parcial) | Validado |
| [010](010-visitas-e-metricas-backend.md) | Visitas e métricas no backend | 1 | 009 | DT-011 (backend) | Validado |
| [011](011-base-do-painel.md) | Base do painel | 2 | 008 | DT-010, DT-012 | Validado |
| [012](012-cadastro-de-pontos-painel.md) | Cadastro de pontos no painel | 2 | 009, 011 | — | Validado |
| [013](013-upload-de-midia.md) | Upload de mídia | 2 | 012 | — | Validado |
| [014](014-qr-codes.md) | QR Codes imprimíveis | 2 | 012 | — | Validado |
| [015](015-metricas-perfil-usuarios.md) | Métricas, perfil e usuários no painel | 2 | 010, 011 | DT-011, DT-015 | Validado |
| [016](016-fundacao-app-visitante.md) | Fundação do app do visitante | 3 | 006 | — | Validado |
| [017](017-pagina-do-ponto.md) | Página do ponto (modo AR) | 3 | 010, 016 | — | Validado |
| [018](018-leitor-qr-golden-path.md) | Leitor de QR e golden path completo | 3 | 014, 017 | — | Validado |
| [019](019-panoramas-e-conexoes.md) | Panoramas e conexões | 4 | 013, 017 | — | Validado |
| [020](020-cena-vr-360.md) | Cena VR 360° | 4 | 019 | — | Validado |
| [021](021-navegacao-vr-e-encerramento.md) | Navegação VR e encerramento | 4 | 018, 020 | DT-016 | Validado |

**Status possíveis:** `Rascunho` · `Aguardando validação` · `Validado` ·
`Em execução — nome` · `Em revisão — nome` · `Concluído` · `Cancelado`

## Templates

- [`_template-plano.md`](_template-plano.md) — estrutura do plano de implementação
- [`_template-prompt-delegacao.md`](_template-prompt-delegacao.md) — prompt entregue à
  sessão de execução
