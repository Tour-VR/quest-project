# DT-005 — READMEs dos submódulos divergem do código

| | |
|---|---|
| **Status** | Resolvida — 2026-11-09 — [plano 002](../tasks/002-ambiente-docker-compose.md), commits `4ded590` (backend) e `d30644f` (frontend) |
| **Prioridade** | P2 |
| **Esforço** | Baixo |
| **Artefato** | Backend, Frontend |
| **Registrada em** | 2026-08-20 |
| **Depende de** | ADR-0004 |

## Contexto

Os READMEs de `backend` (605 linhas) e `frontend` (524 linhas) são bem escritos e
detalhados, mas descrevem uma versão anterior do código. Quem seguir suas instruções vai
errar. Como a base de conhecimento passou a ser centralizada em `docs/` (ADR-0004), esses
READMEs devem ser reduzidos a instruções operacionais e apontar para cá.

## Evidência

Divergências verificadas no README do backend:

| README afirma | Código faz |
|---|---|
| Classe `MongoDBManager` | A classe é `MongoManager` (`app/core/database.py`) |
| "16 testes" | São 24 (18 em `test_auth_flow.py`, 6 em `test_health.py`) |
| Apenas `GET /users/me` | Existem também `PUT /users/me` e `PUT /users/me/password` |
| E-mail duplicado retorna `409` | Retorna `400` (`app/api/v1/routes/auth.py:26`) |
| Usuário inexistente retorna `404` | Retorna `401` (`AuthenticationError`) |
| Login apenas por e-mail | Aceita e-mail **ou** username (`find_by_email_or_username`) |
| `UserModel` sem `is_verified` | O campo existe e é retornado pela API |
| Rotas sob prefixo `/api/v1` | Router incluído sem prefixo — rotas em `/auth` e `/users` |
| Executar `install-backend.ps1` | O script não existe em repositório algum |
| Diretório `Oculos VR backend/` | O diretório é `services/backend/` |

No frontend, a seção de limitações é precisa e foi aproveitada nas dívidas deste
diretório; as instruções de instalação apontam para os mesmos scripts inexistentes.

## Impacto

- Aluno novo perde tempo seguindo instruções que falham.
- Agente de IA que carregue o README como contexto produz código baseado em premissas
  erradas — nomes de classe, códigos de status e rotas inexistentes.
- Documentação em que não se pode confiar é pior do que documentação ausente: cria falsa
  segurança e é descoberta tarde.

## Proposta

1. Substituir o `README.md` de cada submódulo por uma versão curta (30–50 linhas):
   identificação do serviço, stack, comando de instalação, comando de execução, comando de
   teste e link para `docs/` no orquestrador.
2. Migrar para `docs/` qualquer conteúdo dos READMEs atuais que seja correto e ainda não
   esteja coberto.
3. Commitar em cada submódulo e atualizar o ponteiro no orquestrador.
4. Registrar em `docs/07-convencoes.md` (já feito) que arquitetura mora em `docs/`.

## Critérios de aceite

- [x] README do backend com no máximo 60 linhas, sem afirmação divergente do código
- [x] README do frontend com no máximo 60 linhas, sem afirmação divergente do código
- [x] Ambos apontam para `docs/` no orquestrador
- [x] Nenhum README cita script inexistente

## Notas

Não apagar o conteúdo bom por descuido — a seção de limitações do frontend e o guia de
leitura ordenada do backend têm valor didático e merecem sobreviver dentro de `docs/`.

## Resolução

Resolvida pelo plano 002: os READMEs dos dois submódulos foram reduzidos a menos de 50
linhas (como rodar, como testar, links para `docs/`), sem citar scripts inexistentes. O
guia de leitura do backend e os problemas comuns dos dois READMEs antigos foram levados
para [03-artefato-backend.md](../03-artefato-backend.md) e
[04-artefato-frontend.md](../04-artefato-frontend.md); a seção de limitações do frontend
já estava consolidada em `04` e nas dívidas.
