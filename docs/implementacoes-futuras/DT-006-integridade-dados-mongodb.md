# DT-006 — Ausência de índices únicos no MongoDB

| | |
|---|---|
| **Status** | Aberta |
| **Prioridade** | P0 |
| **Esforço** | Baixo |
| **Artefato** | Backend |
| **Registrada em** | 2026-08-20 |
| **Depende de** | nada |

## Contexto

A unicidade de `email` e `username` é garantida apenas por verificação em código, dentro do
`UserService`. Não há índice único na collection `users`, e nada no código cria índices na
inicialização. Entre a consulta que verifica a existência e a inserção há uma janela em que
outra requisição pode inserir o mesmo valor.

## Evidência

`app/services/user_service.py`, em `register_user`:

```python
existing_email = await self.user_repository.find_by_email(payload.email)
if existing_email:
    raise UserConflictError("Ja existe um usuario com este email.")
# ... janela de corrida ...
await self.user_repository.create_user(user_document)
```

Nenhuma ocorrência de `create_index` ou `create_indexes` em todo o backend. O `lifespan` em
`app/main.py` apenas conecta e desconecta.

## Impacto

- **Duas requisições simultâneas de registro com o mesmo e-mail criam dois usuários.** Com
  dois documentos de mesmo e-mail, `find_by_email` retorna um deles de forma não
  determinística — o usuário consegue logar com uma senha em uma tentativa e não em outra.
- Como `sub` do JWT é o e-mail, a identidade do token deixa de ser unívoca.
- O mesmo vale para `username`, usado no login via `$or`.
- Sem esquema imposto pelo banco, não há segunda linha de defesa. O bug é silencioso e a
  correção posterior exige limpeza manual de dados.

## Proposta

1. Criar os índices no `lifespan` de `app/main.py`, após a conexão bem-sucedida:
   - `users.email` — único;
   - `users.username` — único e **esparso** (`sparse` ou `partialFilterExpression`), já que
     `username` é opcional e vários documentos podem tê-lo como `null`.
2. Tratar `DuplicateKeyError` no `UserRepository`, traduzindo-o para `UserConflictError`.
   A verificação prévia continua, para manter a mensagem amigável, mas deixa de ser a única
   garantia.
3. Cobrir com teste: simular `DuplicateKeyError` na inserção e verificar o retorno `400`.
4. Documentar o procedimento para bases já existentes — verificar duplicatas antes de criar
   o índice, que falha se houver violação.

## Critérios de aceite

- [ ] Índice único em `email` criado automaticamente na subida da aplicação
- [ ] Índice único esparso em `username` criado automaticamente
- [ ] Criação de índice é idempotente e não derruba a aplicação se o banco estiver fora
- [ ] `DuplicateKeyError` resulta em `400` com mensagem clara, não em `500`
- [ ] Teste cobrindo o caminho de erro de chave duplicada

## Notas

Atenção ao índice de `username`: um índice único simples trataria múltiplos `null` como
duplicatas e impediria o cadastro de mais de um usuário sem username.
