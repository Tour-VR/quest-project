# DT-022 — Arquivos de mídia órfãos no disco

| | |
|---|---|
| **Status** | Aberta |
| **Prioridade** | P3 |
| **Esforço** | Baixo |
| **Artefato** | Backend |
| **Registrada em** | 2026-11-13 |
| **Depende de** | ADR-0008 |

## Contexto

O plano 013 passou a gravar as fotos enviadas pelo painel no volume `media-data`. A foto
só fica ligada ao ponto pela URL guardada na lista `media`. Quando o administrador remove
uma foto do ponto, ou exclui o ponto inteiro, o arquivo continua no disco: ninguém mais
aponta para ele.

## Evidência

```
services/backend/app/repositories/media_storage.py:15-21   grava o arquivo; nao ha metodo de remocao
services/backend/app/services/point_service.py:156         PUT troca a lista media sem olhar o disco
services/backend/app/services/point_service.py:172         excluir o ponto nao apaga as fotos
services/frontend/src/hooks/useMediaList.ts:81             "Remover" so tira a URL da lista
```

Uma foto enviada e nunca associada (por exemplo, quando o `PUT` falha logo depois do
envio) também fica órfã.

## Impacto

O volume cresce sem limite. Com dezenas de pontos e poucas fotos cada, o desperdício é
pequeno; com panoramas de 5 a 20 MB (plano 019) e trocas frequentes, ocupa espaço de
verdade. Uma foto órfã continua acessível por quem souber a URL.

## Proposta

Limpeza periódica: um comando `python -m app.cli clean-media` que lista os arquivos de
`MEDIA_DIR`, compara com as URLs referenciadas em `points.media[].url` e apaga os que não
são referenciados há mais de 24 horas (a margem protege um envio em andamento).

## Critérios de aceite

- [ ] Arquivo não referenciado por nenhum ponto, com mais de 24 horas, é apagado pelo comando
- [ ] Arquivo referenciado, ou recente, nunca é apagado
- [ ] O comando informa quantos arquivos e quantos MB foram liberados

## Notas

Apagar o arquivo na hora em que a foto sai do ponto foi descartado: o mesmo arquivo poderia
estar em outro ponto (cópia manual da URL) e a remoção precisaria de transação entre banco
e disco.
