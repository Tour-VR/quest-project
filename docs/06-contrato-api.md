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
`/auth/...`, `/users/...` e `/health/`. A estrutura de pastas antecipa o versionamento;
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
| `role` | papel do usuário (atualmente sempre `"user"`) |
| `exp` | expiração — 60 minutos por padrão |

Não há refresh token. Expirado o prazo, é necessário novo login.

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

Cria um usuário. Público.

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
| `400` | e-mail já cadastrado · username já cadastrado — pela checagem prévia ou pelo índice único do MongoDB (cadastros simultâneos); a mensagem é a mesma nos dois casos |
| `422` | senha fraca · e-mail inválido · username fora do padrão (validação Pydantic) |
| `503` | MongoDB indisponível |

> ⚠️ Conflito retorna **400**, não `409`. Comportamento verificado em
> `app/api/v1/routes/auth.py:26`.

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

## Formato de erro

Todos os erros seguem o padrão do FastAPI:

```json
{ "detail": "Mensagem descritiva." }
```

Erros de validação (`422`) usam a estrutura de lista do Pydantic, com `loc`, `msg` e `type`.

**Erro `503`:** produzido por `build_database_http_exception` em `app/api/deps.py:35-42`.
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
listagem e gestão de usuários, entidades de turismo (roteiros, pontos de interesse,
mídia), sessões de uso e métricas. Nada disso está implementado. Ver
[DT-016](implementacoes-futuras/DT-016-modelagem-dominio-turismo.md).
