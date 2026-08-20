# DT-008 — Campo `role` existe mas não autoriza nada

| | |
|---|---|
| **Status** | Aberta |
| **Prioridade** | P1 |
| **Esforço** | Médio |
| **Artefato** | Backend |
| **Registrada em** | 2026-08-20 |
| **Depende de** | nada; bloqueia DT-015 |

## Contexto

O modelo de usuário tem um campo `role`, o token JWT o carrega como claim, e a resposta de
`/users/me` o expõe. Nenhuma rota, porém, verifica seu valor. Todo usuário registrado é
criado com `role="user"` — inclusive o primeiro — e não existe caminho no código que crie
um administrador ou que diferencie permissões.

## Evidência

`app/models/user.py` define `role: str = "user"`.

`app/core/security.py` inclui o papel no token:

```python
token = create_access_token(
    subject=user["email"],
    extra_claims={"role": user.get("role", "user")},
)
```

`app/api/deps.py` possui apenas `get_current_user` — não há `require_role`, `get_admin_user`
ou dependência equivalente. Nenhuma rota em `app/api/v1/routes/` verifica `role`.

`app/services/user_service.py`, em `register_user`, fixa `role="user"` sem parâmetro.

## Impacto

- **O registro é aberto e todos os usuários são equivalentes.** Qualquer pessoa com acesso
  à URL do backend pode criar uma conta e acessar o painel administrativo por completo.
- Não há como implementar gestão de usuários no painel ([DT-015](DT-015-gestao-usuarios-no-painel.md))
  sem antes ter autorização: uma tela de listagem de usuários exposta a qualquer conta é
  um vazamento de dados.
- O campo cria falsa impressão de controle de acesso, tanto para quem lê o código quanto
  para agentes que o usem como contexto.

## Proposta

1. Definir os papéis do sistema — sugestão inicial: `admin` (gestão total) e `user`
   (acesso de leitura ao próprio perfil). Registrar como ADR se houver mais de dois.
2. Criar uma dependência `require_role("admin")` em `app/api/deps.py`, construída sobre
   `get_current_user`, retornando `403` quando o papel não bastar.
3. Definir como o primeiro administrador é criado. Alternativas:
   - comando de seed executado uma vez (`python -m app.cli create-admin`);
   - promoção manual no banco, documentada;
   - variável de ambiente com o e-mail do administrador inicial, aplicada no `lifespan`.
4. Avaliar restringir ou remover `POST /auth/register` como rota pública — provavelmente o
   fluxo correto é convite emitido por administrador.
5. Cobrir com testes: acesso permitido com papel suficiente, `403` com papel insuficiente,
   e papel ausente no token.

## Critérios de aceite

- [ ] Dependência de autorização por papel disponível e testada
- [ ] Pelo menos uma rota protegida por papel de administrador
- [ ] Caminho documentado e reproduzível para criar o primeiro administrador
- [ ] Decisão sobre a abertura de `POST /auth/register` registrada
- [ ] Testes cobrindo permitido e negado

## Notas

O papel viaja dentro do token, então uma mudança de papel só surte efeito no próximo login.
Aceitável enquanto não houver revogação; se virar problema, ler o papel do banco em
`get_current_user` em vez do token — custo de uma consulta a mais por requisição, que já é
paga hoje.
