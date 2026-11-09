# DT-001 — Padrões do `.gitignore` da raiz sem wildcard

| | |
|---|---|
| **Status** | Resolvida — 2026-11-09 — [plano 001](../tasks/001-higiene-orquestrador.md), commit `fb3c021` |
| **Prioridade** | P1 |
| **Esforço** | Baixo |
| **Artefato** | Orquestrador |
| **Registrada em** | 2026-08-20 |
| **Depende de** | nada |

## Contexto

O `.gitignore` do repositório orquestrador foi escrito com as extensões sem o `*` inicial.
Na sintaxe do Git, `.log` casa apenas com um arquivo cujo nome é literalmente `.log` —
não com `servidor.log`. O arquivo aparenta cobrir logs, builds, arquivos temporários e
artefatos Python, mas na prática **não ignora praticamente nada** do que pretende.

## Evidência

`.gitignore` na raiz do orquestrador:

```
.py[cod]      → deveria ser *.py[cod]
.log          → deveria ser *.log
.tmp .temp .bak .swp .swo .orig .rej
.zip          → deveria ser *.zip
.coverage.    → linha truncada, provavelmente *.coverage.*
.env.         → linha truncada, provavelmente .env.*
!.env.example → duplicado (aparece duas vezes)
```

Padrões de diretório (`node_modules`, `dist`, `build`, `.venv`, `__pycache__`) funcionam
corretamente; o problema é restrito aos padrões por extensão.

Comparação: os `.gitignore` dos submódulos `backend` e `frontend` estão corretos
(`.env.*`, `node_modules/`, `dist/`).

## Impacto

- Logs de execução, dumps, arquivos `.zip` de exportação e `.pyc` avulsos podem ser
  commitados sem aviso.
- Em um projeto acadêmico com vários alunos em máquinas diferentes, isso vira poluição de
  repositório e conflitos de merge desnecessários.
- Risco de vazamento: um `debug.log` com string de conexão ou token entra no histórico
  público sem nenhuma barreira.

## Proposta

1. Reescrever o `.gitignore` da raiz com os wildcards corretos.
2. Remover a duplicação de `!.env.example` e completar as linhas truncadas.
3. Acrescentar padrões relevantes ausentes: `*.apk`, `*.pdb`, `*.mdb` (build de VR),
   `.claude/`, `*.egg-info/`.
4. Verificar se algum arquivo que deveria estar ignorado já está rastreado:
   `git ls-files | grep -E '\.(log|zip|pyc)$'`.

## Critérios de aceite

- [ ] `git check-ignore -v teste.log` retorna a regra correspondente
- [ ] `git check-ignore -v build.zip` retorna a regra correspondente
- [ ] `git check-ignore -v app/__pycache__/x.pyc` retorna a regra correspondente
- [ ] `.env.example` continua sendo rastreado
- [ ] Nenhum arquivo indesejado permanece no índice

## Notas

Correção de baixo risco e alto retorno — bom primeiro item de qualquer fase de fundação.

## Resolução

Resolvida pelo [plano 001](../tasks/001-higiene-orquestrador.md): `.gitignore` reescrito
com wildcards, sem linhas truncadas nem duplicadas, com `*.apk`, `*.egg-info/` e
`.claude/settings.local.json`. Os padrões de build de VR (`*.pdb`, `*.mdb`) ficaram para
quando o `vr-app` tiver motor definido. Nenhum `.log`, `.zip` ou `.pyc` estava rastreado.
