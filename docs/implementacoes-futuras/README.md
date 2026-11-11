# Implementações Futuras — Dívidas Técnicas e Frentes de Trabalho

Registro de tudo que sabemos estar pendente, mal resolvido ou ausente no sistema. Cada
item é um arquivo `DT-NNN-slug.md` e representa uma **frente de trabalho candidata** para
fases futuras do projeto.

Este diretório é a matéria-prima do planejamento. Uma sessão de planejamento parte daqui,
escolhe uma ou mais dívidas, e produz um plano em [`../tasks/`](../tasks/README.md).

## Índice

| ID | Título | Prioridade | Esforço | Artefato |
|---|---|---|---|---|
| [DT-001](DT-001-gitignore-padroes-quebrados.md) | ~~Padrões do `.gitignore` sem wildcard~~ ✅ Resolvida (plano 001) | P1 | Baixo | Orquestrador |
| [DT-002](DT-002-orquestracao-ambiente-local.md) | ~~Ambiente local não é orquestrado~~ ✅ Resolvida (plano 002) | P1 | Médio | Orquestrador |
| [DT-003](DT-003-pipeline-ci-cd.md) | ~~Ausência de CI em todos os repositórios~~ ✅ Resolvida (plano 006) | P1 | Médio | Todos |
| [DT-004](DT-004-configuracao-submodulos.md) | ~~Submódulos sem branch declarada~~ ✅ Resolvida (plano 001) | P1 | Baixo | Orquestrador |
| [DT-005](DT-005-sincronizacao-documentacao-codigo.md) | ~~READMEs dos submódulos divergem do código~~ ✅ Resolvida (plano 002) | P2 | Baixo | Backend, Frontend |
| [DT-006](DT-006-integridade-dados-mongodb.md) | ~~Sem índices únicos no MongoDB~~ ✅ Resolvida (plano 007) | P0 | Baixo | Backend |
| [DT-007](DT-007-hardening-autenticacao.md) | Fragilidades na autenticação — ⚠️ parcial (plano 007): faltam refresh token e cookie `httpOnly` | P0 | Médio | Backend, Frontend |
| [DT-008](DT-008-autorizacao-por-papel.md) | ~~Campo `role` sem autorização efetiva~~ ✅ Resolvida (plano 008) | P1 | Médio | Backend |
| [DT-009](DT-009-observabilidade-e-logging.md) | Sem logging estruturado; vazamento em debug — ⚠️ parcial (plano 007): faltam JSON e `request_id` | P2 | Médio | Backend |
| [DT-010](DT-010-tratamento-global-erros-frontend.md) | Sem interceptor de resposta 401 | P1 | Baixo | Frontend |
| [DT-011](DT-011-dashboard-dados-reais.md) | Dashboard com métricas fictícias | P2 | Médio | Frontend, Backend |
| [DT-012](DT-012-contrato-api-tipado.md) | Contrato da API duplicado manualmente | P2 | Médio | Frontend, Backend |
| [DT-013](DT-013-qualidade-codigo-frontend.md) | ~~Frontend sem testes, linter ou modo estrito~~ ✅ Resolvida (plano 004) | P2 | Médio | Frontend |
| [DT-014](DT-014-containerizacao-completa.md) | Containerização parcial e sem `.dockerignore` — ⚠️ parcial (plano 002): falta imagem de produção do frontend | P2 | Baixo | Todos |
| [DT-015](DT-015-gestao-usuarios-no-painel.md) | Cadastro de usuários só via Swagger | P2 | Médio | Frontend, Backend |
| [DT-016](DT-016-modelagem-dominio-turismo.md) | **Domínio de turismo não modelado** | **P0** | **Alto** | Backend, Frontend, VR |
| [DT-017](DT-017-revisao-scripts-ssh.md) | ~~Comentários inadequados nos scripts~~ ✅ Resolvida (plano 001) | P3 | Baixo | Orquestrador |
| [DT-018](DT-018-duplicacao-backend.md) | Duplicação de código no backend (2,5% do Python) | P3 | Baixo | Backend |
| [DT-019](DT-019-healthcheck-painel.md) | Painel sem healthcheck no Docker Compose | P3 | Baixo | Orquestrador |

**Prioridades:** `P0` bloqueia o avanço ou representa risco real · `P1` alta, resolver na
fase corrente · `P2` média, planejar · `P3` baixa, oportunidade.

**Esforço:** `Baixo` até ~2 h · `Médio` até ~1 dia · `Alto` múltiplos dias, exige plano
próprio e provavelmente uma ADR.

## Sugestão de sequenciamento

**Fase 0 — Fundação (rápida, alto retorno).** DT-001, DT-004, DT-006, DT-002. São
correções pequenas que removem risco imediato e destravam o trabalho de todos.

**Fase 1 — Qualidade e segurança.** DT-003, DT-007, DT-010, DT-005. Constrói a rede de
proteção antes de o código crescer.

**Fase 2 — Produto.** DT-016 (com a ADR-0006 já decidida), depois DT-008, DT-011, DT-015.

**Oportunísticas.** DT-009, DT-012, DT-013, DT-014, DT-017 — encaixar em qualquer fase
quando houver folga ou quando o tema for tocado por outro motivo.

## Como registrar uma nova dívida

1. Copie [`_template.md`](_template.md) para `DT-NNN-slug.md`, com o próximo número livre.
2. Preencha todos os campos. **Evidência com `arquivo:linha` é obrigatória** — dívida sem
   evidência é opinião.
3. Acrescente a linha no índice acima.
4. Commite junto com a descoberta: `docs: registra DT-NNN sobre <assunto>`.

## Como fechar uma dívida

**Não apague o arquivo.** Altere o campo `Status` para `Resolvida`, acrescente a data, o
hash do commit e o link do plano que a resolveu. O histórico de por que algo era um
problema tem valor didático e evita que a mesma decisão seja refeita do zero.
