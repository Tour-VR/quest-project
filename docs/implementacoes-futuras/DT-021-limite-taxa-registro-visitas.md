# DT-021 — Registro de visitas sem limite de taxa

| | |
|---|---|
| **Status** | Aberta |
| **Prioridade** | P3 |
| **Esforço** | Baixo |
| **Artefato** | Backend |
| **Registrada em** | 2026-11-11 |
| **Depende de** | nada |

## Contexto

O plano 010 criou a rota pública `POST /public/points/{slug}/visits`, chamada pelo app do
visitante sempre que alguém abre um ponto. Ela é anônima e não tem nenhum limite de
chamadas: cada requisição grava uma visita nova.

## Evidência

```
services/backend/app/api/v1/routes/public_points.py:41-58   rota sem token e sem limitador
services/backend/app/services/visit_service.py:20-27        grava a visita a cada chamada
```

Compare com o login, que tem limite por IP em memória
(`services/backend/app/core/rate_limit.py`, plano 007).

## Impacto

Qualquer pessoa pode inflar as métricas do painel chamando a rota em laço — por exemplo,
um script que registra milhares de visitas à mesma página em segundos. O resumo de
`GET /admin/metrics/overview` (total, últimos 7 dias, por modo e ranking dos mais
visitados) deixa de refletir o uso real, e a collection `visits` cresce sem controle.
Para o projeto acadêmico o risco é aceitável; numa exposição pública do app, não.

## Proposta

1. Reaproveitar o padrão do `LoginRateLimiter`: janela deslizante em memória, chaveada
   por IP + slug (por exemplo, no máximo 1 visita por IP e ponto a cada minuto).
2. Excedido o limite, responder `201 {"recorded": false}` ou `429` — decidir no
   planejamento, lembrando que o app do visitante não deve mostrar erro ao usuário.
3. O IP serve só para a contagem em memória; **não** pode ser gravado no documento da
   visita (privacidade, decisão do plano 010).

## Critérios de aceite

- [ ] Chamadas repetidas do mesmo IP ao mesmo ponto dentro da janela não geram visitas novas
- [ ] O documento salvo continua com apenas `point_slug`, `mode` e `visited_at`
- [ ] Testes cobrindo o limite e o desbloqueio após a janela

## Notas

Registrada durante a execução do plano 010, conforme a seção 11 (Riscos) do plano. Como o
limitador do login, a solução em memória vale só para uma instância do backend.

---
**Resolução.** *(preencher ao fechar)* Data · commit · plano em `docs/tasks/NNN-slug.md`.
