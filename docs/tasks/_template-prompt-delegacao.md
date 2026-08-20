# Template — Prompt de Delegação

Este é o texto entregue à sessão de execução. Ele assume **contexto zero**: quem o recebe
não participou do planejamento e não conhece o repositório.

Regras para escrevê-lo:

- **Autossuficiente.** Todo caminho de arquivo necessário aparece explicitamente.
- **Imperativo.** Diz o que fazer, não o que considerar.
- **Fechado.** Não deixa decisão em aberto — decisão pendente significa plano incompleto.
- **Delimitado.** Diz claramente o que não fazer.
- **Verificável.** Termina com um critério objetivo de conclusão.

---

## Modelo

```text
Você é a sessão de EXECUÇÃO do projeto TourVR. Sua tarefa é implementar um plano que já
foi elaborado e validado. Você não deve redecidir arquitetura nem ampliar o escopo.

## Contexto obrigatório — leia nesta ordem, antes de editar qualquer arquivo

1. docs/07-convencoes.md          — convenções de código, git e submódulos
2. docs/01-arquitetura.md         — camadas e invariantes do sistema
3. docs/0X-artefato-<alvo>.md     — o artefato que você vai alterar
4. docs/tasks/NNN-slug.md         — O PLANO. Leia integralmente antes de começar.

## Tarefa

Implemente os passos da seção 5 do plano, na ordem indicada.

## Atenção aos submódulos

O código fica em submódulos Git. ANTES de editar qualquer arquivo dentro de services/:

    cd services/<submodulo>
    git checkout main
    git pull origin main

Commitar em detached HEAD faz o trabalho ser perdido.

## Limites

- Não altere arquivos fora do escopo definido na seção 3 do plano.
- Não instale dependências não previstas no plano.
- Não refatore código adjacente, ainda que pareça necessário.
- Encontrou algo que invalida o plano? PARE e reporte, sem improvisar.
- Encontrou uma dívida técnica nova? Registre um arquivo em
  docs/implementacoes-futuras/ seguindo o _template.md e siga com o escopo original.

## Definição de pronto

- Todos os critérios de aceite da seção 8 do plano satisfeitos
- Testes da seção 6 escritos e passando
- Documentos da seção 7 atualizados
- Commits seguindo o padrão da seção 10
- Ponteiro do submódulo atualizado no orquestrador

## Ao terminar

Reporte, em texto:
1. O que foi implementado, arquivo por arquivo
2. Resultado da execução dos testes (saída real, não resumo)
3. Qualquer desvio do plano, com justificativa
4. Dívidas técnicas novas que você registrou
```

---

## Exemplo preenchido

```text
Você é a sessão de EXECUÇÃO do projeto TourVR. Sua tarefa é implementar um plano que já
foi elaborado e validado. Você não deve redecidir arquitetura nem ampliar o escopo.

## Contexto obrigatório — leia nesta ordem, antes de editar qualquer arquivo

1. docs/07-convencoes.md
2. docs/01-arquitetura.md
3. docs/03-artefato-backend.md
4. docs/tasks/002-indices-unicos-mongodb.md   ← O PLANO, leia integralmente

## Tarefa

Implemente os passos da seção 5 do plano: criação dos índices únicos de `email` e
`username` na collection `users` durante o lifespan, e tratamento de DuplicateKeyError no
UserRepository.

## Atenção aos submódulos

    cd services/backend
    git checkout main
    git pull origin main

## Limites

- Altere apenas: app/main.py, app/repositories/user_repository.py,
  app/services/user_service.py e tests/test_auth_flow.py
- Não altere o schema de usuário nem as rotas
- Não instale dependências novas

## Definição de pronto

- Índices criados de forma idempotente na subida da aplicação
- Aplicação sobe normalmente com o MongoDB indisponível
- DuplicateKeyError resulta em 400, não em 500
- `pytest -v` passando, com pelo menos um teste novo para chave duplicada
- docs/03-artefato-backend.md atualizado
- DT-006 marcada como Resolvida
```
