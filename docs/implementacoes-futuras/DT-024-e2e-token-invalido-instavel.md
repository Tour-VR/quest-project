# DT-024 — Cenário E2E "token inválido" instável sob carga

| | |
|---|---|
| **Status** | Aberta |
| **Prioridade** | P3 |
| **Esforço** | Baixo |
| **Artefato** | Orquestrador (E2E) |
| **Registrada em** | 2026-11-16 |
| **Depende de** | nada |

## Contexto

Na execução do plano 015, o cenário `token inválido leva ao login com aviso` falhou uma vez
em três rodadas completas de `bash scripts/validate.sh`. Isolado, passou 5 de 5 vezes
(`npx playwright test tests/painel-base.spec.ts --repeat-each=5`).

## Evidência

`e2e/tests/painel-base.spec.ts:25-38`: depois de `page.goto('/dashboard')` com token
inválido, a tela chegou em `/login`, mas o aviso "Sua sessão expirou. Entre novamente." não
apareceu dentro de 5 s. Hipótese: com os testes em paralelo, o painel às vezes redireciona
antes do `GET /users/me` responder `401`, e o aviso não é definido.

## Impacto

Falha intermitente no `validate.sh` e na CI, sem defeito real no produto.

## Proposta

Investigar a ordem entre a restauração de sessão e o redirecionamento; no teste, esperar a
resposta `401` de `/users/me` antes de verificar o aviso.

## Critérios de aceite

- [ ] O cenário passa em 20 repetições com os demais testes em paralelo

## Notas

Encontrada na execução do plano 015; fora do escopo dele.
