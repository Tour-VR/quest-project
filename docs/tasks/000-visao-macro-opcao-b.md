# 000 — Visão Macro: Opção B

> **Este é um plano de visão macro, não um plano de execução.**
>
> Ele cobre todos os módulos do projeto em nível de intenção e sequência, e serve como
> **porta de entrada** para os planos menores. Nenhuma tarefa deste documento deve ser
> executada diretamente a partir dele: cada fase será quebrada em planos executáveis
> próprios (`docs/tasks/NNN-*.md`), detalhados arquivo a arquivo, validados e delegados
> individualmente, conforme o protocolo da [ADR-0005](../08-decisoes-arquiteturais.md).
>
> Este documento é vivo. À medida que o projeto avança, ele é atualizado com os planos
> filhos gerados e o estado de cada fase.

| | |
|---|---|
| **Status** | Validado |
| **Tipo** | Visão macro — desdobra-se em planos menores |
| **ADRs relacionadas** | ADR-0006 (decidida por este plano) · ADR-0007, 0008, 0009 |
| **Artefatos afetados** | Orquestrador · Backend · Frontend · VR App |
| **Planejado em** | 2026-08-20 |
| **Validado em** | 2026-08-20 |

---

## 1. Contexto

O produto real do TourVR foi esclarecido: **um tour do campus acionado por QR Codes
afixados nos locais**. O aluno chega à biblioteca, lê o código, e recebe conteúdo sobre
aquele lugar — a história do nome, fotos, explicação. O mesmo padrão se repete nos demais
pontos do campus.

Isso é realidade aumentada presencial, não turismo virtual remoto. Leitura de QR exige
acesso aos pixels da câmera, que o navegador do Quest 3 não expõe ao JavaScript. Daí a
**Opção B**: dividir o produto por dispositivo, em vez de forçar tudo no headset.

| Experiência | Dispositivo | Por quê |
|---|---|---|
| Tour AR presencial | Celular | Câmera acessível ao navegador; o aluno já carrega um; seguro para caminhar |
| Tour VR remoto | Quest 3 | Para quem ainda não conhece o campus: calouro, candidato, visitante remoto |

As duas metades compartilham backend, domínio e conteúdo. O mesmo cadastro de "Biblioteca
Central — história do nome, fotos, texto" alimenta as duas.

**Ponto de partida:** existe autenticação completa e testada no backend (24 testes) e um
painel administrativo com login funcional. Não existe nenhum modelo de domínio de turismo,
nem o app do visitante, nem a infraestrutura de qualidade que as diretrizes exigem.

---

## 2. Arquitetura alvo

```
                     ┌────────────────────────────────────────┐
                     │  services/backend — FastAPI + MongoDB  │
                     │  auth · pontos · mídia · visitas       │
                     └──────┬──────────────────────┬──────────┘
                 admin/JWT  │                      │  público
                     ┌──────▼──────┐      ┌────────▼──────────────────┐
                     │  frontend   │      │ vr-app (app do visitante) │
                     │  painel     │      │  ┌──────────┬───────────┐ │
                     │  admin      │      │  │ modo AR  │  modo VR  │ │
                     └─────────────┘      │  │ celular  │  Quest 3  │ │
                                          │  └────┬─────┴─────┬─────┘ │
                                          │       └── núcleo ──┘      │
                                          │   api · tipos · conteúdo  │
                                          └───────────────────────────┘
```

## 3. Decisões estruturais

| Decisão | Escolha | Motivo |
|---|---|---|
| Onde vive o app do visitante | Um submódulo (`services/vr-app`), dois modos sobre núcleo comum | Evita duplicação; não exige repositório novo |
| Autenticação do visitante | Nenhuma — conteúdo público | QR funciona em qualquer leitor; menor atrito |
| Conteúdo do QR | URL `https://<host>/p/<slug>` | Progressivo: funciona mesmo sem o app |
| Stack do app do visitante | React + Vite + TypeScript; WebXR/R3F no modo VR | Reaproveita a competência do grupo |
| Ambiente de E2E | Docker Compose | Reprodutível; resolve DT-002 junto |

O nome `vr-app` fica impreciso, já que passa a abrigar também o modo AR. Renomear o
repositório no GitHub é opcional e fica registrado como pendência.

## 4. Diretrizes de engenharia

Cada diretriz vira regra executável, verificada por `scripts/validate.sh`, não recomendação
em documento.

| Diretriz | Mecanismo |
|---|---|
| Cobertura com testes unitários | `pytest-cov --cov-fail-under=80`; Vitest coverage thresholds |
| Evitar código morto | Ruff `F401`/`ARG`/`ERA001`; ESLint `no-unused-vars`; TS `noUnusedLocals` |
| Evitar hardcoded, usar constantes documentadas | Ruff `PLR2004`; ESLint `no-magic-numbers` |
| Evitar god components | ESLint `max-lines`/`max-lines-per-function`/`complexity`; Ruff `C901`/`PLR0915` |
| Evitar duplicação | `jscpd` |
| Lint rígido | Ruff + mypy strict; typescript-eslint `strictTypeChecked` + `tsc --strict` |
| Testes E2E e golden path | Playwright contra a pilha em Docker, cenários marcados `@golden` |
| Doc atualizada ao fim de cada atividade | Seção obrigatória em todo plano filho |
| Commits granulares e documentados | Conventional Commits |

Aplicar esses limites reprova o código atual: `Login.tsx` e `Dashboard.tsx` excedem o
tamanho de componente e serão decompostos por composição na Fase 0.

---

## 5. Fases

### Fase 0 — Fundação de qualidade

**Objetivo:** tornar as diretrizes verificáveis antes de escrever código de domínio.
Sem isso, escreveríamos código que não pode ser validado.

Higiene do orquestrador · ambiente Docker Compose · lint e cobertura no backend · lint,
testes e decomposição de componentes no frontend · `scripts/test-all` e `scripts/validate` ·
E2E com o primeiro golden path · CI.

*Dívidas:* DT-001, DT-002, DT-003, DT-004, DT-013, DT-014, DT-017.

*Planos filhos previstos:* higiene do orquestrador · ambiente Docker · qualidade do backend ·
qualidade do frontend · scripts de validação e E2E · integração contínua.

### Fase 1 — Domínio do campus (backend)

**Objetivo:** dar ao sistema o que ele hoje não tem — a representação dos pontos do campus.

Entidades `PontoDeInteresse` (com `slug` usado no QR, história, mídias aninhadas, rascunho
× publicado) e `RegistroDeVisita` anônimo. Endpoints públicos de leitura e endpoints
administrativos de escrita, seguindo as camadas já estabelecidas. Índices únicos,
autorização por papel e recusa de subir com `JWT_SECRET_KEY` default.

*Dívidas:* DT-006, DT-007 (itens urgentes), DT-008, DT-016 (parcial). *Registra:* ADR-0007.

### Fase 2 — Painel administrativo

**Objetivo:** permitir que o conteúdo do tour seja gerenciado por pessoas, não por Swagger.

CRUD de pontos · **geração e folha imprimível de QR Codes** · gestão de mídias · métricas
reais no lugar dos literais · interceptor de 401 · tipos gerados do OpenAPI · tela de perfil.

*Dívidas:* DT-010, DT-011, DT-012, DT-015.

### Fase 3 — App do visitante, modo AR

**Objetivo:** a experiência presencial — escanear e ver.

Núcleo compartilhado (api, tipos, constantes, componentes de conteúdo) · leitura de QR
isolada em módulo testável (`BarcodeDetector` com fallback `@zxing/browser`) · rota
`/p/:slug` · registro de visita.

*Golden path:* admin cria e publica um ponto → gera o QR → visitante abre a URL → vê nome,
história e mídias → visita registrada.

### Fase 4 — App do visitante, modo VR

**Objetivo:** a experiência remota, sobre o mesmo núcleo.

WebXR com React Three Fiber · cena imersiva 360° dos pontos · navegação entre eles ·
resolução do requisito de HTTPS para WebXR.

*Dívidas:* DT-016 (conclusão). *Registra:* ADR-0008.

---

## 6. Como este plano se desdobra

1. Uma sessão de planejamento escolhe a próxima fase (ou um recorte dela).
2. Produz um plano executável em `docs/tasks/NNN-slug.md`, seguindo
   [`_template-plano.md`](_template-plano.md), com passos arquivo a arquivo, testes,
   critérios de aceite e documentação a atualizar.
3. Você valida.
4. A sessão gera o prompt de delegação; outra sessão executa.
5. Este documento é atualizado com o plano filho e o estado da fase.

O índice em [`README.md`](README.md) mantém a lista de planos e seus status.

### Planos filhos gerados

| # | Plano | Fase | Status |
|---|---|---|---|
| — | *nenhum ainda* | — | — |

---

## 7. Critério de verificação

Para toda fase, o mesmo portão:

```bash
bash scripts/validate.sh
```

Lint e tipagem · formatação · duplicação · testes unitários com cobertura mínima · build ·
E2E com os golden paths acumulados. Código de saída zero, mais a documentação atualizada no
mesmo commit da mudança.

---

## 8. Fora de escopo

Renomear o repositório `vr-app` no GitHub · modelagem de roteiros como sequência ordenada
de pontos (depois que um ponto isolado funcionar de ponta a ponta) · storage próprio de
mídia, que fica para a ADR-0008 quando houver volume real · refresh token e cookie
`httpOnly` · gamificação e histórico por aluno, que dependeriam de autenticar o visitante.

---

## 9. Próximo passo

Quebrar a Fase 0 em seu primeiro plano executável: `docs/tasks/001-higiene-orquestrador.md`,
cobrindo DT-001, DT-004 e DT-017 — as correções de menor risco e maior retorno imediato,
que também eliminam o risco de perda de trabalho nos submódulos.
