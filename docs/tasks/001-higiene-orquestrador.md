# 001 — Higiene do orquestrador

| | |
|---|---|
| **Status** | Validado |
| **Fase** | 0 — Fundação de qualidade |
| **Depende de** | nenhum |
| **Dívidas atendidas** | DT-001, DT-004, DT-017 |
| **ADRs relacionadas** | ADR-0001 (submódulos), ADR-0005 |
| **Artefatos afetados** | Orquestrador |
| **Planejado em** | 2026-11-05 |
| **Validado em** | 2026-11-05 por Ciro Macedo |
| **Executado em** | — |

---

## 1. Objetivo

Deixar o repositório orquestrador seguro para uso por vários alunos: `.gitignore` que de
fato ignora o que deve, submódulos que abrem na branch `main` em vez de *detached HEAD*, e
um script de preparação que funciona com HTTPS (login pelo `gh`) ou SSH. É o primeiro
plano porque todos os outros dependem de submódulos que não percam trabalho.

## 2. Leia antes de começar

- `docs/02-artefato-orquestrador.md`
- `docs/implementacoes-futuras/DT-001-gitignore-padroes-quebrados.md`
- `docs/implementacoes-futuras/DT-004-configuracao-submodulos.md`
- `docs/implementacoes-futuras/DT-017-revisao-scripts-ssh.md`

## 3. Estado esperado ao iniciar

Verificado no planejamento (2026-11-05):

- `.gitignore:1-63` — padrões por extensão sem `*` (`.log`, `.zip`, `.py[cod]`), linhas
  truncadas (`.env.`, `.coverage.`) e `!.env.example` duplicado (linhas 6-7).
- `.gitmodules:1-9` — três entradas com apenas `path` e `url`, sem `branch`.
- `scripts/bash/ssh-setup.sh` (52 linhas) e `scripts/posh/ssh-setup.ps1` (65 linhas) com
  comentários depreciativos (ex.: `ssh-setup.sh:18`, `:23`, `:33`; `ssh-setup.ps1:1`,
  `:10`, `:23`, `:39`, `:49`, `:62`) e grafias erradas (`enviroment`, `modyfing`,
  `syncronizing`, `Atleast`).
- O `ssh-setup` aplica `git config --global url."git@github.com:".insteadOf
  "https://github.com/"` **antes** de testar a chave SSH (`ssh-setup.sh:13`). Quem roda o
  script sem chave fica com todo acesso HTTPS ao GitHub quebrado.
- `README.md:21-49` manda rodar o `ssh-setup` como único caminho de preparação.
- Nenhum arquivo `.log`, `.zip` ou `.pyc` está rastreado (`git ls-files`).

## 4. Escopo

**Dentro:**

- reescrever o `.gitignore` da raiz;
- declarar `branch = main` no `.gitmodules`;
- criar `scripts/setup.sh` (preparação independente de protocolo);
- corrigir o `ssh-setup` (bash e PowerShell): comentários, grafia, idioma, ordem do teste;
- atualizar `README.md` e `docs/02-artefato-orquestrador.md`.

**Fora:**

- Docker, compose e scripts de execução — plano 002;
- READMEs dos submódulos (DT-005) — plano 002;
- hooks de Git (`post-checkout`) — não necessários com `setup.sh` + protocolo;
- `git config --global submodule.recurse true` — altera o comportamento de `pull` em todos
  os repositórios do aluno, não só neste; não aplicar.

## 5. Decisões tomadas no planejamento

| Questão | Decisão | Motivo |
|---|---|---|
| Caminho principal de preparação | `scripts/setup.sh`, que não mexe em protocolo | Os alunos autenticam com `gh auth login` (HTTPS); SSH vira opcional |
| Idioma das mensagens dos scripts | Português, sem acentos | Restante do projeto é em português; sem acento evita problema de codificação no console do Windows |
| `ssh-setup` testa a chave antes de reescrever URLs | Sim, a ordem passa a ser: testar SSH → configurar `insteadOf` | Não deixar o Git do aluno quebrado se a chave não existir |
| Versão PowerShell de `setup.sh` | Não criar | Claude Code no Windows usa Git Bash; um único script evita divergência |
| Código de saída de erro no PowerShell | `exit 1` | Convenção de processo; `-1` vira 255 em alguns shells |

## 6. Passos de implementação

### Passo 1 — Reescrever o `.gitignore`

**Arquivo:** `.gitignore` (raiz)

Substitua o conteúdo inteiro por:

```gitignore
# -----------------------------
# Ambientes e segredos locais
# -----------------------------
.env
.env.*
!.env.example

# -----------------------------
# Python
# -----------------------------
__pycache__/
*.py[cod]
.pytest_cache/
.mypy_cache/
.ruff_cache/
.coverage
.coverage.*
htmlcov/
.venv/
venv/
*.egg-info/

# -----------------------------
# Node
# -----------------------------
node_modules/
dist/
build/
coverage/
.vite/
.vite-temp/

# -----------------------------
# Testes ponta a ponta (Playwright)
# -----------------------------
e2e/test-results/
e2e/playwright-report/
e2e/.auth/

# -----------------------------
# Logs e temporários
# -----------------------------
*.log
*.tmp
*.temp
*.bak
*.swp
*.swo
*.orig
*.rej
*~

# -----------------------------
# Sistema e editor
# -----------------------------
.DS_Store
Thumbs.db
.idea/
.vscode/
.vs/
*.suo
*.user

# -----------------------------
# Exportações e artefatos locais
# -----------------------------
*.zip
*.apk
_quarentena/

# -----------------------------
# Agentes de IA (configuração local)
# -----------------------------
.claude/settings.local.json
```

**Verificação:**

```bash
git check-ignore -v teste.log build.zip app/__pycache__/x.pyc .env .env.local
git check-ignore -v .env.example; echo "saida=$?"   # deve imprimir saida=1 (nao ignorado)
```

### Passo 2 — Declarar a branch dos submódulos

**Arquivo:** `.gitmodules`

Acrescente `branch = main` às três entradas, mantendo as URLs HTTPS:

```ini
[submodule "services/vr-app"]
	path = services/vr-app
	url = https://github.com/Tour-VR/vr-app.git
	branch = main
```

(idem para `services/backend` e `services/frontend`)

Depois rode `git submodule sync --recursive`.

**Verificação:** `git config -f .gitmodules --get-regexp branch` lista três linhas `main`.

### Passo 3 — Criar o script de preparação

**Arquivo novo:** `scripts/setup.sh`

Comportamento, nesta ordem:

1. `set -euo pipefail`; `cd` para a raiz do repositório (`git rev-parse --show-toplevel`).
2. `git submodule sync --recursive`.
3. `git submodule update --init --recursive`.
4. Para cada submódulo: `git checkout main` e `git pull --ff-only origin main`
   (`git submodule foreach`).
5. Verificação final: para cada submódulo, `git -C <caminho> branch --show-current` deve
   ser `main`; se algum não for, imprime erro e sai com código 1.
6. Mensagem final em português: submódulos prontos, e o lembrete de que o próximo passo é
   `docker compose up` quando o plano 002 estiver concluído.

Mensagens no padrão `[INFO]`, `[OK]`, `[ERRO]`, em português, sem acentos. Comentários
explicam **por que** cada passo existe (ex.: "submodule update deixa o submodulo em
detached HEAD; o checkout de main evita que commits se percam").

Marque como executável no Git: `git update-index --chmod=+x scripts/setup.sh`.

**Verificação:** em um clone novo em pasta temporária
(`git clone <caminho-local-do-repo> /tmp/teste-001 && cd /tmp/teste-001 && bash
scripts/setup.sh`), os três submódulos terminam em `main`. Apague a pasta depois.

### Passo 4 — Corrigir `scripts/bash/ssh-setup.sh`

**Arquivo:** `scripts/bash/ssh-setup.sh`

- Shebang `#!/usr/bin/env bash`.
- **Remover todos os comentários opinativos** listados na seção 3.
- Corrigir a lógica: o teste `ssh -T git@github.com` passa a vir **antes** do
  `git config --global url...insteadOf`. Se o teste falhar, o script sai sem alterar nada.
- Comentário técnico real no teste: o GitHub responde ao `ssh -T` com código de saída 1 e
  escreve a mensagem de sucesso no fluxo de erro; por isso o script redireciona `2>&1` e
  procura o texto `successfully authenticated`.
- Usar `echo -e` nas linhas com cor (hoje as cores não são interpretadas).
- Mensagens em português sem acentos.
- Ao final, chamar `bash "$(git rev-parse --show-toplevel)/scripts/setup.sh"` em vez de
  repetir `submodule sync/update` — o checkout de `main` passa a acontecer também aqui.

### Passo 5 — Corrigir `scripts/posh/ssh-setup.ps1`

**Arquivo:** `scripts/posh/ssh-setup.ps1`

Mesmas correções do passo 4, adaptadas ao PowerShell: comentários técnicos, grafia,
português, teste de SSH antes do `insteadOf`, `exit 1` nos erros. Para os submódulos,
executar diretamente `git submodule sync --recursive`, `git submodule update --init
--recursive` e `git submodule foreach "git checkout main && git pull --ff-only origin
main"` (sem chamar o `.sh`, para não exigir Git Bash de quem usa PowerShell).

### Passo 6 — Atualizar o README da raiz

**Arquivo:** `README.md`

- Linha 3: trocar "Sistema de turismo virtual para óculos Meta Quest 3" pela descrição
  atual do produto, em uma frase: tour do campus por QR Code no celular e visita
  imersiva 360° no Meta Quest 3 (ver `docs/00-visao-geral.md`).
- Seção "Primeiros passos": caminho principal passa a ser

  ```bash
  gh auth login          # uma vez por computador
  gh auth setup-git
  git clone https://github.com/Tour-VR/quest-project.git
  cd quest-project
  bash scripts/setup.sh
  ```

  e o `ssh-setup` vira uma subseção "Alternativa: SSH".
- Tabela "Composição", linha do `vr-app`: "App do visitante — modo AR (celular) e modo VR
  (Quest 3) — ainda não iniciado".
- Seção "Como o projeto trabalha": acrescentar um parágrafo dizendo que os planos são
  executados por alunos com agentes de IA seguindo `docs/tasks/protocolo-execucao.md`.

### Passo 7 — Atualizar a documentação do orquestrador

**Arquivo:** `docs/02-artefato-orquestrador.md`

- Árvore de "Conteúdo versionado": incluir `scripts/setup.sh`.
- Seção "Scripts de automação": descrever `setup.sh` como caminho principal e o
  `ssh-setup` como alternativa, com a nova ordem (testa a chave antes de alterar a
  configuração global).
- Seção "Configuração dos submódulos": `.gitmodules` declara `branch = main`; o
  `setup.sh` deixa todos em `main`.
- Seção "Estado do `.gitignore`": substituir o aviso por uma descrição curta do que é
  ignorado.
- Atualizar a data de "Última verificação contra o código".

## 7. Testes

Não há testes automatizados no orquestrador ainda (chegam no plano 005). Verificação por
comando:

| Comando | Resultado esperado |
|---|---|
| `git check-ignore -v teste.log build.zip x.pyc .env .env.local` | Uma regra impressa para cada arquivo |
| `git check-ignore .env.example; echo $?` | `1` (não ignorado) |
| `git config -f .gitmodules --get-regexp 'submodule\..*\.branch'` | Três linhas com `main` |
| `bash scripts/setup.sh` em clone novo | Termina com `[OK]`; os 3 submódulos em `main` |
| `bash -n scripts/bash/ssh-setup.sh scripts/setup.sh` | Sem erro de sintaxe |
| `grep -niE "trash|hell|microsoft|ritchie|stop, just" scripts -r` | Nenhum resultado |
| `grep -niE "enviroment|modyfing|syncronizing|atleast" scripts -r` | Nenhum resultado |

## 8. Documentação a atualizar

- [ ] `README.md` — passo 6
- [ ] `docs/02-artefato-orquestrador.md` — passo 7
- [ ] `docs/07-convencoes.md` — seção "Setup inicial em máquina nova": trocar pelo
      caminho do `setup.sh` (com `gh auth login`)
- [ ] `docs/implementacoes-futuras/DT-001-...md`, `DT-004-...md`, `DT-017-...md` — Status
      `Resolvida`, com referência ao plano 001
- [ ] `docs/implementacoes-futuras/README.md` — atualizar o status das três dívidas no índice

## 9. Critérios de aceite

- [ ] Todos os comandos da seção 7 com o resultado esperado
- [ ] Nenhum comentário depreciativo e nenhum erro de grafia nos scripts
- [ ] `ssh-setup` não altera a configuração global do Git quando a chave SSH não funciona
- [ ] Um aluno com repositório recém-clonado chega aos três submódulos em `main` seguindo
      apenas o README
- [ ] Documentação da seção 8 atualizada

## 10. Commits esperados

Todos no orquestrador, branch `plano/001-higiene-orquestrador`:

```
fix: corrige os padroes do .gitignore da raiz
chore: declara a branch main dos submodulos no .gitmodules
feat(scripts): adiciona setup.sh que deixa os submodulos em main
fix(scripts): revisa comentarios, grafia e ordem do ssh-setup
docs: atualiza README, orquestrador e convencoes com o novo setup
docs: marca DT-001, DT-004 e DT-017 como resolvidas
```

## 11. Riscos e pontos de atenção

- **Windows e permissão de execução.** O Git no Windows não guarda o bit executável pelo
  sistema de arquivos; por isso o passo 3 usa `git update-index --chmod=+x`.
- **Fim de linha.** Scripts `.sh` com CRLF quebram no Bash. Se o editor gravar CRLF,
  acrescente `*.sh text eol=lf` em um `.gitattributes` na raiz (único caso em que esse
  arquivo pode ser criado neste plano).
- **Teste em clone novo** não pode usar a pasta do aluno: use pasta temporária e apague-a.

## 12. Verificação pelo aluno

Depois que o agente terminar, confira com os próprios olhos:

1. Abra o arquivo `.gitignore` no VS Code: as linhas de extensão começam com `*`
   (por exemplo `*.log`).
2. No terminal do VS Code, rode `bash scripts/setup.sh`. A última linha deve ser
   `[OK]` dizendo que os submódulos estão prontos.
3. Rode `git -C services/backend branch --show-current`. Deve aparecer `main`.
4. Abra os PRs no navegador e confira que a descrição lista o que mudou.

---

## Prompt de delegação

Cole no Claude Code, na pasta `quest-project`, trocando o nome:

```text
Você é a sessão de EXECUÇÃO do projeto TourVR.
Execute o plano docs/tasks/001-higiene-orquestrador.md.
Antes de qualquer ação, leia docs/tasks/protocolo-execucao.md e siga o "Prompt 1 — EXECUTAR" etapa por etapa.
Meu nome, para registrar no plano: <SEU NOME>
```
