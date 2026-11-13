# DT-023 — Mídia servida sem redimensionamento nem miniatura

| | |
|---|---|
| **Status** | Aberta |
| **Prioridade** | P3 |
| **Esforço** | Médio |
| **Artefato** | Backend, Frontend |
| **Registrada em** | 2026-11-13 |
| **Depende de** | ADR-0008 |

## Contexto

O plano 013 grava a imagem exatamente como foi enviada (até 20 MB) e a serve do mesmo
jeito. A miniatura de 120 px do painel, e futuramente a página do ponto no celular, baixam
o arquivo original inteiro.

## Evidência

```
services/backend/app/services/media_service.py:60          grava o conteudo recebido, sem transformar
services/backend/app/main.py:74                            /media serve o arquivo original
services/frontend/src/pages/points/media/MediaItemCard.tsx:112   miniatura usa a URL do original
```

## Impacto

Uma foto de celular de 8 MB vira 8 MB por miniatura no painel e por abertura de página no
app do visitante, que roda em rede móvel. Formatos pesados (PNG fotográfico) não são
convertidos.

## Proposta

Ao receber a imagem, gerar uma versão reduzida (por exemplo, 1600 px no maior lado) e uma
miniatura (320 px) em WebP, com Pillow; devolver as URLs no `POST /admin/media` e guardar a
da miniatura no `MediaItem`. Panoramas (plano 019) mantêm a resolução original.

## Critérios de aceite

- [ ] Miniatura do painel com menos de 50 KB para qualquer foto enviada
- [ ] Original preservado para panoramas
- [ ] Contrato da API e `docs/06-contrato-api.md` atualizados

## Notas

Registrada a partir da seção "Fora" do plano 013 e das consequências da ADR-0008.
