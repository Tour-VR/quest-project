# DT-016 — O domínio de turismo virtual não existe

| | |
|---|---|
| **Status** | Em andamento |
| **Prioridade** | **P0** |
| **Esforço** | **Alto** |
| **Artefato** | Backend, Frontend, VR App |
| **Registrada em** | 2026-08-20 |
| **Depende de** | ADR-0006 (stack do `vr-app`) · gera ADR-0007 e ADR-0008 |

## Contexto

O TourVR se propõe a ser um sistema de turismo virtual. O código modela exatamente uma
entidade: `User`. Não existe nenhuma representação de local turístico, roteiro, cena,
mídia ou sessão de visita — nem no backend, nem no frontend, nem em qualquer documento de
projeto anterior a este.

Esta não é uma dívida técnica no sentido usual. É **a frente principal do projeto**,
registrada aqui porque é daqui que sairão os próximos planos de implementação.

## Evidência

`services/backend/app/models/` contém um único arquivo: `user.py`.

`services/backend/app/schemas/` contém um único arquivo: `user.py`.

Os sete endpoints existentes tratam exclusivamente de autenticação, perfil e health check
(ver `docs/06-contrato-api.md`).

O `Dashboard.tsx` exibe "12 Ambientes VR" e "89 Sessões Hoje" como literais — o conceito
de ambiente VR e o de sessão não existem em lugar algum do sistema
([DT-011](DT-011-dashboard-dados-reais.md)).

`services/vr-app/` está vazio (ver `docs/05-artefato-vr-app.md`).

## Impacto

- **O produto não existe.** O que foi construído é a infraestrutura de acesso a um sistema
  cujo conteúdo ainda não foi definido.
- Nenhuma tela do painel além do login tem propósito real enquanto não houver o que
  administrar.
- O `vr-app` não pode ser especificado sem saber o que consumirá.
- Cada semana sem esta definição é uma semana em que o grupo refina a periferia em vez de
  construir o produto.

## Proposta

Este item não é resolvido por uma tarefa — é decomposto em uma sequência de planos.
Ordem sugerida:

**1. Decidir a stack do `vr-app` (ADR-0006).** Bloqueia tudo. A forma como o headset
consome conteúdo determina a granularidade do modelo.

**2. Modelar o domínio (ADR-0007).** Esboço inicial a ser validado, não uma proposta
fechada:

| Entidade | Papel provável |
|---|---|
| `Roteiro` | Visita completa e curada: título, descrição, capa, ordem de pontos |
| `PontoDeInteresse` | Local dentro do roteiro: nome, descrição, coordenadas, mídia |
| `Midia` | Ativo imersivo: tipo, URL, metadados, duração, resolução |
| `Sessao` | Registro de uso: usuário, roteiro, início, fim, progresso |

Questões a resolver na modelagem: um ponto pertence a um único roteiro ou é
compartilhável? Roteiros têm versões? Há rascunho e publicado? Qual o vínculo entre
`Midia` e `PontoDeInteresse` — um para um ou muitos?

**3. Definir a estratégia de mídia (ADR-0008).** Formato, storage, entrega, cache no
dispositivo. Provavelmente a decisão de maior impacto sobre custo e desempenho.

**4. Implementar o CRUD no backend**, seguindo as camadas já estabelecidas
(`docs/01-arquitetura.md`), com testes no mesmo padrão dos 24 existentes.

**5. Implementar as telas de gestão no painel.**

**6. Implementar o consumo no `vr-app`.**

## Critérios de aceite

Aplicam-se à decomposição, não a uma implementação única:

- [ ] ADR-0006 decidida e registrada
- [x] ADR-0007 com o modelo de domínio validado pelo orientador (plano 009)
- [ ] ADR-0008 com a estratégia de mídia definida
- [ ] Cada etapa subsequente com seu próprio plano em `docs/tasks/`

## Notas

**Andamento (2026-11-11, plano 010).** Visitas anônimas modeladas: entidade `Visit`
(collection `visits`, campos `point_slug`, `mode` e `visited_at`), registradas por
`POST /public/points/{slug}/visits` e resumidas em `GET /admin/metrics/overview`. No lugar
da `Sessao` do esboço acima, a ADR-0007 optou por visita anônima, sem usuário.

Recomendação de escopo: modelar **um** roteiro completo, de ponta a ponta — do cadastro no
painel até a visualização no headset — antes de generalizar. Uma fatia vertical funcionando
ensina mais sobre o modelo correto do que qualquer discussão em abstrato, e dá ao grupo
uma demonstração real muito antes.
