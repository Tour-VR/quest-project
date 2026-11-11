# DT-018 — Duplicação de código no backend

| | |
|---|---|
| **Status** | Aberta |
| **Prioridade** | P3 |
| **Esforço** | Baixo |
| **Artefato** | Backend |
| **Registrada em** | 2026-11-11 |
| **Depende de** | nada |

## Contexto

O `jscpd`, que o `scripts/validate.sh` passou a rodar no plano 005, encontrou dois trechos
repetidos no backend. Juntos somam 2,49% das linhas Python (2,75% dos tokens), perto do
limite de 3% que reprova a validação. O total do projeto hoje é 1,5%.

## Evidência

```
services/backend/app/api/v1/routes/users.py:43-54  ≈ :65-76
  mesmo bloco try/except traduzindo UserInputError → 400, UserNotFoundError → 404,
  ConnectionError → 503 nas rotas PATCH /users/me e PUT /users/me/password

services/backend/app/schemas/user.py:53-66  ≈ :87-100
  mesmos validadores normalize_full_name e validate_username em UserCreate e UserUpdateMe
```

## Impacto

Cada nova rota de usuário ou schema com nome e username tende a copiar o mesmo bloco. Com
mais duas ou três cópias, a etapa `duplicacao` do `validate.sh` passa a reprovar todo PR
do projeto, inclusive os que não mexem no backend.

## Proposta

- Extrair a tradução de exceções de domínio para uma função em `app/api/deps.py` (ou um
  módulo `app/api/errors.py`), usada pelas rotas.
- Extrair os validadores comuns para uma classe base (por exemplo `UserProfileFields`)
  herdada por `UserCreate` e `UserUpdateMe`.

## Critérios de aceite

- [ ] `npx --yes jscpd@4 --config .jscpd.json services/backend/app` não encontra clones
- [ ] `pytest --cov=app --cov-fail-under=80` continua passando

## Notas

Encontrada durante a execução do plano 005; corrigir estava fora do escopo daquele plano.
