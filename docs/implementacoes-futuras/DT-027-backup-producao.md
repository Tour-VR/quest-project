# DT-027 — Produção sem backup automático do banco e da mídia

| | |
|---|---|
| **Status** | Aberta |
| **Prioridade** | P1 |
| **Esforço** | Baixo |
| **Artefato** | Orquestrador |
| **Registrada em** | 2026-11-26 |
| **Depende de** | ADR-0010 |

## Contexto

A produção (ADR-0010) guarda o banco no volume `mongo-data` e as fotos e panoramas no
volume `media-data`, ambos no disco da única VM. Não há cópia em outro lugar.

## Evidência

`deploy/docker-compose.prod.yml` declara os volumes e nenhum serviço ou rotina de cópia.
Não há `cron` configurado na VM. O roteiro `docs/11-implantacao.md` traz apenas o backup
manual.

## Impacto

- Perda do disco da VM, `down -v` acidental ou exclusão indevida pelo painel apagam todo o
  conteúdo cadastrado pela turma, sem recuperação.
- Fotos e panoramas dão trabalho de campo para refazer.

## Proposta

1. Script `scripts/backup.sh` com `mongodump --archive --gzip` e `tar` do volume
   `media-data`, gravando em `/var/backups/tourvr/` com data no nome.
2. `cron` diário na VM, mantendo os últimos 7 backups.
3. Cópia para fora da VM (Google Drive institucional via `rclone`, ou outra máquina).
4. Procedimento de restauração testado e documentado em `docs/11-implantacao.md`.

## Critérios de aceite

- [ ] Backup diário automático do banco e da mídia
- [ ] Cópia fora da VM
- [ ] Restauração testada numa pilha local a partir de um backup real

## Notas

Até a resolução, fazer o backup manual de `docs/11-implantacao.md` antes de cada
atualização arriscada.
