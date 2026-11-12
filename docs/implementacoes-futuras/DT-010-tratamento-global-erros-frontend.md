# DT-010 — Frontend sem interceptor de resposta para token expirado

| | |
|---|---|
| **Status** | Resolvida (plano 011) |
| **Prioridade** | P1 |
| **Esforço** | Baixo |
| **Artefato** | Frontend |
| **Registrada em** | 2026-08-20 |
| **Depende de** | nada; relacionada a DT-007 |

## Contexto

O `services/api.ts` registra um interceptor de **request** que injeta o header
`Authorization` em toda chamada. Não existe interceptor de **response**. Quando o token
expira durante a sessão — o que acontece a cada 60 minutos —, as chamadas passam a receber
`401` e nada acontece: o usuário continua vendo a interface, mas nenhuma ação funciona.

## Evidência

`src/services/api.ts` — só há `api.interceptors.request.use(...)`. Nenhuma ocorrência de
`interceptors.response`.

O tratamento de erro existe apenas dentro do `handleLogin` de `Login.tsx`, que lê
`error.response?.data?.detail`. As demais chamadas não tratam falha de autenticação.

## Impacto

- **Falha silenciosa.** O usuário permanece em `/dashboard`, aparentemente autenticado,
  enquanto toda chamada retorna `401`. Não há mensagem, não há redirecionamento.
- O problema é permanente até que a página seja recarregada — só então o `AuthContext`
  revalida o token e derruba a sessão.
- Erros de servidor (`500`) e de rede também não têm tratamento algum: a interface
  simplesmente não reage.
- É o defeito mais visível para quem for demonstrar o sistema, porque ocorre exatamente
  em sessões longas, como uma apresentação.

## Proposta

1. Adicionar interceptor de resposta em `services/api.ts` que, ao receber `401`, limpe o
   token e redirecione para `/login`.
2. Não chamar `signOut()` diretamente de dentro do módulo de API — isso acopla o serviço
   ao React. Emitir um evento ou expor um callback registrado pelo `AuthProvider`.
3. Ignorar o `401` originado da própria rota de login, para não interferir na mensagem de
   credenciais inválidas.
4. Tratar `403` (conta inativa) com mensagem específica, distinta de sessão expirada.
5. Exibir aviso ao usuário — "sua sessão expirou, entre novamente" — em vez de um
   redirecionamento mudo.

## Critérios de aceite

- [x] Com token expirado, a próxima chamada redireciona para `/login` automaticamente
- [x] O usuário vê uma mensagem explicando o motivo
- [x] Erro de credenciais no login continua exibindo a mensagem do backend, sem
      redirecionamento indevido
- [x] `403` de conta inativa é distinguível de sessão expirada

## Notas

Resolve-se em poucas dezenas de linhas e elimina o defeito mais perceptível do painel.
Bom candidato para o primeiro plano de execução do frontend.

**Resolução (2026-11-12, plano 011).** `src/services/api.ts` registra um interceptor de
resposta: `401` fora de `POST /auth/login` limpa o token e chama o handler que o
`AuthProvider` registra com `setUnauthorizedHandler` — o módulo HTTP não importa React. O
contexto zera o usuário e expõe `sessionNotice` ("Sua sessão expirou. Entre novamente."),
exibido pela tela de login. `403` não derruba a sessão: fica com a tela que chamou. Erros
`500` e de rede seguem sem tratamento global (cada tela trata os seus). Detalhes em
[04-artefato-frontend.md](../04-artefato-frontend.md#fluxo-de-autenticação).
