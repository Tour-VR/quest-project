# 06 — Contrato da API REST

> **Fonte de verdade da integração backend ↔ frontend ↔ vr-app.**
> Extraído por leitura direta do código, não do README do submódulo.
> Última verificação: 2026-11-11 · Base: `http://127.0.0.1:8000`

## Regra de manutenção

Toda alteração de rota, payload ou código de status **deve** atualizar este documento no
mesmo commit. Divergência aqui é bug, não detalhe.

## Observação sobre o prefixo de versão

Apesar de o código estar organizado em `app/api/v1/`, **as rotas não têm prefixo `/api/v1`**.
O `api_router` é incluído sem prefixo em `app/main.py`, e os caminhos efetivos são
`/auth/...`, `/users/...`, `/admin/...`, `/public/...` e `/health/`. A estrutura de pastas antecipa o versionamento;
a exposição HTTP ainda não o adotou.

## Autenticação

Rotas protegidas exigem o header:

```
Authorization: Bearer <access_token>
```

O token é um JWT assinado em `HS256`, com claims:

| Claim | Conteúdo |
|---|---|
| `sub` | e-mail do usuário (normalizado em minúsculas) |
| `role` | papel do usuário: `"admin"` ou `"user"` |
| `exp` | expiração — 60 minutos por padrão |

Não há refresh token. Expirado o prazo, é necessário novo login.

### Papéis e autorização

Dois papéis: `admin` e `user` (`app/core/roles.py`). Rotas restritas a administradores
usam a dependência `require_admin` (`app/api/deps.py:105-115`).

**A autorização usa o papel gravado no banco, não o claim do token.** A cada requisição
protegida o backend relê o usuário pelo `sub` (`app/api/deps.py:86`); o claim `role` serve
só de informação para o cliente. Promover ou rebaixar alguém vale na requisição seguinte.

Erros de uma rota restrita a administradores, nesta ordem:

| Status | `detail` | Quando |
|---|---|---|
| `401` | `"Token nao informado."` | sem header `Authorization` |
| `401` | `"Token invalido ou expirado."` · `"Token invalido."` · `"Usuario nao encontrado."` | token inválido, expirado ou de usuário inexistente |
| `403` | `"Usuario inativo."` | usuário com `is_active=false` |
| `403` | `"Acesso restrito a administradores."` | usuário com papel diferente de `admin` |

A autenticação é verificada antes do corpo: sem token, a resposta é `401` mesmo com
payload inválido.

## Convenções de prefixo

| Prefixo | Quem acessa | Autorização |
|---|---|---|
| `/auth`, `/users/me` | Usuários do painel | Ver cada rota |
| `/admin/...` | Somente papel `admin` | `require_admin` aplicado ao roteador inteiro; erros na tabela de [Papéis e autorização](#papéis-e-autorização) |
| `/public/...` | Qualquer pessoa (app do visitante) | **Sem token**; só devolve conteúdo publicado |

---

## `GET /`

Metadados da API. Público.

**200**
```json
{
  "message": "Bem-vindo ao backend MVP",
  "docs": "/docs",
  "health": "/health/"
}
```

---

## `GET /health/`

Diagnóstico da API e da conexão com o MongoDB. Público. Executa um `ping` real no banco
a cada chamada.

**200** — `status` é `"ok"` se o banco responde, `"degraded"` caso contrário. A rota
**nunca** retorna erro; o estado do banco vem no corpo.

```json
{
  "status": "ok",
  "api": { "status": "ok" },
  "database": {
    "status": "up",
    "connected": true,
    "database": "oculosvr_db",
    "detail": "MongoDB conectado com sucesso."
  }
}
```

Em falha, `database.status` é `"down"`, `connected` é `false` e `detail` traz a causa —
incluindo mensagens traduzidas para erros comuns de autenticação do Atlas e a detecção de
placeholders de senha (`<db_password>`, `<password>`, `SUA_SENHA`) sem tentativa de rede.

---

## `POST /auth/register`

Cria um usuário com papel `user`. **Exige token de administrador** (`Authorization: Bearer`,
ver [Papéis e autorização](#papéis-e-autorização)). O primeiro administrador é criado pela
linha de comando `create-admin` ([03-artefato-backend.md](03-artefato-backend.md#primeiro-administrador)).

**Request**
```json
{
  "email": "admin@exemplo.com",
  "password": "senha1234",
  "full_name": "Nome Completo",
  "username": "nome.usuario"
}
```

| Campo | Obrigatório | Regras |
|---|---|---|
| `email` | sim | e-mail válido; normalizado para minúsculas |
| `password` | sim | ≥ 8 caracteres, ao menos 1 letra e 1 dígito |
| `full_name` | não | ≤ 120 caracteres; string vazia vira `null` |
| `username` | não | 3–30 caracteres, `[a-z0-9._-]`, não inicia nem termina com separador; normalizado para minúsculas |

**200** — dados públicos do usuário criado (nunca inclui a senha):
```json
{
  "email": "admin@exemplo.com",
  "username": "nome.usuario",
  "full_name": "Nome Completo",
  "role": "user",
  "is_active": true,
  "is_verified": false,
  "created_at": "2026-08-20T12:00:00Z",
  "updated_at": "2026-08-20T12:00:00Z"
}
```

| Erro | Quando |
|---|---|
| `401` | sem token · token inválido ou expirado |
| `403` | `"Usuario inativo."` · `"Acesso restrito a administradores."` |
| `400` | e-mail já cadastrado · username já cadastrado — pela checagem prévia ou pelo índice único do MongoDB (cadastros simultâneos); a mensagem é a mesma nos dois casos |
| `422` | senha fraca · e-mail inválido · username fora do padrão (validação Pydantic) |
| `503` | MongoDB indisponível |

> ⚠️ Conflito retorna **400**, não `409`. Comportamento verificado em
> `app/api/v1/routes/auth.py:28-46`.

---

## `POST /auth/login`

Autentica e emite o token. Público.

**Request** — o campo chama-se `email`, mas **aceita e-mail ou username**:
```json
{ "email": "admin@exemplo.com", "password": "senha1234" }
```

**200**
```json
{ "access_token": "eyJhbGciOiJIUzI1NiIs...", "token_type": "bearer" }
```

| Erro | Quando |
|---|---|
| `401` | credenciais inválidas — **inclui** usuário inexistente, senha errada e conta inativa |
| `429` | `"Muitas tentativas. Tente novamente em alguns minutos."` — 5 falhas para o mesmo par IP + identificador em 15 minutos |
| `503` | MongoDB indisponível |

> A mensagem `"Credenciais invalidas."` é idêntica nos três casos, por decisão de
> segurança: não revela se uma conta existe. **Preservar esse comportamento.**

**Limite de tentativas.** A partir da 6ª tentativa errada com o mesmo identificador
(campo `email`) e do mesmo IP dentro de 15 minutos (janela deslizante), a resposta é
`429`, antes mesmo de consultar o banco. Um login bem-sucedido zera o contador. Os
valores vêm de `LOGIN_MAX_FAILURES` e `LOGIN_WINDOW_SECONDS`. O contador fica em memória
e zera quando o backend reinicia (`app/api/v1/routes/auth.py:46-76`).

---

## `GET /users/me`

Dados do usuário autenticado. Requer Bearer.

**200** — mesma forma da resposta de `/auth/register`.

| Erro | Quando |
|---|---|
| `401` | token ausente · token inválido ou expirado · `sub` vazio · usuário do token não existe |
| `403` | usuário existe mas está inativo (`is_active: false`) |
| `503` | MongoDB indisponível |

---

## `PUT /users/me`

Atualiza o perfil do usuário autenticado. Requer Bearer.

**Request** — envie apenas os campos a alterar; `exclude_unset` é respeitado:
```json
{ "full_name": "Novo Nome", "username": "novo.username" }
```

**200** — usuário atualizado, mesma forma de `GET /users/me`.

| Erro | Quando |
|---|---|
| `400` | username já em uso por outra conta · nenhum campo válido enviado |
| `401` / `403` | mesmas condições de `GET /users/me` |
| `404` | usuário não encontrado no momento da atualização |
| `422` | `full_name` > 120 caracteres · username fora do padrão |
| `503` | MongoDB indisponível |

---

## `PUT /users/me/password`

Troca a senha do usuário autenticado. Requer Bearer.

**Request**
```json
{ "current_password": "senha1234", "new_password": "novaSenha5678" }
```

**200**
```json
{ "message": "Senha atualizada com sucesso." }
```

| Erro | Quando |
|---|---|
| `400` | senha atual incorreta |
| `401` / `403` | mesmas condições de `GET /users/me` |
| `404` | usuário não encontrado |
| `422` | nova senha fraca · nova senha igual à atual |
| `503` | MongoDB indisponível |

---

## Pontos de interesse

Entidade definida na [ADR-0007](08-decisoes-arquiteturais.md#adr-0007--modelo-de-domínio-do-campus).
Rotas administrativas em `app/api/v1/routes/admin_points.py`; públicas em
`app/api/v1/routes/public_points.py`. Limites em `app/schemas/point.py:22-34`.

**Ponto de interesse (resposta administrativa — `PointAdminResponse`)**

```json
{
  "id": "6730f1c2a1b2c3d4e5f60718",
  "slug": "biblioteca-central",
  "name": "Biblioteca Central",
  "summary": "Onde ficam os livros e as salas de estudo.",
  "history": "A biblioteca recebeu este nome em homenagem a ...",
  "status": "draft",
  "media": [
    {
      "id": "0b6f8c0e-6a8e-4d0b-9a63-2f1c3b1d9e10",
      "kind": "photo",
      "url": "https://exemplo.com/fachada.jpg",
      "caption": "Fachada principal",
      "alt_text": "Prédio de tijolos com duas portas de vidro"
    }
  ],
  "created_at": "2026-11-11T12:00:00Z",
  "updated_at": "2026-11-11T12:00:00Z",
  "published_at": null
}
```

**Campos de entrada (`PointCreate`; em `PointUpdate` todos são opcionais)**

| Campo | Obrigatório | Regras |
|---|---|---|
| `slug` | sim | 3–60 caracteres; letras minúsculas, números e hifens entre palavras (`^[a-z0-9]+(?:-[a-z0-9]+)*$`); espaços nas pontas removidos e normalizado para minúsculas |
| `name` | sim | 3–120 caracteres, após remover espaços das pontas |
| `summary` | sim | 1–280 caracteres |
| `history` | sim | 1–10000 caracteres |
| `media` | não | lista com até 20 itens; padrão `[]` |
| `media[].id` | não | se ausente, o servidor gera um UUID |
| `media[].kind` | não | apenas `"photo"` (padrão) |
| `media[].url` | sim | 1–500 caracteres (texto; upload de arquivos chega no plano 013) |
| `media[].caption` | não | ≤ 200 caracteres |
| `media[].alt_text` | sim | 1–200 caracteres |

Slug fora do formato responde `422` com a mensagem
`"Slug deve ter de 3 a 60 caracteres, apenas letras minusculas, numeros e hifens entre palavras (ex.: biblioteca-central)."`.

**Regras de negócio**

- `point_id` é o `ObjectId` do MongoDB em texto. Id malformado responde `404`, igual a
  inexistente.
- O `status` só muda por `/publish` e `/unpublish`; o `PUT` não o altera.
- `published_at` guarda a **primeira** publicação e não é apagado ao despublicar.
- Depois da primeira publicação o `slug` não muda mais (os QR Codes impressos deixariam
  de funcionar).
- Listas ordenadas por `name`, em ordem crescente. Sem paginação.

---

## `GET /admin/points`

Lista os pontos, rascunhos e publicados. Exige admin.

**Query:** `status` opcional, `draft` ou `published`.

**200** — lista de `PointAdminResponse` (pode ser vazia).

| Erro | Quando |
|---|---|
| `401` / `403` | ver [Papéis e autorização](#papéis-e-autorização) |
| `422` | `status` diferente de `draft` e `published` |
| `503` | MongoDB indisponível |

---

## `POST /admin/points`

Cria um ponto como **rascunho** (`status: "draft"`, `published_at: null`). Exige admin.

**Request**
```json
{
  "slug": "biblioteca-central",
  "name": "Biblioteca Central",
  "summary": "Onde ficam os livros e as salas de estudo.",
  "history": "A biblioteca recebeu este nome em homenagem a ...",
  "media": [
    { "url": "https://exemplo.com/fachada.jpg", "caption": "Fachada principal", "alt_text": "Prédio de tijolos" }
  ]
}
```

**201** — `PointAdminResponse` do ponto criado; cada mídia sem `id` recebe um.

| Erro | Quando |
|---|---|
| `401` / `403` | ver [Papéis e autorização](#papéis-e-autorização) |
| `409` | `"Ja existe um ponto com este slug."` — pela checagem prévia ou pelo índice único `points_slug_unique` (cadastros simultâneos) |
| `422` | slug fora do padrão · campo fora dos limites · mais de 20 mídias |
| `503` | MongoDB indisponível |

> Ao contrário de usuários (que mantêm `400` por compatibilidade), conflito de slug
> responde **`409`**.

---

## `GET /admin/points/{point_id}`

Um ponto, rascunho ou publicado. Exige admin.

**200** — `PointAdminResponse`.

| Erro | Quando |
|---|---|
| `401` / `403` | ver [Papéis e autorização](#papéis-e-autorização) |
| `404` | `"Ponto de interesse nao encontrado."` — inexistente ou id malformado |
| `503` | MongoDB indisponível |

---

## `PUT /admin/points/{point_id}`

Atualiza um ponto. Exige admin.

**Request** — envie só os campos a alterar; campo ausente ou `null` não é alterado. Se
`media` for enviada, **substitui a lista inteira** (o painel envia a lista completa).
```json
{ "name": "Biblioteca Central Prof. Fulano" }
```

**200** — `PointAdminResponse` atualizado, com `updated_at` novo.

| Erro | Quando |
|---|---|
| `400` | `"Nenhum campo valido para atualizacao."` — corpo vazio ou só com `null` |
| `400` | `"O slug nao pode mudar depois da primeira publicacao, pois os QR Codes impressos deixariam de funcionar."` |
| `401` / `403` | ver [Papéis e autorização](#papéis-e-autorização) |
| `404` | `"Ponto de interesse nao encontrado."` |
| `409` | `"Ja existe um ponto com este slug."` — novo slug já usado por outro ponto |
| `422` | campo fora dos limites |
| `503` | MongoDB indisponível |

---

## `DELETE /admin/points/{point_id}`

Remove o ponto. Exige admin.

**204** — sem corpo.

| Erro | Quando |
|---|---|
| `401` / `403` | ver [Papéis e autorização](#papéis-e-autorização) |
| `404` | `"Ponto de interesse nao encontrado."` |
| `503` | MongoDB indisponível |

---

## `POST /admin/points/{point_id}/publish`

Publica o ponto: `status` passa a `"published"`. Na primeira publicação preenche
`published_at`; publicar de novo é permitido e mantém a data original (idempotente).
Exige admin. Sem corpo.

**200** — `PointAdminResponse`.

| Erro | Quando |
|---|---|
| `401` / `403` | ver [Papéis e autorização](#papéis-e-autorização) |
| `404` | `"Ponto de interesse nao encontrado."` |
| `503` | MongoDB indisponível |

---

## `POST /admin/points/{point_id}/unpublish`

Volta o ponto para rascunho (`status: "draft"`). `published_at` fica intacto, então o slug
continua travado. Exige admin. Sem corpo.

**200** — `PointAdminResponse`.

| Erro | Quando |
|---|---|
| `401` / `403` | ver [Papéis e autorização](#papéis-e-autorização) |
| `404` | `"Ponto de interesse nao encontrado."` |
| `503` | MongoDB indisponível |

---

## `GET /public/points`

Lista os pontos **publicados**. Público, sem token. Rascunhos nunca aparecem.

**200** — lista de `PointPublicSummary`:
```json
[
  {
    "slug": "biblioteca-central",
    "name": "Biblioteca Central",
    "summary": "Onde ficam os livros e as salas de estudo.",
    "cover_url": "https://exemplo.com/fachada.jpg"
  }
]
```

`cover_url` é a `url` da primeira mídia do tipo `photo`, ou `null` se não houver.

| Erro | Quando |
|---|---|
| `503` | MongoDB indisponível |

---

## `GET /public/points/{slug}`

Conteúdo de um ponto publicado — é o que o QR Code (`/p/<slug>`) abre. Público, sem token.

**200** — `PointPublicDetail` (sem `id`, `status` nem datas):
```json
{
  "slug": "biblioteca-central",
  "name": "Biblioteca Central",
  "summary": "Onde ficam os livros e as salas de estudo.",
  "history": "A biblioteca recebeu este nome em homenagem a ...",
  "media": [
    {
      "id": "0b6f8c0e-6a8e-4d0b-9a63-2f1c3b1d9e10",
      "kind": "photo",
      "url": "https://exemplo.com/fachada.jpg",
      "caption": "Fachada principal",
      "alt_text": "Prédio de tijolos com duas portas de vidro"
    }
  ]
}
```

| Erro | Quando |
|---|---|
| `404` | `"Ponto de interesse nao encontrado."` — inexistente **ou rascunho** |
| `503` | MongoDB indisponível |

## `POST /public/points/{slug}/visits`

Registra, de forma **anônima**, que um visitante abriu um ponto publicado — chamado pelo
app do visitante no modo AR (plano 017) ou VR (plano 020). Público, sem token.

**Body** — `VisitCreate`:
```json
{ "mode": "ar" }
```

`mode` aceita apenas `"ar"` ou `"vr"`.

**201** — `VisitRecordedResponse`:
```json
{ "recorded": true }
```

O documento gravado contém **apenas** `point_slug`, `mode` e `visited_at` (UTC): nada de
IP, navegador ou usuário. Não há limite de taxa — ver
[DT-021](implementacoes-futuras/DT-021-limite-taxa-registro-visitas.md).

| Erro | Quando |
|---|---|
| `404` | `"Ponto de interesse nao encontrado."` — inexistente **ou rascunho**; nada é gravado |
| `422` | `mode` ausente ou fora de `ar`/`vr` |
| `503` | MongoDB indisponível |

---

## `GET /admin/metrics/overview`

Resumo com contagens reais de pontos e visitas, para o painel (plano 015). Exige papel
`admin`.

**200** — `MetricsOverviewResponse`:
```json
{
  "points_total": 8,
  "points_published": 5,
  "visits_total": 142,
  "visits_last_7_days": 37,
  "visits_by_mode": { "ar": 120, "vr": 22 },
  "top_points": [
    { "slug": "biblioteca-central", "name": "Biblioteca Central", "visits": 61 },
    { "slug": "cantina", "name": "Cantina", "visits": 40 }
  ]
}
```

- `visits_last_7_days`: visitas com `visited_at` nos últimos 7 dias
  (`METRICS_RECENT_DAYS`) contados a partir do momento da requisição.
- `visits_by_mode`: sempre traz as duas chaves, com `0` quando não há visitas no modo.
- `top_points`: até 5 pontos (`TOP_POINTS_LIMIT`), do mais visitado para o menos; empate
  desempatado pelo slug. Usa o nome **atual** do ponto. Visitas de pontos excluídos
  continuam contando em `visits_total`, mas o ponto não aparece no ranking.

| Erro | Quando |
|---|---|
| `401` / `403` | Sem token / papel diferente de `admin` — ver [Papéis e autorização](#papéis-e-autorização) |
| `503` | MongoDB indisponível |

---

## Formato de erro

Todos os erros seguem o padrão do FastAPI:

```json
{ "detail": "Mensagem descritiva." }
```

Erros de validação (`422`) usam a estrutura de lista do Pydantic, com `loc`, `msg` e `type`.

**Erro `503`:** produzido por `build_database_http_exception` em `app/api/deps.py:63-70`.
O `detail` é **sempre** exatamente `"Banco de dados indisponivel."` e nunca traz o texto
da exceção, em qualquer ambiente e mesmo com `APP_DEBUG=true`. O detalhe técnico fica
apenas no log do servidor (`ERROR app.api.deps Falha de acesso ao banco: ...`).

**Erro `429`:** só em `POST /auth/login`, quando o limite de tentativas é atingido.

## CORS

Configurado em `app/main.py` com `allow_credentials=True`, todos os métodos e headers
liberados, e origens restritas à lista de `APP_CORS_ORIGINS`. O frontend em
`http://localhost:3000` já está contemplado no `.env.example`.

## Endpoints ausentes

O `vr-app` e as telas planejadas do painel exigirão rotas que **ainda não existem**:
listagem e gestão de usuários, upload de mídia (plano 013), panoramas e conexões entre
pontos (plano 019). Ver
[DT-016](implementacoes-futuras/DT-016-modelagem-dominio-turismo.md).
