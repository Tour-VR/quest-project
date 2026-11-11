# DT-019 — Painel sem healthcheck no Docker Compose

| | |
|---|---|
| **Status** | Aberta |
| **Prioridade** | P3 |
| **Esforço** | Baixo |
| **Artefato** | Orquestrador |
| **Registrada em** | 2026-11-11 |
| **Depende de** | nada |

## Contexto

O serviço `frontend` do `docker-compose.yml` não tem healthcheck e o comando dele roda
`npm ci && npm run dev`. Por isso `docker compose up -d --build --wait` volta assim que o
contêiner inicia, antes de o Vite estar respondendo na porta 3000.

## Evidência

```
docker-compose.yml:31-46   serviço frontend, sem healthcheck
docker-compose.yml:35      command: sh -c "npm ci && npm run dev"
scripts/up.sh:31-33        imprime "Ambiente no ar." logo depois do --wait
```

Na execução do plano 005, com a pilha parada, o primeiro teste E2E falhou porque o painel
ainda não respondia. O `scripts/e2e.sh` contorna isso esperando o painel responder antes
de rodar o Playwright.

## Impacto

`up.sh` diz que o ambiente está no ar quando o painel ainda não abre no navegador (em
máquina lenta, dezenas de segundos). Qualquer script futuro que dependa do `--wait`
precisa repetir a espera do `e2e.sh`.

## Proposta

Adicionar healthcheck ao serviço `frontend` (por exemplo `wget -q --spider
http://localhost:3000` com `start_period` generoso) e, quando existir, remover a espera
manual do `scripts/e2e.sh`.

## Critérios de aceite

- [ ] `docker compose up -d --wait` só termina com o painel respondendo
- [ ] `scripts/e2e.sh` não precisa mais de espera própria

## Notas

Encontrada durante a execução do plano 005.
