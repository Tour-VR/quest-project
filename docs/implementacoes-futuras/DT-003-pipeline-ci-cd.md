# DT-003 — Ausência de integração contínua em todos os repositórios

| | |
|---|---|
| **Status** | Resolvida — 2026-11-11 — [plano 006](../tasks/006-integracao-continua.md) |
| **Prioridade** | P1 |
| **Esforço** | Médio |
| **Artefato** | Todos |
| **Registrada em** | 2026-08-20 |
| **Depende de** | DT-002 (facilita, mas não bloqueia) |

## Contexto

Nenhum dos quatro repositórios possui `.github/workflows/`. O backend tem 24 testes
automatizados bem escritos, com MongoDB mockado, que só rodam quando alguém lembra de
executá-los localmente. O frontend não tem testes, mas tem `tsc --noEmit`, que também
depende de disciplina individual.

## Evidência

```
find . -name '*.yml' -o -name '*.yaml'   → nenhum resultado
ls -a services/backend | grep github     → nenhum resultado
ls -a services/frontend | grep github    → nenhum resultado
```

## Impacto

- Um teste quebrado pode entrar em `main` e permanecer sem detecção indefinidamente.
- O valor dos 24 testes do backend é desperdiçado — eles não protegem nada se não rodam.
- Erro de tipagem no frontend só aparece quando alguém roda `npm run lint`.
- Sem CI não há critério objetivo de "pronto para merge"; a revisão vira leitura manual.
- Em contexto acadêmico, perde-se a oportunidade de ensinar a prática.

## Proposta

1. **Workflow no `backend`:** em push e pull request para `main` — instalar dependências,
   rodar `pytest -v`. Sem serviço de MongoDB, já que os testes usam mock.
2. **Workflow no `frontend`:** `npm ci`, `npm run lint` (`tsc --noEmit`), `npm run build`.
3. **Workflow no orquestrador:** checkout com `submodules: recursive`, verificação de que
   os ponteiros apontam para commits existentes em `main`, e validação de links quebrados
   em `docs/`.
4. Proteger a branch `main` exigindo os checks verdes.
5. Cachear dependências (`pip` e `npm`) para manter os tempos baixos.

## Critérios de aceite

- [ ] Pull request no `backend` executa os 24 testes automaticamente
- [ ] Pull request no `frontend` falha se houver erro de tipo ou de build
- [ ] Status do check visível no pull request antes do merge
- [ ] Tempo total de cada workflow abaixo de 3 minutos

## Notas

Começar simples: um único job por repositório. Matriz de versões, cobertura e deploy
automático podem vir depois — o valor está em existir, não em ser sofisticado.

## Resolução

Resolvida pelo [plano 006](../tasks/006-integracao-continua.md): `.github/workflows/ci.yml`
com o job `validacao` em `Tour-VR/backend` (Ruff, mypy, pytest com cobertura), em
`Tour-VR/frontend` (lint, tipagem, Prettier, Vitest com cobertura, build) e no
orquestrador (ponteiros dos submódulos na `main`, links internos com `lychee --offline` e
`bash scripts/validate.sh` completo, com E2E). Cache de `pip` e `npm` nos submódulos.
A proteção da branch `main` (item 4 da proposta) é **ação manual do orientador**,
descrita no PR do orquestrador e em
[02-artefato-orquestrador.md](../02-artefato-orquestrador.md#integração-contínua).
O workflow do `vr-app` vem no plano 016.
