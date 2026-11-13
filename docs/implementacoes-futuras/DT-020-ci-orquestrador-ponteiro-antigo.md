# DT-020 — CI do orquestrador não testa mudança que depende de código novo de submódulo

| | |
|---|---|
| **Status** | Aberta |
| **Prioridade** | P1 |
| **Esforço** | Baixo |
| **Artefato** | Orquestrador |
| **Registrada em** | 2026-11-11 |
| **Depende de** | nada |

## Contexto

Num PR de plano, a CI do orquestrador roda o E2E com os submódulos nos ponteiros já
fixados na `main`, e esses ponteiros só mudam no fechamento do plano (protocolo, Prompt 3),
**depois** do merge do PR do orquestrador. Quando o PR do orquestrador depende de código
novo de um submódulo, a CI fica vermelha e não há como ela ficar verde seguindo o
protocolo à risca. Apareceu no plano 008: o helper de E2E chama
`python -m app.cli create-admin`, que só existe no PR do backend.

## Evidência

```
.github/workflows/ci.yml:18-20          checkout com submodules: recursive (ponteiro fixado)
.github/workflows/ci.yml:21-29          ponteiro precisa pertencer à main do submódulo
docs/02-artefato-orquestrador.md        "Num PR de plano, a CI do orquestrador testa os
                                        submódulos nos ponteiros atuais da main"
docs/tasks/protocolo-execucao.md        Prompt 3, passo 3: ponteiros só no fechamento
e2e/support/api.ts:19-26                createAdminUser depende de app.cli (plano 008)
```

Falha real: PR Tour-VR/quest-project#8, job `validacao`, log
`/usr/local/bin/python: No module named app.cli`.

## Impacto

- Todo plano cujo E2E usa comportamento novo de um submódulo (planos 009 em diante, que
  criam rotas `/admin/...` e telas novas) terá o PR do orquestrador vermelho.
- Como a proteção de branch exige `CI / validacao` verde, o orientador não consegue fazer o
  merge sem contornar a regra.

## Proposta

Escolher uma das opções e ajustar protocolo e documentação:

1. **Atualizar o ponteiro no PR do orquestrador** depois do merge dos PRs dos submódulos
   (o ponteiro passa a pertencer à `main`, a checagem atual aceita). O Prompt 2 ou um passo
   novo do protocolo faz `git submodule update --remote` + commit do ponteiro na branch do
   plano; o Prompt 3 deixa de precisar atualizar ponteiros.
2. **CI do orquestrador testar a branch de mesmo nome** nos submódulos quando ela existir
   (`plano/NNN-slug`), caindo para o ponteiro da `main` quando não existir.

## Critérios de aceite

- [ ] Um PR de orquestrador que depende de código novo de submódulo consegue ficar verde
      sem desligar o E2E
- [ ] Protocolo e `02-artefato-orquestrador.md` descrevem o fluxo escolhido

## Notas

A opção 1 não muda a CI e mantém a garantia "ponteiro sempre na `main`", mas exige a
ordem de merge: submódulos primeiro, depois atualizar o ponteiro, depois o orquestrador.

**Ocorrência (2026-11-12, plano 012).** PR Tour-VR/quest-project#14: os 3 cenários de
`e2e/tests/pontos.spec.ts` falham na CI porque o painel no ponteiro da `main` ainda não tem
a tela de pontos; passam localmente com o frontend da branch do plano.
