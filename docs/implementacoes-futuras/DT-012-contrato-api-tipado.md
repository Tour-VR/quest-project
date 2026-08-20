# DT-012 — Contrato da API duplicado manualmente entre backend e frontend

| | |
|---|---|
| **Status** | Aberta |
| **Prioridade** | P2 |
| **Esforço** | Médio |
| **Artefato** | Frontend, Backend |
| **Registrada em** | 2026-08-20 |
| **Depende de** | nada |

## Contexto

O contrato da API existe em dois lugares independentes: nos schemas Pydantic do backend e
nas interfaces TypeScript do frontend. Nada garante que os dois concordem — e eles já não
concordam.

## Evidência

`src/types/index.ts` define:

```ts
export interface User {
  email: string;
  full_name: string | null;
  username: string | null;
  role: string;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
}
```

O backend, em `app/schemas/user.py`, inclui também `is_verified: bool = False` em
`UserResponse`, do qual `UserMeResponse` herda. O campo é retornado por `/users/me` e o
frontend não o conhece.

O FastAPI já publica um schema OpenAPI completo em `/openapi.json`, hoje não utilizado
para nada além da documentação interativa.

## Impacto

- Hoje é inofensivo — TypeScript apaga os tipos na compilação e o campo extra é ignorado.
- O risco cresce com o domínio de turismo ([DT-016](DT-016-modelagem-dominio-turismo.md)):
  com dezenas de campos, divergências deixam de ser detectáveis por leitura.
- Uma renomeação de campo no backend não quebra a compilação do frontend — falha só em
  execução, provavelmente durante uma demonstração.
- Trabalho manual repetido a cada mudança de contrato, propenso a esquecimento.

## Proposta

1. **Correção imediata:** acrescentar `is_verified: boolean` à interface `User`.
2. **Estrutural:** gerar os tipos TypeScript a partir do `/openapi.json` do backend, com
   `openapi-typescript` ou equivalente, gravando em `src/types/api.d.ts`.
3. Adicionar script `npm run gen:types` e documentar quando executá-lo.
4. **Opcional, mais forte:** verificar em CI que os tipos gerados estão atualizados — o
   pipeline regenera e falha se houver diferença, tornando a divergência impossível.
5. Manter `docs/06-contrato-api.md` como a descrição legível do contrato; os tipos gerados
   são a garantia mecânica, o documento é a explicação.

## Critérios de aceite

- [ ] `is_verified` presente na interface `User`
- [ ] Tipos da API gerados a partir do OpenAPI, não escritos à mão
- [ ] Script de geração documentado
- [ ] Divergência entre backend e tipos do frontend quebra o build ou a CI

## Notas

Um passo intermediário barato: um teste no backend que compare o `/openapi.json` gerado
com um snapshot versionado, tornando qualquer alteração de contrato visível no diff do
pull request.
