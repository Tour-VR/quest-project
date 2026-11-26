# 024 — Edição dos dados básicos de usuários

| | |
|---|---|
| **Status** | Concluído |
| **Fase** | 5 — Produção |
| **Depende de** | 015 |
| **Dívidas atendidas** | nenhuma |
| **ADRs relacionadas** | ADR-0003 (o `sub` do token é o e-mail) |
| **Artefatos afetados** | Backend · Frontend · Orquestrador (documentação) |
| **Planejado em** | 2026-11-26 |
| **Validado em** | 2026-11-26 por Ciro Macedo (pedido direto, em produção) |
| **Executado em** | 2026-11-26 pelo agente na sessão do orientador — PRs: [Tour-VR/backend#11](https://github.com/Tour-VR/backend/pull/11), [Tour-VR/frontend#11](https://github.com/Tour-VR/frontend/pull/11), [Tour-VR/quest-project#24](https://github.com/Tour-VR/quest-project/pull/24) |

---

## 1. Objetivo

Permitir que o administrador corrija e-mail, nome completo e username de qualquer usuário
pelo painel. Motivação: em produção, um usuário foi cadastrado com e-mail errado e não havia
como corrigir (o plano 015 só previa papel e situação).

## 2. Leia antes de começar

- `docs/06-contrato-api.md` — `PATCH /admin/users/{user_id}`
- `docs/04-artefato-frontend.md` — tela de usuários

## 3. Estado esperado ao iniciar

- `app/schemas/user.py:137` — `UserAdminUpdate` só com `is_active` e `role`.
- `app/services/user_service.py` — `update_user_admin` usa `model_dump(exclude_none=True)`.
- `app/repositories/user_repository.py` — `update_user_by_id` não traduz `DuplicateKeyError`.
- Painel: `src/pages/users/UserRow.tsx` só com papel e ativar/desativar.

## 4. Escopo

**Dentro:** editar `email`, `full_name` e `username` pelo `PATCH` existente; botão
"Editar" e janela de edição no painel; testes; contrato e documento do painel.

**Fora:** excluir usuário; redefinir a senha de outro usuário; trocar o `sub` do token
para o `id` (resolveria a sessão invalidada pela mudança de e-mail, mas muda a ADR-0003).

## 5. Decisões tomadas no planejamento

| Questão | Decisão | Motivo |
|---|---|---|
| Rota | Estender `PATCH /admin/users/{user_id}` | Uma rota para toda edição administrativa; contrato compatível |
| Ausente × `null` | `exclude_unset`; `null` limpa `full_name`/`username` e é ignorado em `email`, `is_active`, `role` | Permite limpar campos opcionais sem arriscar apagar obrigatórios |
| Conflito | Checagem prévia (mensagem amigável) + tradução de `DuplicateKeyError` → `400` | Mesmo padrão do cadastro (DT-006) |
| Próprio e-mail | Permitido; o painel encerra a sessão em seguida | O token usa o e-mail como `sub` e deixa de valer |

## 6. Passos de implementação

1. Backend — `UserAdminUpdate` ganha `email`, `full_name`, `username` com os validadores do
   cadastro; `update_user_admin` usa `_admin_update_data` e `_ensure_identity_available`;
   `update_user_by_id` traduz `DuplicateKeyError`.
2. Painel — tipo `UserAdminUpdate` em `src/types/api.d.ts`; hook `useUserEditForm`;
   `UserEditDialog`; botão "Editar" em `UserRow` (ações extraídas para `UserActions`);
   estado da janela e aviso em `UsersPage`.

## 7. Testes

| Arquivo | Verifica |
|---|---|
| `tests/test_admin_users.py` | edição normalizada; limpar nome/username; `null` ignorado; mesmo e-mail sem checagem; conflito de e-mail/username; violação de índice → 400; e-mail inválido → 422 |
| `tests/test_user_repository.py` | `update_user_by_id` traduz `DuplicateKeyError` |
| `src/pages/users/UsersPageEdit.test.tsx` | editar outro usuário; erro na janela; cancelar; próprio e-mail encerra a sessão; próprio nome mantém a sessão |

Resultado: backend 95% de cobertura, ruff e mypy limpos; painel 206 testes, 99% de linhas,
lint e build limpos.

## 8. Documentação a atualizar

- [x] `docs/06-contrato-api.md` — `PATCH /admin/users/{user_id}`
- [x] `docs/04-artefato-frontend.md` — tela de usuários

## 9. Critérios de aceite

- [x] Admin corrige o e-mail de um usuário pelo painel e a pessoa entra com o novo e-mail
- [x] E-mail ou username de outro usuário é recusado com mensagem clara
- [x] Testes e validações passando

## 10. Commits esperados

Backend e painel, branch `plano/024-edicao-de-usuarios`:
`feat(admin-users): ...` e `feat(usuarios): ...`; orquestrador: `docs: ...`.

## 11. Riscos e pontos de atenção

- Quem tiver o e-mail alterado e estiver logado recebe "sessão expirada" na próxima ação.

## 12. Verificação pelo aluno

1. Em "Usuários", clique em "Editar" na linha de um colega, corrija o e-mail e salve.
2. A mensagem "Dados do usuário atualizados." aparece e a lista mostra o novo e-mail.
3. O colega entra no painel com o novo e-mail e a mesma senha.

---

## Registro de execução

Planejado e executado na mesma sessão, a pedido do orientador, para corrigir um cadastro em
produção. Sem desvios.
