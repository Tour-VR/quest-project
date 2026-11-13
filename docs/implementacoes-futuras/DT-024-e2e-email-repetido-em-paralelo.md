# DT-024 — E-mail de teste repetido quando cenários E2E rodam em paralelo

| | |
|---|---|
| **Status** | Aberta |
| **Prioridade** | P2 |
| **Esforço** | Baixo |
| **Artefato** | Orquestrador |
| **Registrada em** | 2026-11-13 |
| **Depende de** | nada |

## Contexto

Os helpers E2E montam o e-mail do usuário de teste com `Date.now()`. O Playwright roda os
cenários em vários workers ao mesmo tempo; quando dois deles criam usuário no mesmo
milissegundo, o segundo `create-admin` falha com "Ja existe um usuario com este email." e o
cenário quebra antes de testar qualquer coisa. Com 10 cenários (plano 013), a colisão
passou a acontecer.

## Evidência

```
e2e/support/api.ts:19   email: `e2e-${Date.now()}@tourvr.dev`
e2e/support/api.ts:45   email: `e2e-comum-${Date.now()}@tourvr.dev`
e2e/support/api.ts:67   const stamp = Date.now();
```

Execução de `bash scripts/validate.sh` em 2026-11-13 (plano 013): 3 de 10 cenários
falharam em `createAdminUser` com "Dados invalidos: Ja existe um usuario com este email.",
dois deles cenários antigos (`painel-base.spec.ts`).

## Impacto

`validate.sh` e a CI falham de forma intermitente sem nenhum defeito no produto. Cada
falha obriga a rodar de novo e mina a confiança no E2E; quanto mais cenários, mais
frequente.

## Proposta

Gerar o sufixo com `crypto.randomUUID()` (ou `Date.now()` + `testInfo.workerIndex` +
contador) nos três pontos acima.

## Critérios de aceite

- [ ] Nenhum helper usa só `Date.now()` para gerar dado que precisa ser único
- [ ] `validate.sh` passa 5 vezes seguidas sem falha de usuário duplicado

## Notas

Reduzir `workers` para 1 também resolveria, mas deixaria o E2E mais lento.
