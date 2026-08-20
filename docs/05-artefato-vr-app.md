# 05 — Artefato: Aplicação Quest 3 (`services/vr-app`)

> Repositório: `github.com/Tour-VR/vr-app` · Commit fixado: `4e6f85f`
> Última verificação contra o código: 2026-08-20

## Status: 🔴 NÃO INICIADO

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
administrativo — é infraestrutura de apoio para um aplicativo de turismo virtual que
ainda não foi escrito. O grupo construiu bem a periferia; o centro está vazio.

Enquanto este artefato não existir:

- não há como validar as premissas de mídia (formato, tamanho, streaming);
- não há como definir o contrato entre headset e backend;
- o modelo de domínio do backend não tem consumidor real que o valide;
- o projeto não tem demonstração possível em óculos.

## Decisão bloqueante: escolha da stack

Nada pode ser planejado neste artefato antes de decidir a plataforma de desenvolvimento.
A decisão condiciona: pipeline de build, formato e entrega de mídia, estratégia de
autenticação no dispositivo, ferramental de CI, competências que o grupo precisa
desenvolver e o esforço total do projeto.

Alternativas em avaliação — **discussão em aberto**, a ser conduzida e registrada como
ADR em [08-decisoes-arquiteturais.md](08-decisoes-arquiteturais.md):

| Alternativa | Observação preliminar |
|---|---|
| **Unity + OpenXR / Meta XR SDK** | Caminho mais suportado oficialmente pela Meta para Quest 3; documentação, passthrough e AR maduros; C#. Curva de aprendizado e peso de repositório. |
| **Unreal Engine** | Fidelidade visual alta; suporte a Quest existe mas é mais trabalhoso; C++/Blueprints; repositório muito pesado. |
| **Godot 4 + OpenXR** | Leve, open source, repositório enxuto; suporte a Quest funcional mas ecossistema Meta menos maduro. |
| **WebXR (Three.js / React Three Fiber / A-Frame)** | Roda no navegador do Quest; reaproveita a stack web e as competências já existentes no grupo; distribuição trivial sem loja. Limitações de performance e de acesso a recursos nativos e AR avançado. |

Esta comparação é preliminar e **não constitui recomendação**. Critérios de decisão a
definir na sessão de planejamento: competências atuais do grupo, prazo acadêmico,
necessidade real de AR/passthrough, exigência de distribuição via loja, peso de
repositório e viabilidade de CI.

## Escopo a definir após a decisão

Uma vez escolhida a stack, este documento deve ser substituído por uma descrição real do
artefato, cobrindo no mínimo:

- estrutura de projeto e organização de assets;
- pipeline de build e geração de APK para o Quest 3;
- estratégia de gestão de arquivos binários grandes (Git LFS ou storage externo);
- contrato de integração com o backend (autenticação, descoberta de conteúdo, mídia);
- modo de execução e teste sem headset físico (simulador/emulador);
- requisitos de performance (taxa de quadros alvo, orçamento de polígonos e texturas).

Frente de trabalho registrada em
[implementacoes-futuras/DT-016-modelagem-dominio-turismo.md](implementacoes-futuras/DT-016-modelagem-dominio-turismo.md)
(domínio) — a frente de implementação do próprio app será registrada após a decisão de stack.
