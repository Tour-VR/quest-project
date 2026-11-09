# 02 — Artefato: Repositório Orquestrador (`quest-project`)

> Repositório: `github.com/Tour-VR/quest-project` · Branch principal: `main`
> Última verificação contra o código: 2026-11-09

## Responsabilidade

Agregar os três submódulos, hospedar a base de conhecimento e centralizar a automação de
setup, build e execução do ambiente completo.

**Hoje cumpre apenas duas dessas funções** (agregação e documentação). A automação
existente cobre somente a preparação dos submódulos e do acesso — não há build, execução nem teste
orquestrados. Registrado como [DT-002](implementacoes-futuras/DT-002-orquestracao-ambiente-local.md).

## Conteúdo versionado

```
quest-project/
├── .gitmodules            declaração dos 3 submódulos (URLs HTTPS, branch main)
├── .gitignore             padrões globais
├── .gitattributes         força fim de linha LF nos scripts .sh
├── LICENSE                MIT, "Copyright (c) 2026 Tour VR"
├── README.md              porta de entrada do projeto
├── CLAUDE.md              instruções de carga de contexto para agentes de IA
├── docs/                  base de conhecimento (este diretório)
├── scripts/
│   ├── setup.sh               (54 linhas) — preparação principal
│   ├── bash/ssh-setup.sh      (58 linhas) — alternativa SSH
│   └── posh/ssh-setup.ps1     (80 linhas) — alternativa SSH no PowerShell
└── services/
    ├── backend/    → submódulo
    ├── frontend/   → submódulo
    └── vr-app/     → submódulo
```

## Scripts de automação

### `scripts/setup.sh` — caminho principal

Prepara o repositório sem mexer no protocolo de acesso: usa o login HTTPS feito com
`gh auth login` + `gh auth setup-git`. Sequência (`scripts/setup.sh:18-54`):

1. vai para a raiz do repositório (`git rev-parse --show-toplevel`);
2. `git submodule sync --recursive`;
3. `git submodule update --init --recursive`;
4. `git submodule foreach 'git checkout main && git pull --ff-only origin main'`;
5. confere que cada submódulo está em `main`; se algum não estiver, sai com código 1;
6. termina com `[OK] Submodulos prontos: todos na branch main.`

Mensagens em português, sem acentos, no padrão `[INFO]`, `[OK]`, `[ERRO]`.

```bash
bash scripts/setup.sh
```

### `ssh-setup` — alternativa SSH

`scripts/bash/ssh-setup.sh` e `scripts/posh/ssh-setup.ps1` são para quem prefere acessar
o GitHub por SSH. Ambos executam a mesma sequência:

1. Testam a conexão com `ssh -T git@github.com` **antes de qualquer alteração**. Se a
   chave não funcionar, saem com código 1 sem mudar a configuração do Git
   (`ssh-setup.sh:29-38`). O GitHub responde ao `ssh -T` com código 1 e escreve a mensagem
   de sucesso no fluxo de erro; por isso o teste procura o texto `successfully
   authenticated` na saída redirecionada.
2. Configuram `git config --global url."git@github.com:".insteadOf "https://github.com/"`
   — faz o Git reescrever automaticamente URLs HTTPS para SSH, inclusive as dos submódulos;
3. Reescrevem a URL do `origin` local para SSH, se ainda estiver em HTTPS;
4. Preparam os submódulos: a versão Bash chama `scripts/setup.sh`; a versão PowerShell
   repete os mesmos comandos (sync, update, checkout de `main`) para não exigir Git Bash.

```bash
# Linux / macOS / Git Bash
bash scripts/bash/ssh-setup.sh
```

```powershell
# Windows PowerShell
.\scripts\posh\ssh-setup.ps1
```

**Pré-requisito:** chave SSH gerada e registrada na conta GitHub com acesso à
organização `Tour-VR`.

### Fim de linha

O `.gitattributes` força LF nos arquivos `.sh`. Sem isso, um Git no Windows com
`core.autocrlf=true` grava os scripts com CRLF e o Bash falha ao executá-los.

## Configuração dos submódulos

O `.gitmodules` declara `path`, `url` (HTTPS) e `branch = main` para os três submódulos
(`.gitmodules:1-12`). Com a branch declarada, `git submodule update --remote` sabe de qual
branch buscar.

O `git submodule update` comum, porém, continua deixando cada submódulo em **detached
HEAD** no commit fixado. O `scripts/setup.sh` resolve isso fazendo `git checkout main` em
todos ao final. Quem rodar `git submodule update` por conta própria precisa repetir o
`setup.sh` ou fazer o checkout de `main` antes de editar dentro de `services/`. Procedimento
em [07-convencoes.md](07-convencoes.md#trabalhando-com-submódulos).

## `.gitignore`

O `.gitignore` da raiz ignora (`.gitignore:1-74`):

- segredos locais: `.env` e `.env.*`, exceto `.env.example`;
- artefatos Python (`__pycache__/`, `*.py[cod]`, caches de ferramentas, `.venv/`) e Node
  (`node_modules/`, `dist/`, `build/`, `coverage/`);
- resultados dos testes ponta a ponta (`e2e/test-results/`, `e2e/playwright-report/`);
- logs, temporários e arquivos de editor/sistema (`*.log`, `*.tmp`, `.vscode/`, `.DS_Store`);
- exportações (`*.zip`, `*.apk`) e a configuração local de agentes de IA
  (`.claude/settings.local.json`).

## Histórico

8 commits, entre 2026-03-24 e 2026-03-29. Contribuintes: João Lucas, joãoaura, hzera556,
Felipe, lorenz.

## Ausências

| Item | Situação |
|---|---|
| `docker-compose.yml` | 🔴 Não existe — ver DT-002 |
| Scripts de install/run/test | 🔴 Não existem, mas são citados pelos READMEs dos submódulos — ver DT-005 |
| CI/CD (`.github/workflows/`) | 🔴 Não existe — ver DT-003 |
| Versionamento/release do conjunto | 🔴 Não definido |
