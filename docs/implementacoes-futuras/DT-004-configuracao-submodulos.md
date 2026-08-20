# DT-004 — Submódulos sem branch declarada (risco de perda de trabalho)

| | |
|---|---|
| **Status** | Aberta |
| **Prioridade** | P1 |
| **Esforço** | Baixo |
| **Artefato** | Orquestrador |
| **Registrada em** | 2026-08-20 |
| **Depende de** | nada |

## Contexto

O `.gitmodules` declara apenas `path` e `url` para os três submódulos, sem `branch`. Após
`git submodule update --init --recursive`, cada submódulo fica em *detached HEAD* no
commit fixado. Um aluno que abra `services/backend`, edite código e commite estará criando
commits que não pertencem a nenhuma branch — e que desaparecem no próximo
`git submodule update`.

Há ainda uma inconsistência de protocolo: o `.gitmodules` usa URLs HTTPS enquanto os
scripts de setup reescrevem tudo para SSH via `insteadOf`. Funciona, mas confunde quem lê.

## Evidência

`.gitmodules`:

```ini
[submodule "services/vr-app"]
	path = services/vr-app
	url = https://github.com/Tour-VR/vr-app.git
```

Estado verificado dos submódulos — `git -C services/backend branch --show-current` retorna
vazio, indicando detached HEAD.

## Impacto

- **Perda real de trabalho.** É o modo de falha mais provável e mais custoso deste
  projeto, especialmente com alunos sem experiência prévia em submódulos.
- `git submodule update --remote` não funciona como esperado sem `branch` declarada.
- O diagnóstico é difícil para quem não conhece o mecanismo — o trabalho simplesmente
  "some", sem mensagem de erro.

## Proposta

1. Acrescentar `branch = main` às três entradas do `.gitmodules`.
2. Executar `git submodule sync --recursive` e commitar.
3. Estender os scripts `ssh-setup` com um `git submodule foreach` que faça checkout de
   `main` ao final, deixando todos os submódulos em branch por padrão.
4. Considerar `git config --global submodule.recurse true` no script, para que `pull` e
   `checkout` propaguem automaticamente.
5. Reforçar o procedimento em `docs/07-convencoes.md` (já documentado) e mencioná-lo no
   README da raiz.

## Critérios de aceite

- [ ] `.gitmodules` declara `branch = main` para os três submódulos
- [ ] Após rodar o script de setup em clone novo, cada submódulo está na branch `main`
- [ ] `git submodule update --remote` traz o último commit de `main` de cada submódulo

## Notas

Avaliar também um hook `post-checkout` que avise quando um submódulo estiver em detached
HEAD. Barato de implementar e evita o erro na origem.
