# DT-002 — Ambiente local não é orquestrado

| | |
|---|---|
| **Status** | Aberta |
| **Prioridade** | P1 |
| **Esforço** | Médio |
| **Artefato** | Orquestrador |
| **Registrada em** | 2026-08-20 |
| **Depende de** | nada |

## Contexto

O `quest-project` se propõe a ser o repositório orquestrador, responsável pelo processo de
build e instalação dos submódulos. Hoje sua automação cobre apenas a configuração de SSH.
Não existe forma de subir o sistema completo com um comando: cada desenvolvedor precisa
instalar MongoDB manualmente, criar o virtualenv do backend, rodar `npm install` no
frontend e iniciar dois processos em terminais separados, seguindo instruções espalhadas
por dois READMEs — que citam scripts inexistentes.

## Evidência

```
scripts/bash/ssh-setup.sh     ← única automação existente
scripts/posh/ssh-setup.ps1
```

Não existem, em nenhum repositório: `docker-compose.yml`, `Makefile`, `Taskfile.yml`.

Os READMEs dos submódulos instruem a executar `.\scripts\install-backend.ps1`,
`.\scripts\run-backend.ps1` e `.\scripts\test-backend.ps1` — **nenhum desses arquivos
existe** (ver [DT-005](DT-005-sincronizacao-documentacao-codigo.md)).

O MongoDB é pressuposto como já instalado e rodando na máquina do desenvolvedor.

## Impacto

- Onboarding de um aluno novo leva horas e falha de formas diferentes em cada máquina.
- "Funciona no meu computador" vira o modo padrão de operação.
- Sem MongoDB local padronizado, a versão do banco varia entre desenvolvedores.
- Impede CI ([DT-003](DT-003-pipeline-ci-cd.md)): não há descrição executável do ambiente.

## Proposta

1. **`docker-compose.yml` na raiz** com três serviços: `mongo` (com volume nomeado),
   `backend` (usando o `Dockerfile` existente, com hot-reload em desenvolvimento) e
   `frontend` (imagem Node com `npm run dev`).
2. **`.env.example` na raiz** consolidando as variáveis do conjunto, com o compose
   distribuindo o que cada serviço precisa.
3. **Scripts de conveniência** em `scripts/bash/` e `scripts/posh/` para as operações
   frequentes: `up`, `down`, `logs`, `test`, `reset-db`.
4. **Alternativa sem Docker** documentada, para quem não puder usá-lo — mas não como
   caminho principal.
5. Atualizar `docs/02-artefato-orquestrador.md` com o procedimento resultante.

## Critérios de aceite

- [ ] `docker compose up` sobe MongoDB, backend e frontend, com o frontend autenticando
      contra o backend com sucesso
- [ ] Alterações em código do backend e do frontend recarregam sem rebuild da imagem
- [ ] Dados do MongoDB persistem entre `down` e `up`
- [ ] Um aluno com repositório recém-clonado chega ao painel funcionando seguindo apenas
      o README da raiz

## Notas

Considerar `docker-compose.override.yml` para separar desenvolvimento de produção.
Cuidado com bind mount de `node_modules` no Windows — usar volume nomeado para essa pasta.
