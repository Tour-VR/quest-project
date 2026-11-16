# DT-023 — Visão geral com estado e números desatualizados

| | |
|---|---|
| **Status** | Aberta |
| **Prioridade** | P3 |
| **Esforço** | Baixo |
| **Artefato** | Orquestrador (documentação) |
| **Registrada em** | 2026-11-16 |
| **Depende de** | — |

## Contexto

`docs/00-visao-geral.md` é a porta de entrada de quem chega ao projeto. Durante o plano 015
foram atualizadas apenas as linhas do painel e do domínio; outras linhas continuam
descrevendo o projeto de agosto de 2026.

## Evidência

- `docs/00-visao-geral.md`, tabela "Estado atual": "Orquestração de ambiente" e "CI/CD"
  aparecem como 🔴 "Não existe", mas os planos 002 e 006 entregaram `docker-compose.yml`,
  scripts e CI.
- `docs/00-visao-geral.md`, tabela "Escopo em números": 24 testes e 7 endpoints; hoje o
  backend tem 171 testes e mais de 20 rotas.

## Impacto

Quem lê só a visão geral subestima o que já existe e pode planejar trabalho repetido.

## Proposta

Revisar a seção "Estado atual" e recalcular "Escopo em números" a partir do código, com
`arquivo:linha` quando couber.

## Critérios de aceite

- [ ] Nenhuma linha da tabela "Estado atual" contradiz um plano `Concluído`
- [ ] Números de "Escopo em números" conferidos contra o código, com data

## Notas

Encontrada na execução do plano 015; fora do escopo dele (que só pedia "estado: painel
completo").
