# DT-025 — Servidor do `vr-app` no Docker observa a pasta `coverage/` e para de responder

| | |
|---|---|
| **Status** | Aberta |
| **Prioridade** | P2 |
| **Esforço** | Baixo |
| **Artefato** | VR App |
| **Registrada em** | 2026-11-23 |
| **Depende de** | nada |

## Contexto

O serviço `vr-app` do Docker Compose monta `services/vr-app` inteiro como volume e roda
`npm run dev` com `CHOKIDAR_USEPOLLING=true`. O Vite observa todos os arquivos do projeto,
inclusive `coverage/`, que `npm run test:coverage` (rodado no computador, fora do
container) recria a cada execução com dezenas de arquivos HTML.

## Evidência

```
docker-compose.yml          serviço vr-app: volume ./services/vr-app:/app e CHOKIDAR_USEPOLLING
services/vr-app/vite.config.ts   server sem watch.ignored
```

Durante a execução do plano 017, logo após `npm run test:coverage`, o log do container
mostrou uma rajada de `[vite] (client) page reload coverage/src/...html` e, em seguida,
`http://localhost:3001` passou a responder `ERR_EMPTY_RESPONSE` para qualquer página. O
E2E do visitante falhou até `docker compose restart vr-app`.

## Impacto

Quem roda os testes com cobertura (ou o `scripts/validate.sh`, que faz isso) com a pilha
do Docker no ar pode ver o app do visitante travar e o E2E falhar sem motivo aparente,
gastando tempo investigando um problema que não está no código.

## Proposta

Em `services/vr-app/vite.config.ts`, ignorar no observador do Vite as pastas geradas:
`server.watch.ignored: ['**/coverage/**', '**/dist/**']`. Conferir se o painel
(`services/frontend`) tem o mesmo comportamento e aplicar igual, se tiver.

## Critérios de aceite

- [ ] Com `docker compose up` no ar, rodar `npm run test:coverage` em `services/vr-app`
      não gera `page reload coverage/...` no log do container
- [ ] `http://localhost:3001` continua respondendo depois disso, sem reiniciar o container

## Notas

Não foi confirmado se o travamento vem só da rajada de recarregamentos ou também do
consumo de memória do *polling*; ignorar `coverage/` resolve as duas hipóteses.
