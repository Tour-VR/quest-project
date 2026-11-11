# Protocolo de execução de planos

> **Para o agente de IA.** Se você recebeu um prompt pedindo para executar, corrigir ou
> fechar um plano de `docs/tasks/`, este documento é a sua instrução principal. Siga as
> etapas **na ordem**, sem pular nenhuma. Quem conversa com você é um aluno que **não
> programa**: explique o que está fazendo em português simples e nunca peça a ele que
> edite código à mão.

Formaliza o ciclo da [ADR-0005](../08-decisoes-arquiteturais.md) para uma turma que
executa os planos com agentes de IA, em revezamento, com revisão por Pull Request.

---

## Visão geral

```
Plano Validado ──► [Prompt 1: EXECUTAR] ──► Em execução ──► PRs abertos ──► Em revisão
                                                                              │
                         ┌─── revisor pede ajuste ◄──────────────────────────┤
                         ▼                                                    │
                [Prompt 2: CORRIGIR] ──► PRs atualizados ──► Em revisão       │
                                                                              ▼
                                                     revisor faz o merge de todos os PRs
                                                                              │
                                                          [Prompt 3: FECHAR]  ▼
                                                                         Concluído
```

**Status possíveis de um plano:** `Validado` → `Em execução` → `Em revisão` → `Concluído`.
Também existem `Rascunho`, `Aguardando validação` e `Cancelado`.

**Quem faz o quê**

| Papel | Responsabilidade |
|---|---|
| Aluno | Escolhe o plano, cola o prompt, acompanha, confere o resultado no navegador, avisa no grupo |
| Agente (você) | Lê, reserva, implementa, testa, documenta, abre os PRs, corrige, fecha |
| Orientador | Revisa e faz o merge dos PRs |

---

## Regras invioláveis

1. **Nunca commitar em *detached HEAD*.** Antes de editar qualquer arquivo em `services/`,
   o submódulo precisa estar numa branch (`git branch --show-current` não pode ser vazio).
2. **Nunca usar** `git push --force`, `git reset --hard` em trabalho de outra pessoa,
   `--no-verify` ou qualquer comando que reescreva histórico remoto.
3. **Nunca commitar** `.env`, senhas, tokens, `node_modules/`, `.venv/`, arquivos de build.
4. **Nunca redecidir arquitetura.** O plano já decidiu. Se algo no plano estiver errado ou
   impossível, **pare** e explique ao aluno o que encontrou (ver "Quando parar").
5. **Nunca ampliar o escopo.** Encontrou um problema fora do plano? Registre-o em
   `docs/implementacoes-futuras/` seguindo `_template.md` e siga com o plano.
6. **Nunca editar outro plano** além do que você está executando (exceto o índice
   `docs/tasks/README.md`, nas linhas do seu plano).
7. **Nunca fazer merge** de Pull Request. Merge é do orientador.
8. **Commits em português**, no formato *Conventional Commits* (`docs/07-convencoes.md`),
   terminando com a linha de coautoria que o seu ambiente indicar.

---

## Prompt 1 — EXECUTAR um plano

### Etapa 1 — Preparar o repositório

Execute na raiz do orquestrador (`quest-project`), usando Git Bash:

```bash
git status                      # precisa estar limpo; se não estiver, PARE e mostre ao aluno
git checkout main
git pull origin main
git submodule update --init --recursive
git submodule foreach 'git checkout main && git pull origin main'
gh auth status                  # precisa estar autenticado; se não, PARE (ver "Quando parar")
```

### Etapa 2 — Verificar se o plano pode ser executado

Leia `docs/tasks/README.md` (índice) e o arquivo do plano. O plano só pode ser executado se:

- o status dele no índice for **`Validado`**;
- todos os planos listados na coluna **Depende de** estiverem **`Concluído`**.

Se o plano já estiver `Em execução`, `Em revisão` ou `Concluído`, ou se alguma dependência
não estiver `Concluído`: **não execute**. Diga ao aluno, em uma frase, qual o motivo e qual
é o **menor número de plano disponível** (status `Validado` com todas as dependências
`Concluído`). Se não houver nenhum disponível, diga isso.

### Etapa 3 — Reservar o plano

A reserva evita que dois alunos executem o mesmo plano.

1. No arquivo do plano, troque a linha de status para
   `| **Status** | Em execução — <nome do aluno> — <AAAA-MM-DD> |`.
2. No índice `docs/tasks/README.md`, troque o status da linha do plano para
   `Em execução — <nome do aluno>`.
3. Commite **direto na `main` do orquestrador** (exceção permitida: é só um registro de
   documentação) e envie:

```bash
git add docs/tasks/README.md docs/tasks/NNN-*.md
git commit -m "docs(tasks): reserva o plano NNN para <nome>"
git push origin main
```

Se o `push` for recusado, faça `git pull --rebase origin main` e **repita a Etapa 2**:
outro aluno pode ter reservado o mesmo plano segundos antes. Se foi isso, desfaça a sua
alteração local (`git rebase --abort` ou `git checkout -- <arquivo>`), avise o aluno e
indique outro plano disponível.

### Etapa 4 — Carregar o contexto

Leia, nesta ordem e por completo:

1. `docs/07-convencoes.md`
2. `docs/01-arquitetura.md`
3. `docs/tasks/000-visao-macro-opcao-b.md` — especialmente a seção **Decisões transversais**
4. **O plano inteiro**
5. Todo documento que o plano listar em "Leia antes de começar"

Depois, confira a seção **Estado esperado ao iniciar** do plano contra o código real. Se o
código estiver diferente do esperado de um jeito que impeça seguir os passos, **pare**.

### Etapa 5 — Criar as branches

Em **cada repositório que o plano altera** (submódulos e, sempre, o orquestrador), crie a
mesma branch a partir da `main` atualizada:

```bash
git checkout -b plano/NNN-slug        # mesmo nome em todos os repositórios
```

O `slug` é o nome do arquivo do plano sem o número e sem `.md`.

### Etapa 6 — Implementar

Execute a seção **Passos de implementação** do plano **na ordem**. Para cada passo:

- faça exatamente o que o passo descreve, nos arquivos indicados;
- rode a verificação do passo, quando houver;
- faça um commit pequeno no repositório onde o passo aconteceu, com a mensagem sugerida
  na seção **Commits esperados** do plano (ou equivalente no mesmo padrão).

Mantenha o aluno informado com frases curtas: "Passo 3 de 8 concluído: criei a tela de
login com os testes passando".

### Etapa 7 — Validar

1. Rode os comandos da seção **Testes** do plano e confirme que tudo passa.
2. Se `scripts/validate.sh` já existir no orquestrador, rode `bash scripts/validate.sh`.
   Ele precisa terminar com código de saída 0. Se o plano pedir E2E e o Docker não estiver
   disponível na máquina do aluno, rode `bash scripts/validate.sh --skip-e2e`, e registre
   isso no PR.
3. Percorra a seção **Critérios de aceite** item por item. Todos precisam estar satisfeitos.

Se um teste falhar, corrija **dentro do escopo do plano**. Não desligue regra de lint, não
reduza limite de cobertura, não marque teste como `skip` para fazer passar.

### Etapa 8 — Documentar

Atualize todos os documentos da seção **Documentação a atualizar** do plano. Documentação vive no orquestrador, na
mesma branch `plano/NNN-slug`. Atualize também:

- no arquivo do plano: status `Em revisão — <nome>`, a linha **Executado em** com a data, e
  uma seção final **Registro de execução** com: o que foi feito, desvios do plano (se houve)
  e dívidas novas registradas;
- no índice `docs/tasks/README.md`: status `Em revisão — <nome>`.

### Etapa 9 — Abrir os Pull Requests

Envie as branches e abra um PR em cada repositório alterado:

```bash
git push -u origin plano/NNN-slug
gh pr create --base main --head plano/NNN-slug \
  --title "[NNN] <título do plano>" --body-file <arquivo temporário com o corpo>
```

Abra primeiro os PRs dos submódulos e por último o do orquestrador, para poder citar os
links. O corpo de **cada** PR segue este modelo:

```markdown
## Plano
[NNN — título](https://github.com/Tour-VR/quest-project/blob/plano/NNN-slug/docs/tasks/NNN-slug.md)
Executado por: <nome do aluno>

## O que mudou
- (lista curta, uma linha por mudança relevante)

## PRs deste plano — ordem de merge
1. <link do PR do submódulo>
2. <link do PR do orquestrador>   ← por último

## Como foi verificado
<saída real e resumida dos testes e do validate.sh>

## Critérios de aceite
- [x] (copiar a seção Critérios de aceite do plano, marcados)

## Desvios do plano
Nenhum. (ou a lista, com justificativa)
```

Espere `gh pr checks --watch` ficar verde antes do relatório ao aluno; se falhar, corrija.

### Etapa 10 — Relatório ao aluno

Termine com uma mensagem curta, em português simples, contendo:

1. **Primeira linha:** "Plano NNN pronto para revisão." (ou o motivo de não estar);
2. os links dos PRs;
3. o roteiro da seção **Verificação pelo aluno** do plano, para ele conferir com os
   próprios olhos;
4. a mensagem pronta para ele colar no grupo:
   `Plano NNN (<título>) em revisão — PRs: <links>`.

---

## Prompt 2 — CORRIGIR após revisão

O orientador comentou nos PRs pedindo ajustes.

1. Etapa 1 deste protocolo (preparar), e então `git checkout plano/NNN-slug` em cada
   repositório do plano, seguido de `git pull`.
2. Leia **todos** os comentários: `gh pr view <número> --comments` em cada PR, e também os
   comentários de revisão em linha: `gh api repos/Tour-VR/<repo>/pulls/<número>/comments`.
3. Aplique cada ajuste pedido. Se um pedido contradisser o plano, siga o pedido do
   orientador: ele é quem valida o plano.
4. Etapa 7 (validar) de novo.
5. Commit `fix: atende revisão do PR` (ou mais específico), `git push`.
6. Responda no PR com um comentário curto listando o que foi ajustado
   (`gh pr comment <número> --body "..."`).
7. Relatório ao aluno: o que foi ajustado e a mensagem para o grupo:
   `Plano NNN: ajustes da revisão aplicados — PRs: <links>`.

---

## Prompt 3 — FECHAR um plano após o merge

O orientador já fez o merge de **todos** os PRs do plano.

1. Confirme: `gh pr view <número> --json state` deve dar `MERGED` em cada PR. Se algum não
   estiver, **pare** e diga ao aluno qual falta.
2. Atualize tudo:

```bash
git checkout main && git pull origin main
git submodule update --init --recursive
git submodule foreach 'git checkout main && git pull origin main'
```

3. Os submódulos agora estão na última `main`. Registre os ponteiros no orquestrador:
   `git add services/<cada submódulo alterado pelo plano>`.
4. No arquivo do plano: status `Concluído`, preencha **Executado em** com a data e os links
   dos PRs. No índice `docs/tasks/README.md`: status `Concluído`.
5. Em `docs/tasks/000-visao-macro-opcao-b.md`, tabela **Planos filhos**: status `Concluído`.
6. Commit direto na `main` do orquestrador e envie:

```bash
git commit -m "chore(tasks): conclui o plano NNN e atualiza ponteiros dos submódulos"
git push origin main
```

7. Apague as branches locais `plano/NNN-slug` (`git branch -d`).
8. Relatório ao aluno: "Plano NNN concluído." e a mensagem para o grupo:
   `Plano NNN concluído. Próximo disponível: <número e título>` — calcule qual é o próximo
   pela regra da Etapa 2.

---

## Prompt 4 — RETOMAR uma execução interrompida

A sessão anterior caiu, o computador desligou, ou o aluno fechou o VS Code no meio.

1. Etapa 1 **sem** o `git submodule foreach ... checkout main` — você precisa ver o estado
   atual, não sobrescrevê-lo.
2. Em cada repositório, verifique a branch atual, `git status` e `git log --oneline -10`.
3. Leia o plano e descubra quais passos já foram commitados na branch `plano/NNN-slug`.
4. Continue da etapa em que parou. Não refaça passos já commitados.

---

## Quando parar e chamar o aluno

Pare, explique em linguagem simples e diga o que ele deve fazer, nos casos abaixo:

| Situação | O que dizer ao aluno |
|---|---|
| `gh auth status` falha | Rodar `gh auth login` no terminal (GitHub.com → HTTPS → login pelo navegador) e depois `gh auth setup-git` |
| `git push` dá erro de permissão (403) | A conta dele não tem acesso de escrita à organização `Tour-VR`; avisar o orientador |
| `git status` sujo na Etapa 1 | Mostrar os arquivos e perguntar se são dele; nunca descartar sem confirmação |
| Docker não instalado ou parado | Abrir o Docker Desktop e esperar ficar "running"; repetir |
| Código diferente do "Estado esperado ao iniciar" | Explicar a diferença; ele deve avisar no grupo antes de continuar |
| Passo do plano impossível ou contraditório | Explicar; ele deve avisar o orientador. Não improvisar |
| Teste falha e a correção sairia do escopo | Explicar; registrar dívida; avisar no grupo |

---

## Como escrever para o aluno

- Frases curtas. Primeiro o resultado, depois o detalhe.
- Sem jargão sem explicação: em vez de "rebase conflitou", diga "outra pessoa alterou o
  mesmo arquivo; preciso juntar as duas versões".
- Sempre termine dizendo **qual é o próximo passo dele**.
