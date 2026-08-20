# 00 — Visão Geral do TourVR

> Última verificação contra o código: 2026-08-20

## O produto

O **TourVR** é um sistema de turismo virtual construído para os óculos **Meta Quest 3**,
explorando tanto realidade virtual (imersão em ambientes reconstruídos) quanto realidade
aumentada (sobreposição de informação via passthrough).

A proposta é permitir que uma pessoa visite remotamente um local turístico — com mídia
imersiva, roteiro guiado e informação contextual — a partir de conteúdo curado e
gerenciado por administradores através de um painel web.

**Contexto:** projeto acadêmico desenvolvido por um grupo de alunos sob orientação
docente. Organização GitHub: [`Tour-VR`](https://github.com/Tour-VR).

## Composição do sistema

O sistema é dividido em quatro repositórios Git, sendo o principal um orquestrador que
agrega os demais como submódulos:

| Repositório | Papel | Documento |
|---|---|---|
| `quest-project` | Orquestrador: build, setup, documentação | [02](02-artefato-orquestrador.md) |
| `backend` | API REST — autenticação, dados, domínio | [03](03-artefato-backend.md) |
| `frontend` | Painel administrativo web | [04](04-artefato-frontend.md) |
| `vr-app` | Aplicação executada no Quest 3 | [05](05-artefato-vr-app.md) |

## Estado atual — leitura honesta

O que existe hoje é um **MVP de painel administrativo com autenticação**. O núcleo do
produto — a experiência de realidade virtual — ainda não foi iniciado.

| Frente | Estado |
|---|---|
| Autenticação (registro, login, JWT, perfil) | ✅ Implementada e testada |
| Painel administrativo web (login + dashboard) | ✅ Implementado (dashboard com dados fictícios) |
| Health check e diagnóstico de banco | ✅ Implementado |
| **Aplicação Quest 3** | 🔴 **Não iniciada** — repositório vazio |
| **Modelo de domínio de turismo** | 🔴 **Não existe** — sem Tour, Ponto de Interesse, Mídia |
| Pipeline de mídia 360° / storage | 🔴 Não existe |
| Orquestração de ambiente (compose, scripts) | 🔴 Não existe |
| CI/CD | 🔴 Não existe |

O dashboard exibe "12 Ambientes VR" e "89 Sessões Hoje" como constantes literais no
código-fonte. Não há entidade de ambiente VR nem de sessão em lugar algum do sistema.

## Escopo em números

| Métrica | Valor |
|---|---|
| Linhas de código de aplicação (backend `app/`) | 961 |
| Linhas de código de teste (backend `tests/`) | 679 |
| Linhas de código de aplicação (frontend `src/`) | 414 |
| Linhas de código no `vr-app` | 0 |
| Testes automatizados | 24 (todos no backend) |
| Endpoints REST expostos | 7 |

## Decisões ainda em aberto

Estas questões bloqueiam o avanço e precisam de decisão registrada em
[08-decisoes-arquiteturais.md](08-decisoes-arquiteturais.md):

1. **Stack do `vr-app`** — Unity + OpenXR, Unreal, Godot XR ou WebXR? Condiciona todo o
   resto do projeto (pipeline de build, formato de mídia, autenticação no dispositivo).
2. **Modelo de domínio de turismo** — quais entidades, qual granularidade de roteiro.
3. **Estratégia de mídia** — formato, storage, entrega e streaming para o headset.
4. **Autenticação no dispositivo** — como o Quest se autentica contra o backend.
