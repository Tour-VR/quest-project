# DT-026 — E2E "dashboard conta a visita registrada" falha quando outro teste registra visita ao mesmo tempo

| | |
|---|---|
| **Status** | Aberta |
| **Prioridade** | P2 |
| **Esforço** | Baixo |
| **Artefato** | Orquestrador |
| **Registrada em** | 2026-11-23 |
| **Depende de** | nada |

## Contexto

O cenário `@golden dashboard conta a visita registrada` (plano 015) lê o total geral de
visitas no dashboard, registra uma visita e espera o total **exatamente** igual a
"antes + 1". O total é global: qualquer outro cenário que registre visita no mesmo
intervalo (como o `@golden` do visitante, plano 017) faz o número subir mais de 1.

## Evidência

```
e2e/tests/painel-gestao.spec.ts:20-32   compara o total global com antes + 1
e2e/tests/visitor-point.spec.ts         tambem registra visita ar (plano 017)
```

Ao rodar `npx playwright test tests/visitor-point.spec.ts tests/painel-gestao.spec.ts
--repeat-each 3 --workers 4`, o cenário falhou 2 vezes: `Expected: "22"`, `Received: "23"`.
O cenário do visitante foi ajustado no plano 017 para não depender do total global; este
não foi alterado porque é `@golden` de outro plano (alteração exige o orientador).

## Impacto

A CI e o `scripts/validate.sh` podem ficar vermelhos de forma intermitente, sem defeito no
código, sempre que os dois cenários rodarem ao mesmo tempo em *workers* diferentes.

## Proposta

Com aprovação do orientador, trocar a igualdade por "pelo menos antes + 1"
(`toBeGreaterThanOrEqual`) ou isolar a contagem por ponto (por exemplo, conferir o ponto
em `top_points` ou contar a requisição feita), como o plano 017 fez no cenário do
visitante.

## Critérios de aceite

- [ ] O comando de repetição paralela acima passa 3 vezes seguidas sem falha

## Notas

Mesma família de problema das DT-024 (dados compartilhados entre cenários paralelos).
