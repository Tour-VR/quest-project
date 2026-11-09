# 07 — Convenções do Projeto

> Aplicam-se a todos os repositórios do TourVR.
> Última atualização: 2026-11-09

## Idioma

| Elemento | Idioma |
|---|---|
| Documentação (`docs/`, READMEs) | Português |
| Comentários e docstrings | Português |
| Mensagens de commit | Português |
| Nomes de código (variáveis, funções, classes, rotas) | Inglês |
| Mensagens de erro exibidas ao usuário final | Português |

O código Python existente escreve docstrings em português **sem acentuação**
(`"Configuracao central..."`). Manter esse padrão dentro do backend por consistência
interna. A documentação em `docs/` usa acentuação normal.

Nomes de arquivo e de diretório: **sem acentos e sem espaços**, em `kebab-case`. Isso
evita problemas de codificação entre Windows, Linux e ferramentas de CI.

---

## Git

### Mensagens de commit

Formato *Conventional Commits*:

```
<tipo>(<escopo opcional>): <descrição no imperativo>
```

Tipos aceitos: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`, `build`, `ci`.

```
feat(auth): adiciona rota de troca de senha
fix(frontend): trata 401 expirado no interceptor de resposta
docs: registra contrato da API em docs/06-contrato-api.md
```

Commits como `dsadsa` ou `ajuda joão` existem no histórico e **não devem se repetir**.

### Branches

- `main` é a branch de integração de todos os repositórios.
- Trabalho novo em branch descritiva: `feat/dominio-turismo`, `fix/gitignore-padroes`.
- Não commitar direto em `main` sem revisão, salvo correções triviais de documentação.

### Trabalhando com submódulos

⚠️ **Ponto de atenção mais perigoso do projeto.** Após `git submodule update`, os
submódulos ficam em *detached HEAD*. Commits feitos nesse estado não pertencem a nenhuma
branch e são perdidos na próxima atualização.

**Antes de editar qualquer coisa dentro de `services/`:**

```bash
cd services/backend
git checkout main
git pull origin main
```

**Ao terminar** — o submódulo é commitado primeiro, o orquestrador depois:

```bash
# 1. no submódulo
cd services/backend
git add .
git commit -m "feat(auth): ..."
git push origin main

# 2. no orquestrador — registra o novo ponteiro
cd ../..
git add services/backend
git commit -m "chore: atualiza ponteiro do submódulo backend"
git push
```

**Setup inicial em máquina nova:**

```bash
gh auth login          # uma vez por computador (GitHub.com → HTTPS → navegador)
gh auth setup-git
git clone https://github.com/Tour-VR/quest-project.git
cd quest-project
bash scripts/setup.sh  # baixa os submódulos e deixa todos em main
```

Quem prefere SSH usa `bash scripts/bash/ssh-setup.sh` (ou `.\scripts\posh\ssh-setup.ps1`
no PowerShell) no lugar do `setup.sh`. Detalhes em
[02-artefato-orquestrador.md](02-artefato-orquestrador.md#scripts-de-automação).

**Atalho útil** para propagar tudo de uma vez (usar com atenção, não substitui commitar
no submódulo):

```bash
git push --recurse-submodules=on-demand
```

---

## Backend — Python

- **Camadas.** Rota → Service → Repository → MongoDB. Nunca pular uma camada.
- **Exceções.** Service levanta exceção de domínio (`UserInputError`, `UserConflictError`,
  `AuthenticationError`, `UserNotFoundError`); a rota traduz para `HTTPException`.
  Service **não** conhece HTTP.
- **Repositório.** Só query. Traduz `PyMongoError` em `ConnectionError`; a rota traduz
  `ConnectionError` em `503` via `build_database_http_exception`.
- **Configuração.** Sempre via `app.core.config.settings`. Proibido `os.environ` direto.
- **Modelo × schema.** `models/` = documento persistido. `schemas/` = contrato HTTP.
  Não fundir os dois.
- **Senhas.** Nunca aparecem em resposta. Schemas de saída herdam de `UserResponse`, que
  não possui campo de senha — manter essa herança para novos schemas de usuário.
- **Tipagem.** `from __future__ import annotations` no topo; anotar parâmetros e retornos.
- **Nomes.** `snake_case` para funções e variáveis, `PascalCase` para classes.
- **Verificação mínima antes do commit:** `ruff check .`, `ruff format --check .`,
  `mypy app`, `pytest --cov=app --cov-fail-under=80` (em `services/backend`, com
  `requirements-dev.txt` instalado).
- **Testes.** Toda rota nova precisa de teste de caminho feliz, de erro de validação e de
  banco indisponível. MongoDB sempre mockado — testes não dependem de banco real.

## Frontend — TypeScript / React

- **Componentes** em `PascalCase`, exportados nomeadamente (`export function Login()`).
  Exceção: `App.tsx` usa `export default`.
- **Arquivos** de componente e página em `PascalCase.tsx`; utilitários em `camelCase.ts`.
- **HTTP.** Toda chamada usa a instância `api` de `services/api.ts`. Nunca `fetch` ou
  `axios` cru — perde `baseURL` e o header de autenticação.
- **Sessão.** Somente via `useAuth()`. Nenhum componente lê `localStorage` diretamente.
- **Tipos.** Contratos da API em `src/types/`, espelhando
  [06-contrato-api.md](06-contrato-api.md).
- **Estilo.** Tailwind por classes utilitárias no JSX. Sem CSS-in-JS, sem arquivos `.css`
  por componente.
- **Estado.** `useState` local e Context para estado global. Não introduzir Redux,
  Zustand ou similar sem ADR.
- **Verificação mínima antes do commit:** `npm run lint` (`tsc --noEmit`) deve passar.

---

## Documentação

- Base de conhecimento em `docs/`, na raiz do orquestrador. **Não** espalhar documentação
  de arquitetura pelos READMEs dos submódulos — eles ficam com instruções operacionais
  mínimas e apontam para `docs/`.
- Documento descreve o que **existe**, com evidência em `arquivo:linha`. Intenção vai
  para `docs/implementacoes-futuras/`; decisão vai para `docs/08-decisoes-arquiteturais.md`.
- Alterou comportamento, atualiza a documentação **no mesmo commit**.
- Não criar arquivo vazio como placeholder.

## Segurança — regras não negociáveis

1. `.env` nunca é versionado. Alterou variável, atualize o `.env.example` correspondente.
2. Segredo real nunca entra em código, documentação, issue ou mensagem de commit.
3. Mensagens de erro de autenticação não revelam se uma conta existe.
4. Senha nunca é registrada em log nem retornada em resposta.
5. `APP_DEBUG=false` obrigatório em qualquer ambiente que não seja a máquina local.
