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

## Índice de planos

| # | Plano | Dívidas | Status |
|---|---|---|---|
| — | *nenhum plano registrado ainda* | — | — |

**Status possíveis:** `Rascunho` · `Aguardando validação` · `Validado` · `Em execução` ·
`Concluído` · `Cancelado`

## Templates

- [`_template-plano.md`](_template-plano.md) — estrutura do plano de implementação
- [`_template-prompt-delegacao.md`](_template-prompt-delegacao.md) — prompt entregue à
  sessão de execução
