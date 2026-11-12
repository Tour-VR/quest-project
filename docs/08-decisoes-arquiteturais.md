# 08 — Decisões Arquiteturais (ADRs)

Registro cronológico das decisões estruturais do projeto e de seus porquês. Uma decisão
registrada aqui só é revertida por outra ADR que a supersede — nunca por edição silenciosa.

**Estados:** `Aceita` · `Proposta` · `Em aberto` · `Superseded por ADR-NNNN` · `Rejeitada`

## Índice

| ADR | Título | Estado |
|---|---|---|
| [0001](#adr-0001--organização-do-sistema-em-submódulos-git) | Organização em submódulos Git | Aceita |
| [0002](#adr-0002--mongodb-como-banco-de-dados) | MongoDB como banco de dados | Aceita (retroativa) |
| [0003](#adr-0003--autenticação-por-jwt-stateless) | Autenticação por JWT stateless | Aceita (retroativa) |
| [0004](#adr-0004--base-de-conhecimento-centralizada-em-docs) | Base de conhecimento centralizada em `docs/` | Aceita |
| [0005](#adr-0005--separação-entre-sessão-de-planejamento-e-sessão-de-execução) | Separação entre planejamento e execução | Aceita |
| [0006](#adr-0006--stack-de-desenvolvimento-do-vr-app) | Stack do app do visitante — produto dividido por dispositivo | Aceita |
| [0007](#adr-0007--modelo-de-domínio-do-campus) | Modelo de domínio do campus | Aceita |
| [0008](#adr-0008--estratégia-de-mídia-imersiva) | Estratégia de mídia imersiva | Em aberto |
| [0009](#adr-0009--autenticação-do-dispositivo-quest) | Autenticação do dispositivo Quest | Em aberto |

---

## ADR-0001 — Organização do sistema em submódulos Git

**Data:** 2026-03-24 · **Estado:** Aceita

**Contexto.** O sistema reúne três frentes com stacks incompatíveis: uma API Python, um
painel web Node/TypeScript e uma aplicação de realidade virtual que provavelmente
carregará assets binários pesados. Era preciso decidir entre monorepo e repositórios
separados.

**Decisão.** Repositórios independentes (`backend`, `frontend`, `vr-app`) agregados por um
orquestrador (`quest-project`) via submódulos Git em `services/`.

**Justificativa.**

- Cada frente evolui em ritmo próprio, com ferramental e CI próprios.
- Assets de VR não contaminam o clone de quem só trabalha na API — questão de tamanho de
  repositório, relevante em contexto acadêmico com máquinas e conexões heterogêneas.
- Permite atribuição clara de responsabilidade por subgrupo de alunos.
- O orquestrador dá um ponto único de entrada, documentação e versionamento do conjunto.

**Consequências.**

- ➕ Isolamento de histórico e de ferramental; onboarding parcial possível.
- ➖ Complexidade operacional real: *detached HEAD*, ponteiros desatualizados, curva de
  aprendizado para alunos sem experiência prévia com submódulos.
- ➖ Mudança que atravessa dois repositórios exige dois commits e um terceiro para o ponteiro.
- **Mitigação:** scripts em `scripts/`, procedimento documentado em
  [07-convencoes.md](07-convencoes.md) e correção de configuração em
  [DT-004](implementacoes-futuras/DT-004-configuracao-submodulos.md).

---

## ADR-0002 — MongoDB como banco de dados

**Data:** 2026-03-24 (registrada retroativamente em 2026-08-20) · **Estado:** Aceita

**Contexto.** Decisão tomada na construção do MVP, sem registro escrito na época. Esta ADR
documenta o que já está em uso no código.

**Decisão.** MongoDB, acessado de forma assíncrona via `AsyncMongoClient` (pymongo 4.16),
banco `oculosvr_db`, collection `users`.

**Justificativa reconstruída.** Esquema flexível durante a fase exploratória; ausência de
relacionamentos complexos no modelo atual; facilidade de provisionamento via MongoDB Atlas.

**Consequências.**

- ➕ Iteração rápida no modelo sem migrações.
- ➖ Sem esquema imposto pelo banco: a integridade depende inteiramente do código.
- ➖ Índices únicos precisam ser criados explicitamente e não foram — ver
  [DT-006](implementacoes-futuras/DT-006-integridade-dados-mongodb.md).

**Ponto de reavaliação.** O domínio de turismo (roteiros → pontos de interesse → mídia)
tende a ser relacional e hierárquico. Se surgirem consultas com múltiplas junções ou
necessidade de transações, reabrir esta decisão em nova ADR **antes** de espalhar o modelo.

---

## ADR-0003 — Autenticação por JWT stateless

**Data:** 2026-03-24 (registrada retroativamente em 2026-08-20) · **Estado:** Aceita

**Decisão.** JWT assinado em `HS256`, com claims `sub` (e-mail) e `role`, expiração de 60
minutos, transportado em `Authorization: Bearer` e armazenado no `localStorage` do navegador.

**Justificativa reconstruída.** Backend sem estado de sessão; simplicidade de integração
com SPA; caminho natural para a futura autenticação do `vr-app`, que não terá cookies.

**Consequências.**

- ➕ Backend horizontalmente escalável, sem store de sessão.
- ➕ O mesmo mecanismo servirá ao headset.
- ➖ Não há revogação: um token válido permanece válido até expirar.
- ➖ `localStorage` é acessível a JavaScript, expondo o token a XSS.
- ➖ Sem refresh token, a sessão cai a cada 60 minutos.
- Fragilidades registradas em [DT-007](implementacoes-futuras/DT-007-hardening-autenticacao.md).

---

## ADR-0004 — Base de conhecimento centralizada em `docs/`

**Data:** 2026-08-20 · **Estado:** Aceita

**Contexto.** O mapeamento inicial do repositório encontrou 1.129 linhas de README nos
submódulos, bem escritas mas divergentes do código em pelo menos nove pontos verificáveis,
e três arquivos de documentação vazios na raiz. Sessões de trabalho — humanas ou de
agentes de IA — não tinham fonte confiável de contexto e redescobriam o sistema a cada vez.

**Decisão.** Centralizar toda a documentação de arquitetura em `docs/`, no repositório
orquestrador, estruturada em três níveis: arquitetura oficial na raiz, dívidas técnicas em
`implementacoes-futuras/`, planos de implementação em `tasks/`. Os READMEs dos submódulos
ficam reduzidos a instruções operacionais e apontam para cá.

**Justificativa.**

- Fonte única de verdade elimina a divergência entre documentos concorrentes.
- A documentação viaja no mesmo repositório do orquestrador, versionada junto com os
  ponteiros dos submódulos — o estado do sistema e sua descrição ficam sincronizados por commit.
- Estrutura previsível permite carga de contexto determinística por agentes de IA.

**Consequências.**

- ➕ Um só lugar para consultar e para manter atualizado.
- ➖ A documentação do backend deixa de acompanhar o clone isolado do `backend` — aceito,
  já que o fluxo de trabalho previsto parte sempre do orquestrador.
- ➖ Exige disciplina: documento e código no mesmo commit.

---

## ADR-0005 — Separação entre sessão de planejamento e sessão de execução

**Data:** 2026-08-20 · **Estado:** Aceita

**Contexto.** O desenvolvimento é conduzido com forte apoio de agentes de IA. Sessões que
planejam e executam no mesmo fluxo acumulam contexto, perdem precisão e produzem
implementações que ninguém revisou antes de existirem.

**Decisão.** Todo trabalho segue quatro etapas com responsabilidades separadas: uma sessão
elabora o plano; o orientador valida; a sessão de planejamento gera um prompt de delegação;
outra sessão executa. O plano é versionado em `docs/tasks/NNN-slug.md`.

**Justificativa.**

- O plano é revisado por um humano **antes** de virar código.
- Cada sessão opera com contexto menor e mais focado.
- O plano fica como registro auditável da intenção, separado do resultado.
- A sessão executora não redecide arquitetura — reduz deriva de escopo.

**Consequências.**

- ➕ Rastreabilidade completa: dívida → plano → validação → commit.
- ➕ Os planos servem de material didático e de avaliação do trabalho dos alunos.
- ➖ Maior latência por tarefa; inadequado para correções triviais, que seguem direto.

---

## ADR-0006 — Stack do app do visitante (produto dividido por dispositivo)

**Data:** 2026-08-20 · **Estado:** Aceita

**Contexto.** O produto foi esclarecido nesta data: trata-se de um **tour do campus
acionado por QR Codes afixados nos locais**. O aluno chega à biblioteca, lê o código e
recebe conteúdo sobre aquele lugar. Isso é realidade aumentada presencial, não turismo
virtual remoto.

Ler um QR Code exige acesso aos pixels da câmera. O navegador do Quest 3 oferece
`immersive-ar` com passthrough, mas **não expõe os frames da câmera ao JavaScript** — Meta
bloqueia por privacidade. Apenas aplicativos nativos alcançam a Passthrough Camera API
(Horizon OS v74+), o que exigiria Unity e C#.

O grupo domina JS/TS e React, não tem experiência com motor gráfico, e dispõe de um
semestre. Um caminho Unity significaria aprender linguagem, motor e XR simultaneamente,
com ciclo de build por APK de minutos por iteração.

**Decisão.** Dividir o produto por dispositivo:

| Experiência | Dispositivo | Stack |
|---|---|---|
| Tour AR presencial — escaneia o QR, vê o conteúdo | Celular | Web: React + Vite + TypeScript, leitura de QR no navegador |
| Tour VR remoto — percorre o campus em 360° | Quest 3 | WebXR: React Three Fiber sobre Three.js |

Ambos vivem em **um único submódulo** (`services/vr-app`), como dois modos sobre um núcleo
compartilhado — cliente da API, tipos de domínio e componentes de conteúdo. O conteúdo do
visitante é público, e o QR contém uma URL (`https://<host>/p/<slug>`) que funciona em
qualquer leitor, mesmo sem o app instalado.

**Justificativa.**

- É a única forma de manter a leitura de QR sem migrar para Unity e C#.
- Reaproveita integralmente a competência que o grupo já tem, e o mesmo ferramental do
  `frontend` — nada novo de infraestrutura.
- Ciclo de iteração de segundos, contra minutos no build de APK: decisivo em um semestre.
- O celular é melhor que o headset para deslocamento pelo campus — luz solar degrada o
  rastreamento, o guardian conflita com espaços abertos, a bateria dura cerca de duas
  horas, e caminhar com o headset tem implicações de segurança.
- O Quest 3 permanece central, cumprindo o papel em que é superior: a visita imersiva de
  quem ainda não conhece o campus.

**Consequências.**

- ➕ Duas experiências entregues, AR e VR, com justificativa técnica por dispositivo.
- ➕ Domínio, backend e conteúdo compartilhados; um cadastro alimenta as duas.
- ➕ A ADR-0009 fica trivial: o navegador do Quest tem teclado e `localStorage`, e o
  conteúdo do visitante nem exige autenticação.
- ➕ A ADR-0008 simplifica: mídia é URL servida por HTTP, sem empacotamento em APK,
  pipeline de assets de motor ou Git LFS.
- ➖ Teto de desempenho do WebXR abaixo do nativo — adequado a vídeo 360° e cenas
  moderadas, restritivo para fotogrametria densa.
- ➖ Fecha a porta da Horizon Store: publicar na loja da Meta exigiria reescrita.
- ➖ O nome `vr-app` fica impreciso, já que o submódulo abriga também o modo AR.

**Desdobramento.** [`tasks/000-visao-macro-opcao-b.md`](tasks/000-visao-macro-opcao-b.md).

---

## ADR-0007 — Modelo de domínio do campus

**Data:** 2026-11-11 · **Estado:** Aceita · **Plano:** [009](tasks/009-pontos-de-interesse-backend.md)

**Contexto.** Com a ADR-0006, o produto passou a ser um tour do campus: o visitante lê um
QR Code afixado num local (ou navega no modo VR) e recebe o conteúdo daquele lugar. O
sistema só modelava `User`. O esboço da DT-016 previa `Roteiro`, `PontoDeInteresse`,
`Midia` e `Sessao`, pensando em turismo remoto guiado.

**Decisão.**

- A entidade central é o **ponto de interesse** (`PointOfInterest`, collection `points`),
  com `slug` único, `name`, `summary`, `history`, `status` (`draft`/`published`),
  `media[]` embutida, `created_at`, `updated_at` e `published_at` (primeira publicação).
- A mídia é **embutida** no ponto (`MediaItem`: `id`, `kind`, `url`, `caption`,
  `alt_text`), no máximo 20 por ponto.
- O `slug` é o identificador público e vai no QR Code; fica **imutável** depois da
  primeira publicação.
- O visitante só enxerga pontos publicados; rascunho responde `404`.
- Visitas são registradas à parte, de forma anônima (`Visit`, plano 010).
- **Não** há entidade `Roteiro` nesta etapa.

**Justificativa.** O QR Code identifica um lugar, não um percurso: o aluno visita os
pontos na ordem em que passa por eles. Mídia embutida resolve a página do ponto com uma
única consulta e não tem uso fora do ponto. A imutabilidade do slug protege os códigos já
impressos. Roteiros foram descartados até que um ponto funcione de ponta a ponta
(DT-016, nota de escopo).

**Consequências.**

- ➕ Uma consulta por página do visitante; modelo pequeno, fácil de testar.
- ➕ O mesmo cadastro alimenta o modo AR e o modo VR.
- ➖ Corrigir um slug publicado exige criar outro ponto e reimprimir o QR.
- ➖ Mídia embutida limita o reaproveitamento de uma foto entre pontos (aceitável).
- ➖ Documento cresce com a mídia; o limite de 20 itens mantém o tamanho sob controle.

---

## ADR-0008 — Estratégia de mídia imersiva

**Estado:** 🔴 Em aberto · **Depende de:** ADR-0006

Turismo virtual é, na prática, um problema de entrega de mídia pesada. Em aberto: formato
(vídeo 360° equirretangular, fotogrametria, modelos 3D), storage (banco, objeto/S3, CDN,
empacotamento no APK), transcodificação, streaming adaptativo e cache no dispositivo.
Nada disso existe hoje.

---

## ADR-0009 — Autenticação do dispositivo Quest

**Estado:** 🔴 Em aberto · **Depende de:** ADR-0006

Digitar e-mail e senha com controles de VR é uma experiência ruim. Alternativas a avaliar:
device code flow (código exibido no headset, confirmado no navegador), QR code, token de
longa duração provisionado no pareamento, ou conta anônima por dispositivo. Impacta
diretamente a ADR-0003 e a
[DT-007](implementacoes-futuras/DT-007-hardening-autenticacao.md).

---

## Como registrar uma nova ADR

Acrescente uma seção no fim deste arquivo, com o próximo número livre, e uma linha no
índice. Estrutura mínima: **Data**, **Estado**, **Contexto** (qual problema forçou a
decisão), **Decisão** (o que foi decidido, no imperativo), **Justificativa** (por quê, e o
que foi descartado) e **Consequências** (o que ganhamos e o que passamos a carregar).

Registre também as decisões já tomadas informalmente — uma ADR retroativa vale mais do que
uma decisão sem registro.
