# DT-013 — Frontend sem testes, sem linter e sem modo estrito

| | |
|---|---|
| **Status** | Resolvida — 2026-11-10 — [plano 004](../tasks/004-qualidade-frontend.md) |
| **Prioridade** | P2 |
| **Esforço** | Médio |
| **Artefato** | Frontend |
| **Registrada em** | 2026-08-20 |
| **Depende de** | nada; potencializado por DT-003 |

## Contexto

O backend tem 24 testes e separação de camadas disciplinada. O frontend não tem nenhum
teste, nenhum linter de estilo e opera com TypeScript em modo permissivo. A assimetria de
rigor entre os dois submódulos é grande e tende a piorar conforme o painel cresce.

## Evidência

`package.json` — nenhuma dependência de teste (`vitest`, `jest`, `@testing-library/*`) ou
de lint (`eslint`, `prettier`). O script `lint` executa apenas `tsc --noEmit`.

`tsconfig.json` — ausência de `strict`, `noUnusedLocals`, `noUnusedParameters` e
`noFallthroughCasesInSwitch`. Também falta `"types": ["vite/client"]`, embora
`vite-env.d.ts` supra a referência.

Sem `.eslintrc`, `eslint.config.js` ou `.prettierrc` no repositório.

## Impacto

- **Sem `strict`,** o compilador aceita `null` e `undefined` implícitos. O código atual
  lida com `user: User | null` em vários pontos; erros de acesso a propriedade de `null`
  passam despercebidos.
- **Sem testes,** uma alteração no `AuthContext` pode quebrar a restauração de sessão sem
  que ninguém perceba antes de rodar a aplicação manualmente.
- **Sem linter,** o estilo diverge entre alunos e os diffs enchem-se de ruído de formatação,
  dificultando revisão.
- Em contexto acadêmico, perde-se a oportunidade de ensinar teste de front-end.

## Proposta

1. Ativar `"strict": true` no `tsconfig.json` e corrigir os erros que surgirem. Fazer isso
   agora, com 414 linhas, é barato; depois deixa de ser.
2. Acrescentar `noUnusedLocals`, `noUnusedParameters` e `"types": ["vite/client"]`.
3. Configurar ESLint com os presets recomendados de TypeScript e React Hooks, mais
   Prettier para formatação. Integrar ao script `lint`.
4. Instalar Vitest + Testing Library e cobrir o núcleo:
   - `AuthContext` — restaurar sessão com token válido, com token inválido, e logout;
   - `ProtectedRoute` — redireciona sem sessão, renderiza com sessão, exibe loader durante
     a verificação;
   - `Login` — submissão bem-sucedida, exibição de erro do backend.
5. Ligar `lint` e `test` na CI ([DT-003](DT-003-pipeline-ci-cd.md)).

## Critérios de aceite

- [x] `strict: true` ativo e `npm run lint` passando sem erros
- [x] ESLint e Prettier configurados e executando via script
- [x] Ao menos 6 testes cobrindo autenticação, guard de rota e login
- [ ] Lint e testes executados automaticamente em pull request — fica para o
      [plano 006](../tasks/006-integracao-continua.md) (CI)

## Notas

Ativar `strict` em um projeto pequeno é questão de uma tarde. O custo cresce
proporcionalmente ao código — esta dívida encarece sozinha com o tempo.

## Resolução

Resolvida pelo [plano 004](../tasks/004-qualidade-frontend.md): `tsconfig.json` em modo
`strict` (com `@types/react` e `@types/react-dom`, que faltavam), ESLint em *flat config*
com `strictTypeChecked`, `react-hooks` e limites de tamanho e complexidade, Prettier, e
Vitest + Testing Library com cobertura mínima de 80%. `Login.tsx` e `Dashboard.tsx`
decompostos em componentes menores sem mudar a tela. 26 testes, cobertura de ~99% das
linhas. O item "lint e testes em pull request" fica para o plano 006 (CI). Detalhes em
[04-artefato-frontend.md](../04-artefato-frontend.md#regras-de-qualidade).
