# DT-007 — Fragilidades na autenticação

| | |
|---|---|
| **Status** | Aberta |
| **Prioridade** | P0 |
| **Esforço** | Médio |
| **Artefato** | Backend, Frontend |
| **Registrada em** | 2026-08-20 |
| **Depende de** | ADR-0003; impacta ADR-0009 |

## Contexto

O fluxo de autenticação está corretamente implementado no caminho feliz — bcrypt, JWT,
mensagens de erro que não revelam a existência da conta. Faltam, porém, quatro proteções
que separam um MVP de algo que pode ser exposto publicamente. Reunidas aqui por serem
tocadas pelo mesmo código.

## Evidência

**1. Chave JWT com default inseguro.** `app/core/config.py`:

```python
jwt_secret_key: str = "troque_esta_chave"
```

Nada impede a aplicação de subir com esse valor. Um atacante que conheça o repositório
público consegue forjar tokens válidos para qualquer usuário e qualquer `role`.

**2. Sem rate limiting.** `POST /auth/login` aceita tentativas ilimitadas. Não há
biblioteca de throttling nas dependências nem contagem de tentativas por conta ou por IP.

**3. Sem refresh token.** O token expira em 60 minutos (`ACCESS_TOKEN_EXPIRE_MINUTES`) e
não existe mecanismo de renovação. Não há revogação: um token vazado permanece válido até
expirar.

**4. Token em `localStorage`.** `services/api.ts` grava em `localStorage["@OculosVR:token"]`,
acessível a qualquer JavaScript executado na página.

## Impacto

- **Chave default:** comprometimento total da autenticação, sem necessidade de senha. É o
  risco mais grave do sistema atual.
- **Sem rate limiting:** ataque de força bruta contra qualquer conta, sem detecção nem
  atrito. Agravado pela política de senha mínima (8 caracteres, 1 letra e 1 dígito).
- **Sem refresh:** administrador é deslogado a cada hora no meio do trabalho — pressão
  real para "resolver" aumentando a expiração para valores perigosos.
- **`localStorage`:** qualquer XSS resulta em roubo de sessão. Baixo risco hoje, porque o
  painel não renderiza conteúdo de terceiros; cresce quando o painel exibir dados de
  usuários.

## Proposta

**Prioridade imediata**

1. Fail-fast na inicialização: se `APP_ENV != "development"` e `JWT_SECRET_KEY` for o
   default, a aplicação recusa subir com mensagem explícita.
2. Documentar a geração de uma chave forte (`python -c "import secrets;
   print(secrets.token_hex(32))"`) no `.env.example` e em `docs/03-artefato-backend.md`.

**Curto prazo**

3. Rate limiting em `POST /auth/login` e `POST /auth/register` — janela deslizante por IP
   e por identificador, com resposta `429`. Avaliar `slowapi` ou implementação simples em
   memória (suficiente para instância única).
4. Refresh token de vida longa, com rotação, reduzindo o access token para 15 minutos.
   **Decidir junto com a ADR-0009**, para que o mesmo mecanismo sirva ao `vr-app`.

**Avaliar**

5. Migrar o token para cookie `httpOnly` + `SameSite=Strict`. Elimina a exposição a XSS,
   mas exige CSRF token e complica a autenticação do headset — por isso depende da ADR-0009.

## Critérios de aceite

- [ ] Aplicação recusa subir em ambiente não-desenvolvimento com `JWT_SECRET_KEY` default
- [ ] Teste cobrindo a recusa de inicialização
- [ ] Sexta tentativa de login falha na mesma janela retorna `429`
- [ ] Teste cobrindo o rate limiting
- [ ] Decisão sobre refresh token registrada em ADR

## Notas

Os itens 1 e 2 são de esforço trivial e eliminam o risco mais grave — não devem esperar
pelo restante. Os itens 4 e 5 dependem da decisão de autenticação do dispositivo Quest e
não devem ser implementados antes dela, sob pena de retrabalho.
