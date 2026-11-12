# 012 — Cadastro de pontos no painel

| | |
|---|---|
| **Status** | Em revisão — Heitor Aquino |
| **Fase** | 2 — Painel administrativo |
| **Depende de** | 009, 011 |
| **Dívidas atendidas** | DT-016 (parcial — gestão do domínio no painel) |
| **ADRs relacionadas** | ADR-0007 |
| **Artefatos afetados** | Frontend, Orquestrador (docs e E2E) |
| **Planejado em** | 2026-11-05 |
| **Validado em** | 2026-11-05 por Ciro Macedo |
| **Executado em** | 2026-11-12 por Heitor Aquino (PRs em revisão) |

---

## 1. Objetivo

Permitir que um administrador crie, edite, publique, despublique e exclua pontos de
interesse do campus pelo painel, sem Swagger. É a primeira tela que gerencia conteúdo real
do tour e o pré-requisito de mídia (013) e QR Codes (014).

## 2. Leia antes de começar

- `docs/04-artefato-frontend.md`
- `docs/06-contrato-api.md` — seção dos endpoints `/admin/points` (escrita no plano 009)
- `docs/08-decisoes-arquiteturais.md` — ADR-0007

## 3. Estado esperado ao iniciar

Produzido por planos anteriores:

- **009** — backend com `GET/POST /admin/points`, `GET/PUT/DELETE
  /admin/points/{point_id}`, `POST /admin/points/{point_id}/publish` e `/unpublish`, todos
  exigindo admin. Schemas `PointCreate`, `PointUpdate`, `PointAdminResponse`. Regras:
  slug `^[a-z0-9]+(?:-[a-z0-9]+)*$` com 3-60 caracteres; `name` 3-120; `summary` 1-280;
  `history` 1-10000; `media` até 20; slug duplicado → `409`; inexistente → `404`.
- **011** — `AdminLayout` com `src/constants/navigation.ts` (item "Pontos" com
  `enabled: false`), interceptor de 401, guard de admin, `npm run gen:types` gerando
  `src/types/api.d.ts`, aliases em `src/types/index.ts`.
- **004/005** — limites de lint (`max-lines` 200, `max-lines-per-function` 60,
  `complexity` 10), Vitest 80%, `scripts/validate.sh`, E2E com helper de admin.

Confira: `curl -s localhost:8000/openapi.json | grep -c '/admin/points'` deve ser maior
que zero com a pilha no ar.

## 4. Escopo

**Dentro:**

- serviço `src/services/points.ts` com as 7 chamadas;
- constantes de validação espelhando o backend;
- lista de pontos com filtro por status;
- formulário único para criar e editar;
- ações publicar, despublicar e excluir com confirmação;
- item "Pontos" habilitado no menu.

**Fora:**

- mídia (fotos, panorama) — planos 013 e 019; o formulário deste plano não mostra seção
  de mídia e envia `media` intocado na edição;
- QR Codes — plano 014;
- paginação — o volume esperado (dezenas de pontos de um campus) não justifica; registrar
  como dívida se a lista passar de 100 itens;
- editor de texto rico para `history` — `textarea` simples; quebras de linha preservadas.

## 5. Decisões tomadas no planejamento

| Questão | Decisão | Motivo |
|---|---|---|
| Rotas | `/pontos`, `/pontos/novo`, `/pontos/:pointId` | Nomes em português na URL visível; código em inglês |
| Formulário | Um componente `PointForm` para criar e editar | Evita duplicação (jscpd) |
| Validação no cliente | Mesmos limites do backend, em `src/constants/points.ts`; mensagem por campo | Feedback imediato; o backend continua sendo a garantia |
| Slug | Sugerido automaticamente a partir do nome ao criar (minúsculas, sem acento, hífens); editável; **não** editável depois de publicado | QR impresso aponta para o slug; mudá-lo quebraria a placa |
| Erro `409` | Mensagem no campo slug: "Já existe um ponto com este identificador." | Erro mais comum na criação |
| Confirmação de exclusão | `window.confirm` com o nome do ponto | Sem dependência de modal |
| Publicar/despublicar | Botões na lista e no formulário; status como selo colorido ("Rascunho" cinza, "Publicado" verde) | Ação frequente e visível |
| Estado das telas | `useState` + hook `usePoints()` / `usePoint(id)` locais em `src/hooks/` | Convenção: sem lib de estado global |
| Estados de carregando, erro e vazio | Componentes `LoadingState`, `ErrorState`, `EmptyState` em `src/components/feedback/` | Reutilizados por 013-015 |

## 6. Passos de implementação

Submódulo `services/frontend`, branch `plano/012-cadastro-de-pontos-painel`, salvo
indicação.

### Passo 1 — Tipos

Com a pilha no ar, `npm run gen:types`. Em `src/types/index.ts` acrescente:

```ts
export type Point = Schemas['PointAdminResponse'];
export type PointCreate = Schemas['PointCreate'];
export type PointUpdate = Schemas['PointUpdate'];
export type PointStatus = Point['status'];
```

### Passo 2 — Constantes

**Arquivo novo:** `src/constants/points.ts`

```ts
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SLUG_MIN = 3;
export const SLUG_MAX = 60;
export const NAME_MIN = 3;
export const NAME_MAX = 120;
export const SUMMARY_MAX = 280;
export const HISTORY_MAX = 10000;

export const STATUS_LABEL: Record<PointStatus, string> = {
  draft: 'Rascunho',
  published: 'Publicado',
};
```

### Passo 3 — Serviço

**Arquivo novo:** `src/services/points.ts` — funções finas sobre `api`, sem lógica:

```ts
export async function listPoints(status?: PointStatus): Promise<Point[]> {
  const { data } = await api.get<Point[]>('/admin/points', { params: { status } });
  return data;
}
// getPoint(id), createPoint(payload), updatePoint(id, payload),
// deletePoint(id), publishPoint(id), unpublishPoint(id)
```

### Passo 4 — Utilitários de formulário

**Arquivos novos:** `src/utils/slugify.ts`, `src/utils/validatePoint.ts`,
`src/utils/apiError.ts`

- `slugify(name)`: `normalize('NFD')`, remove diacríticos, minúsculas, troca tudo que não
  é `[a-z0-9]` por `-`, colapsa hífens, apara as pontas, corta em `SLUG_MAX`.
- `validatePoint(values)`: devolve `Partial<Record<campo, mensagem>>`; mensagens em
  português ("O nome precisa ter entre 3 e 120 caracteres.").
- `apiErrorMessage(error)`: extrai `response.data.detail` (string, ou primeira mensagem de
  lista `422`); padrão "Não foi possível concluir a operação. Tente novamente.".

### Passo 5 — Componentes de feedback

**Pasta nova:** `src/components/feedback/` com `LoadingState.tsx`, `ErrorState.tsx`
(mensagem + botão "Tentar novamente"), `EmptyState.tsx` (mensagem + ação opcional).

### Passo 6 — Hooks

**Arquivos novos:** `src/hooks/usePoints.ts` e `src/hooks/usePoint.ts`

`usePoints(status)` → `{ points, loading, error, reload }`. `usePoint(id)` → `{ point,
loading, error }` (quando `id` for `undefined`, não chama a API: modo criação).

### Passo 7 — Lista

**Arquivos novos:** `src/pages/points/PointsList.tsx`, `src/pages/points/PointRow.tsx`,
`src/pages/points/StatusBadge.tsx`, `src/pages/points/StatusFilter.tsx`

- Cabeçalho "Pontos do tour" e botão "Novo ponto" (link para `/pontos/novo`).
- Filtro: "Todos", "Rascunhos", "Publicados".
- Tabela: nome (link para edição), slug, selo de status, data de atualização
  (`toLocaleDateString('pt-BR')`), ações "Publicar"/"Despublicar" e "Excluir".
- Vazio: "Nenhum ponto cadastrado ainda." com o botão "Novo ponto".
- Após ação bem-sucedida, chama `reload()`.

### Passo 8 — Formulário

**Arquivos novos:** `src/pages/points/PointForm.tsx`, `src/pages/points/PointFields.tsx`,
`src/pages/points/PointFormActions.tsx`, `src/hooks/usePointForm.ts`

- `usePointForm(point?)` concentra estado, validação, `submit` (cria ou atualiza) e erro
  de API; o componente só renderiza.
- Campos: Nome, Identificador (slug) com dica "Aparece no endereço do QR Code: /p/<slug>",
  Resumo (contador `x/280`), História (`textarea`, contador).
- Ao criar: enquanto o usuário não editar o slug manualmente, ele acompanha
  `slugify(nome)`.
- Slug desabilitado quando `point.status === 'published'`, com a dica "Despublique para
  alterar o identificador.".
- Ao salvar com sucesso na criação: navega para `/pontos/<id>` e mostra "Ponto criado.".
  Na edição: "Alterações salvas.".
- `409` → erro no campo slug (seção 5). `422` → mensagem geral via `apiErrorMessage`.
- Ações na edição: "Publicar"/"Despublicar", "Excluir" (confirmação; depois navega para
  `/pontos`).
- Na edição, envie no `PUT` apenas os campos do formulário (não envie `media`).

### Passo 9 — Rotas e menu

**Arquivos:** `src/App.tsx` (três rotas dentro do `AdminLayout`) e
`src/constants/navigation.ts` (`Pontos` com `enabled: true`).

### Passo 10 — E2E

**Repositório:** orquestrador. **Arquivo novo:** `e2e/tests/pontos.spec.ts`

- `@golden admin cria e publica um ponto pelo painel` — login; "Pontos" → "Novo ponto";
  preenche "Biblioteca Central E2E <timestamp>"; confere o slug sugerido; salva; clica
  "Publicar"; vê o selo "Publicado"; confere por `GET /public/points/<slug>` (status 200).
- `slug duplicado mostra erro no campo` — cria um ponto pela API e tenta criar outro com
  o mesmo slug pelo painel.
- `excluir remove da lista` — cria pela API, exclui pelo painel aceitando o `confirm`
  (`page.once('dialog', d => d.accept())`).

Acrescente a `e2e/support/api.ts` o helper `createPoint(token, overrides)`.

## 7. Testes

| Arquivo | Teste | Verifica |
|---|---|---|
| `src/utils/slugify.test.ts` | `"Biblioteca Central — Sala 2"` → `biblioteca-central-sala-2`; acentos; limite de 60 | Sugestão de slug |
| `src/utils/validatePoint.test.ts` | cada limite (mínimo, máximo, padrão do slug) | Validação |
| `src/utils/apiError.test.ts` | `detail` string, lista 422, erro de rede | Mensagens |
| `src/services/points.test.ts` | cada função chama o método e caminho corretos (mock de `api`) | Contrato |
| `src/pages/points/PointsList.test.tsx` | carregando, vazio, lista, filtro muda o parâmetro, publicar chama o serviço e recarrega | Lista |
| `src/pages/points/PointForm.test.tsx` | criação sugere slug; erro de validação impede envio; 409 aparece no campo; slug bloqueado se publicado; excluir pede confirmação | Formulário |
| `src/hooks/usePointForm.test.ts` | criar × atualizar; payload do PUT sem `media` | Regra do hook |

Mocks: `vi.mock('../../services/points')`. Rotas com `MemoryRouter`.

```bash
cd services/frontend && npm run lint && npm run format:check && npm run test:coverage && npm run build
cd ../.. && bash scripts/validate.sh
```

## 8. Documentação a atualizar

- [x] `docs/04-artefato-frontend.md` — rotas `/pontos*`, estrutura (`pages/points/`,
      `hooks/`, `utils/`, `components/feedback/`), endpoints consumidos
- [x] `docs/00-visao-geral.md` — tabela de estado: "Cadastro de pontos no painel ✅"
- [x] `docs/implementacoes-futuras/DT-016-...md` — anotar avanço (plano 012)

## 9. Critérios de aceite

- [x] Admin cria um ponto, vê-o na lista como "Rascunho", publica e vê "Publicado"
- [x] Ponto publicado aparece em `GET /public/points`
- [x] Slug sugerido sem acentos; slug bloqueado em ponto publicado
- [x] Slug duplicado mostra erro no campo, sem perder o que foi digitado
- [x] Exclusão pede confirmação e remove o ponto
- [x] Estados de carregando, erro e vazio presentes na lista e no formulário
- [x] Nenhum arquivo acima de 200 linhas; nenhuma função acima de 60
- [x] `bash scripts/validate.sh` passando com os 3 cenários E2E novos
- [x] Documentação da seção 8 atualizada

## 10. Commits esperados

Frontend:

```
build: regenera tipos da API com os pontos de interesse
feat(points): adiciona servico e constantes de pontos
feat(ui): adiciona estados de carregando, erro e vazio
feat(points): cria lista de pontos com filtro e acoes
feat(points): cria formulario de criacao e edicao de pontos
feat(nav): habilita o item Pontos no menu
```

Orquestrador:

```
test(e2e): cobre criacao, publicacao e exclusao de pontos
docs: documenta o cadastro de pontos no painel
```

## 11. Riscos e pontos de atenção

- **Limite de 60 linhas por função** é atingido fácil em formulários: por isso o estado
  vai para `usePointForm` e os campos para `PointFields`.
- **`id` do ponto** é string (ObjectId). Não converta para número.
- **Datas** chegam em ISO UTC; formate só na exibição.
- **E2E paralelo:** use nomes com timestamp para não colidir com outros testes.

## 12. Verificação pelo aluno

1. `bash scripts/up.sh` e abra `http://localhost:3000`; entre como administrador.
2. Clique em "Pontos" no menu → "Novo ponto".
3. Digite o nome "Biblioteca Central". O campo identificador se preenche sozinho com
   `biblioteca-central`.
4. Preencha resumo e história e clique "Salvar". Aparece "Ponto criado.".
5. Clique "Publicar". O selo muda para "Publicado" (verde) e o identificador fica bloqueado.
6. Abra `http://localhost:8000/public/points` em outra aba: a Biblioteca Central aparece.
7. Tente criar outro ponto com o mesmo identificador: aparece o erro em vermelho no campo.

---

## Prompt de delegação

Cole no Claude Code, na pasta `quest-project`, trocando o nome:

```text
Você é a sessão de EXECUÇÃO do projeto TourVR.
Execute o plano docs/tasks/012-cadastro-de-pontos-painel.md.
Antes de qualquer ação, leia docs/tasks/protocolo-execucao.md e siga o "Prompt 1 — EXECUTAR" etapa por etapa.
Meu nome, para registrar no plano: <SEU NOME>
```

---

## Registro de execução

**Executado por:** Heitor Aquino, com agente de IA, em 2026-11-12.

**O que foi feito**

- Frontend: aliases `Point`, `PointCreate`, `PointUpdate`, `PointStatus`; constantes em
  `src/constants/points.ts`; serviço `src/services/points.ts` (7 chamadas); utilitários
  `slugify`, `validatePoint` e `apiError`; estados `LoadingState`, `ErrorState` e
  `EmptyState`; hooks `usePoints`, `usePoint`, `usePointForm` e `usePointActions`; lista
  `/pontos` e formulário `/pontos/novo` e `/pontos/:pointId`; item "Pontos" habilitado.
- Orquestrador: `e2e/tests/pontos.spec.ts` com os 3 cenários e o helper `createPoint`.
- Validação: `npm run lint`, `format:check`, `test:coverage` (110 testes, ~99% de linhas)
  e `build` passando; `bash scripts/validate.sh` com saída 0 (8 cenários E2E).

**Desvios do plano**

1. **Passo 1:** `npm run gen:types` não gerou diferença — `api.d.ts` já tinha os schemas de
   pontos desde o plano 009. O commit traz só os aliases.
2. **Passo 7 — lista com os componentes do plano 022.** O plano 022 (concluído depois da
   validação deste) tornou obrigatório `PageHeader` + `Toolbar` + `DataTable` +
   `RowActions` em telas de listagem (`docs/07-convencoes.md`). Por isso não há
   `PointRow.tsx`: as linhas vêm de `pointColumns.tsx`, e "Publicar"/"Despublicar" e
   "Excluir" ficam no menu "⋯" da linha.
3. **Local dos subcomponentes.** `docs/07-convencoes.md` manda componentes de uma página
   para `src/components/<pagina>/`. `PointsList.tsx` e `PointForm.tsx` ficaram em
   `src/pages/points/`; `StatusBadge`, `StatusFilter`, `PointFields`, `PointFormActions` e
   os auxiliares `PointEditor`, `FormField`, `NewPointLink` e `pointColumns` ficaram em
   `src/components/points/`.
4. **Hook extra `usePointActions`.** Publicar, despublicar e excluir são usados pela lista
   e pelo formulário; o hook evita duplicação (jscpd).
5. **Helper E2E:** `createPoint(request, token, overrides)` — recebe também o `request` do
   Playwright, necessário para chamar a API; `loginPelaApi` passou a ser exportado.
6. **PUT em ponto publicado** omite o `slug` (além de `media`), para não esbarrar na regra
   do backend que trava o slug.

**Dívidas novas registradas:** nenhuma.
