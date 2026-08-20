# DT-015 — Cadastro e gestão de usuários só existem via Swagger

| | |
|---|---|
| **Status** | Aberta |
| **Prioridade** | P2 |
| **Esforço** | Médio |
| **Artefato** | Frontend, Backend |
| **Registrada em** | 2026-08-20 |
| **Depende de** | DT-008 (autorização é pré-requisito) |

## Contexto

Não há tela de cadastro no painel. O primeiro acesso ao sistema exige que o usuário abra a
documentação interativa do FastAPI e execute `POST /auth/register` manualmente. A própria
tela de login exibe um aviso instruindo isso. Também não há tela de perfil, apesar de o
backend já expor `PUT /users/me` e `PUT /users/me/password`.

## Evidência

`src/pages/Login.tsx` renderiza:

> "Primeiro acesso ao MVP? O cadastro inicial ainda acontece no backend. Crie o usuario em
> /docs - POST /auth/register e depois volte para fazer login aqui."

`App.tsx` declara apenas `/login` e `/dashboard`. O item "Usuarios" do menu lateral não tem
rota. As rotas `PUT /users/me` e `PUT /users/me/password` do backend não são consumidas por
nenhum componente.

## Impacto

- Onboarding depende de conhecimento técnico de Swagger — inviável para qualquer usuário
  final e constrangedor em demonstração.
- Expor `/docs` publicamente é necessário para o fluxo atual funcionar, o que amplia a
  superfície de ataque.
- Funcionalidade de backend já implementada e testada está ociosa por falta de interface.
- Não há como desativar, promover ou remover um usuário sem acesso direto ao banco.

## Proposta

**Pré-requisito:** [DT-008](DT-008-autorizacao-por-papel.md) — sem autorização por papel,
uma tela de listagem de usuários expõe dados de todos a qualquer conta.

1. **Tela de perfil** (`/perfil`) consumindo `GET`/`PUT /users/me` e `PUT /users/me/password`.
   Esforço baixo, aproveita backend pronto, entrega valor imediato.
2. **Tela de gestão de usuários** (`/usuarios`), restrita a administradores: listar,
   ativar e desativar, alterar papel. Exige novos endpoints no backend, com paginação
   desde o início.
3. **Fluxo de primeiro acesso.** Escolher entre convite emitido por administrador ou
   cadastro público com aprovação. Decisão relacionada à abertura de `POST /auth/register`
   discutida em DT-008.
4. Remover o aviso sobre `/docs` da tela de login assim que houver fluxo real.
5. Avaliar desabilitar `/docs` e `/redoc` fora de desenvolvimento.

## Critérios de aceite

- [ ] Usuário autenticado consegue editar nome e username pelo painel
- [ ] Usuário autenticado consegue trocar a própria senha pelo painel
- [ ] Administrador consegue listar e desativar usuários
- [ ] Endpoint de listagem é paginado e exige papel de administrador
- [ ] Tela de login não instrui mais o uso do Swagger

## Notas

O item 1 é independente do restante e pode ser executado antes de DT-008 — a rota
`/users/me` já é protegida e opera apenas sobre o próprio usuário. Bom candidato a plano
curto de execução.
