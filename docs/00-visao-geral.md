# 00 — Visão Geral do TourVR

> Última verificação contra o código: 2026-08-20

## O produto

O **TourVR** é um sistema de tour do campus, com duas formas de visita sobre o mesmo
conteúdo curado e gerenciado por administradores através de um painel web.

**Tour AR presencial (celular).** QR Codes são afixados nos pontos do campus. O aluno chega
à biblioteca, lê o código, e recebe conteúdo sobre aquele lugar — a história do nome, fotos,
explicação. O mesmo padrão se repete nos demais pontos.

**Tour VR remoto (Meta Quest 3).** Para quem ainda não conhece o campus — calouro,
candidato do vestibular, visitante de outra cidade —, uma visita imersiva em 360° pelos
mesmos pontos.

A divisão por dispositivo é deliberada e está justificada na
[ADR-0006](08-decisoes-arquiteturais.md): leitura de QR exige acesso aos pixels da câmera,
que o navegador do Quest 3 não expõe ao JavaScript.

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
| `vr-app` | App do visitante — modo AR (celular) e modo VR (Quest 3) | [05](05-artefato-vr-app.md) |

## Estado atual — leitura honesta

O que existe hoje é um **MVP de painel administrativo com autenticação**. O núcleo do
produto — a experiência de realidade virtual — ainda não foi iniciado.

| Frente | Estado |
|---|---|
| Autenticação (registro, login, JWT, perfil) | ✅ Implementada e testada |
| Painel administrativo web (login + dashboard) | ✅ Implementado (dashboard com dados fictícios) |
| Health check e diagnóstico de banco | ✅ Implementado |
| **App do visitante (AR e VR)** | 🔴 **Não iniciado** — repositório vazio; stack decidida na ADR-0006 |
| **Modelo de domínio do campus** | 🟡 Parcial — pontos de interesse no backend (ADR-0007); visitas e telas do painel pendentes |
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

## Direção definida

A **ADR-0006 foi decidida em 2026-08-20**: produto dividido por dispositivo, com o app do
visitante em React + Vite (modo AR no celular, modo VR em WebXR no Quest 3), num único
submódulo com núcleo compartilhado. O desdobramento em fases está em
[`tasks/000-visao-macro-opcao-b.md`](tasks/000-visao-macro-opcao-b.md).

Permanecem em aberto, agora desbloqueadas:

1. **Modelo de domínio do campus** (ADR-0007) — entidades e granularidade. Fase 1.
2. **Estratégia de mídia** (ADR-0008) — formato, storage e entrega. Fase 4.
3. **Autenticação do visitante** (ADR-0009) — resolvida na prática pela decisão de manter o
   conteúdo público; falta o registro formal.
