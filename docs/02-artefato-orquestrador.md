# 02 — Artefato: Repositório Orquestrador (`quest-project`)

> Repositório: `github.com/Tour-VR/quest-project` · Branch principal: `main`
> Última verificação contra o código: 2026-08-20

## Responsabilidade

Agregar os três submódulos, hospedar a base de conhecimento e centralizar a automação de
setup, build e execução do ambiente completo.

**Hoje cumpre apenas duas dessas funções** (agregação e documentação). A automação
existente cobre somente a configuração de SSH — não há build, execução nem teste
orquestrados. Registrado como [DT-002](implementacoes-futuras/DT-002-orquestracao-ambiente-local.md).

## Conteúdo versionado

```
quest-project/
├── .gitmodules            declaração dos 3 submódulos (URLs HTTPS)
├── .gitignore             padrões globais — ⚠️ ver DT-001
├── LICENSE                MIT, "Copyright (c) 2026 Tour VR"
├── README.md              porta de entrada do projeto
├── CLAUDE.md              instruções de carga de contexto para agentes de IA
├── docs/                  base de conhecimento (este diretório)
├── scripts/
│   ├── bash/ssh-setup.sh      (52 linhas)
│   └── posh/ssh-setup.ps1     (64 linhas)
└── services/
    ├── backend/    → submódulo
    ├── frontend/   → submódulo
    └── vr-app/     → submódulo
```

## Scripts de automação

`scripts/bash/ssh-setup.sh` e `scripts/posh/ssh-setup.ps1` são equivalentes funcionais
para Linux/macOS/Git-Bash e Windows PowerShell. Ambos executam a mesma sequência:

1. Configuram `git config --global url."git@github.com:".insteadOf "https://github.com/"`
   — faz o Git reescrever automaticamente URLs HTTPS para SSH, inclusive as dos submódulos;
2. Testam a conexão com `ssh -T git@github.com`, abortando com instrução de
   `ssh-keygen -t ed25519` se falhar;
3. `git submodule sync --recursive`;
4. `git submodule update --init --recursive`;
5. Reescrevem a URL do `origin` local para SSH, se ainda estiver em HTTPS.

**Uso:**

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

## Configuração dos submódulos

O `.gitmodules` declara apenas `path` e `url`, sem `branch`. Consequência prática: após
`git submodule update`, cada submódulo fica em **detached HEAD** no commit fixado. Quem
editar código dentro de `services/` sem antes fazer `git checkout main` no submódulo
corre risco real de perder trabalho.

Procedimento correto documentado em [07-convencoes.md](07-convencoes.md#trabalhando-com-submódulos).
Correção estrutural pendente em [DT-004](implementacoes-futuras/DT-004-configuracao-submodulos.md).

## Estado do `.gitignore`

⚠️ **O `.gitignore` da raiz está funcionalmente quebrado.** Os padrões foram escritos sem
o `*` inicial — `.log` em vez de `*.log`, `.zip` em vez de `*.zip`, `.py[cod]` em vez de
`*.py[cod]`. Na sintaxe do Git isso casa apenas com arquivos cujo nome é literalmente
`.log`, e não com `servidor.log`. Arquivos de log, dumps e artefatos compilados **não
estão sendo ignorados**. Detalhes e correção em
[DT-001](implementacoes-futuras/DT-001-gitignore-padroes-quebrados.md).

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
