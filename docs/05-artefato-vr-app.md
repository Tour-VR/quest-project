# 05 — Artefato: App do Visitante (`services/vr-app`)

> Repositório: `github.com/Tour-VR/vr-app` · Commit fixado: `4e6f85f`
> Última verificação contra o código: 2026-08-20

> **Nome impreciso.** O submódulo chama-se `vr-app`, mas passa a abrigar também o modo AR
> (celular), conforme a [ADR-0006](08-decisoes-arquiteturais.md). Renomear o repositório no
> GitHub é opcional e está registrado como pendência na visão macro.

## Status: 🔴 NÃO INICIADO — stack decidida, implementação não começou

Este documento existe para registrar explicitamente a ausência, e não para deixá-la
implícita. **O repositório está vazio.**

Conteúdo integral do submódulo:

```
services/vr-app/
├── LICENSE      MIT, "Copyright (c) 2026 Tour VR"
└── README.md    2 linhas: "# vr-app" / "oi2"
```

Um único commit (`4e6f85f`, 2026-03-24, "Initial commit"). Zero linhas de código.

## Por que isso importa

O `vr-app` **é o produto**. Tudo o que existe hoje — API de autenticação e painel
administrativo — é infraestrutura de apoio para o app do visitante, que ainda não foi
escrito. O grupo construiu bem a periferia; o centro está vazio.

Enquanto este artefato não existir:

- não há como validar as premissas de mídia (formato, tamanho, streaming);
- o modelo de domínio do backend não tem consumidor real que o valide;
- o painel administrativo gerencia conteúdo que ninguém consome;
- o projeto não tem demonstração possível, nem no campus nem no headset.

## Stack decidida (ADR-0006, 2026-08-20)

Um único app web, em dois modos sobre um núcleo compartilhado:

| Modo | Dispositivo | Stack |
|---|---|---|
| **AR presencial** | Celular | React + Vite + TypeScript · leitura de QR via `BarcodeDetector` com fallback `@zxing/browser` |
| **VR remoto** | Quest 3 | WebXR · React Three Fiber sobre Three.js (`@react-three/fiber`, `@react-three/xr`, `@react-three/drei`) |

O núcleo comum concentra cliente da API, tipos de domínio, constantes e componentes de
conteúdo — os dois modos renderizam o mesmo cadastro de ponto de interesse.

O conteúdo do visitante é **público**: o QR contém a URL `https://<host>/p/<slug>`, que
funciona em qualquer leitor de QR, mesmo sem o app instalado.

Justificativa completa e consequências na
[ADR-0006](08-decisoes-arquiteturais.md). Em resumo: o navegador do Quest 3 não expõe os
pixels da câmera ao JavaScript, o que inviabiliza leitura de QR no headset sem migrar para
Unity e C#; o celular resolve isso reaproveitando a competência que o grupo já tem.

## Estrutura prevista

```
services/vr-app/src/
├── core/                    compartilhado entre os dois modos
│   ├── api/                 cliente HTTP, endpoints de pontos e visitas
│   ├── types/               gerados do OpenAPI + tipos de domínio
│   ├── constants/           rotas, categorias, limites — documentados
│   ├── qr/                  leitura de QR, isolada e testável
│   ├── hooks/               usePonto, useRegistrarVisita
│   └── components/          ConteudoPonto, GaleriaMidia, CabecalhoPonto
├── modes/
│   ├── ar/                  ScannerQR, PaginaPonto, sobreposição
│   └── vr/                  CenaXR, Visualizador360, navegação
└── routes/
```

## Pendências antes da implementação

- **Modelo de domínio** (ADR-0007, Fase 1) — o app não tem o que consumir enquanto
  `PontoDeInteresse` não existir no backend. Ver
  [DT-016](implementacoes-futuras/DT-016-modelagem-dominio-turismo.md).
- **HTTPS para o modo VR** — WebXR não funciona em `http://` fora de `localhost`. Testar no
  headset exige certificado local ou `adb reverse`. Resolvido no plano da Fase 4.
- **Estratégia de mídia** (ADR-0008, Fase 4) — formato, storage e entrega do conteúdo 360°.

Sequência e desdobramento em
[`tasks/000-visao-macro-opcao-b.md`](tasks/000-visao-macro-opcao-b.md) — Fases 3 e 4.
