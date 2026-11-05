# 004 — Qualidade do frontend

| | |
|---|---|
| **Status** | Validado |
| **Fase** | 0 — Fundação de qualidade |
| **Depende de** | 002 |
| **Dívidas atendidas** | DT-013 |
| **ADRs relacionadas** | nenhuma |
| **Artefatos afetados** | Frontend |
| **Planejado em** | 2026-11-05 |
| **Validado em** | 2026-11-05 por Ciro Macedo |
| **Executado em** | — |

---

## 1. Objetivo

Dar ao painel o mesmo rigor do backend: TypeScript estrito, ESLint com regras de tipo,
Prettier, testes com Vitest e Testing Library, e cobertura mínima de 80%. Os dois
componentes que excedem o tamanho máximo de função (`Login.tsx` e `Dashboard.tsx`) são
decompostos em componentes menores. A partir daqui, todo plano de frontend é reprovado se
quebrar essas regras.

## 2. Leia antes de começar

- `docs/04-artefato-frontend.md`
- `docs/07-convencoes.md` (seção Frontend — TypeScript / React)
- `docs/implementacoes-futuras/DT-013-qualidade-codigo-frontend.md`
- `docs/tasks/000-visao-macro-opcao-b.md` §6.1 (tabela de qualidade)

## 3. Estado esperado ao iniciar

- Plano 002 concluído (o painel sobe com `bash scripts/up.sh`).
- `services/frontend/package.json:11` — `lint` é só `tsc --noEmit`; nenhuma dependência de
  teste, ESLint ou Prettier (`package.json:20-27`).
- `services/frontend/tsconfig.json:2-25` — sem `strict`, `noUnusedLocals`,
  `noUnusedParameters`, `types`, nem `include`; contém `experimentalDecorators` e
  `useDefineForClassFields`, que o projeto não usa.
- `src/pages/Login.tsx:15-133` — a função `Login` tem cerca de 118 linhas (limite: 60).
- `src/pages/Dashboard.tsx:17-86` — a função `Dashboard` tem cerca de 70 linhas (limite: 60);
  constantes de menu e métricas nas linhas 5-15.
- `src/pages/Login.tsx:87` — `onSubmit={handleLogin}` passa função assíncrona para atributo
  JSX (a regra `no-misused-promises` acusa).
- `src/services/api.ts:5` — `import.meta.env.VITE_API_URL || ...`.
- Nenhum teste no repositório.

## 4. Escopo

**Dentro:**

- `tsconfig.json` estrito e correções de tipo resultantes;
- `eslint.config.js`, `.prettierrc`, `.prettierignore`, `vitest.config.ts`,
  `src/test/setup.ts`;
- scripts do `package.json` conforme 000 §6.1;
- decomposição de `Login.tsx` e `Dashboard.tsx` **sem mudar o que aparece na tela**;
- testes de `AuthContext`, `ProtectedRoute`, `Login`, `Dashboard` e dos componentes novos.

**Fora:**

- mudar textos, cores ou comportamento visível (o aviso de `/docs` sai no plano 011; as
  métricas falsas saem nos planos 011/015);
- interceptor de 401 (DT-010) — plano 011;
- tipos gerados do OpenAPI (DT-012) — plano 011;
- CI — plano 006.

## 5. Decisões tomadas no planejamento

| Questão | Decisão | Motivo |
|---|---|---|
| Configuração do ESLint | *Flat config* (`eslint.config.js`), `typescript-eslint` `strictTypeChecked` + `eslint-plugin-react-hooks` recomendado + `eslint-config-prettier` | 000 §6.1; Prettier cuida da formatação |
| Limites | `max-lines` 200 · `max-lines-per-function` 60 (sem linhas em branco e comentários) · `complexity` 10 · `no-magic-numbers` ignorando `-1, 0, 1, 2` | 000 §6.1 |
| Regras em testes | Desligar `no-magic-numbers`, `max-lines-per-function` e `@typescript-eslint/no-non-null-assertion` em `**/*.test.tsx?` | Testes têm literais e blocos longos de `describe` |
| Prettier | `singleQuote: true`, `semi: true`, `trailingComma: "all"`, `printWidth: 100` | Igual ao estilo atual do código |
| Ambiente de teste | Vitest + `jsdom` + `@testing-library/react` + `@testing-library/user-event` + `@testing-library/jest-dom` | Padrão do ecossistema Vite |
| Mock de HTTP | `vi.mock('../services/api')` | Sem servidor real em teste unitário; simples para quem lê |
| Cobertura | v8; 80% em linhas, funções, ramos e comandos; inclui `src/**/*.{ts,tsx}`, exclui `src/main.tsx`, `src/**/*.d.ts`, `src/types/**`, `src/test/**` | 000 §6.1 |
| Onde ficam os componentes extraídos | `src/components/login/` e `src/components/dashboard/`; constantes em `src/constants/dashboard.ts`; lógica do formulário em `src/hooks/useLoginForm.ts` | Separação por responsabilidade; páginas só compõem |
| Testes ao lado do código | `Arquivo.test.tsx` na mesma pasta do componente | Fácil de achar |

## 6. Passos de implementação

Todos no repositório `services/frontend`, branch `plano/004-qualidade-frontend`.

### Passo 1 — Dependências de desenvolvimento

```bash
npm install -D eslint @eslint/js typescript-eslint eslint-plugin-react-hooks \
  eslint-config-prettier globals prettier \
  vitest @vitest/coverage-v8 jsdom \
  @testing-library/react @testing-library/user-event @testing-library/jest-dom
```

Use as versões estáveis que o `npm` instalar (o `package-lock.json` fixa). `vitest` e
`@vitest/coverage-v8` precisam ter a **mesma** versão.

### Passo 2 — TypeScript estrito

**Arquivo:** `tsconfig.json` — remover `experimentalDecorators` e
`useDefineForClassFields`; acrescentar:

```json
"strict": true,
"noUnusedLocals": true,
"noUnusedParameters": true,
"noFallthroughCasesInSwitch": true,
"types": ["vite/client", "vitest/globals", "@testing-library/jest-dom"]
```

e, fora de `compilerOptions`, `"include": ["src", "vite.config.ts", "vitest.config.ts"]`.

Rode `npx tsc --noEmit` e corrija os erros. Esperado: `src/main.tsx:6` usa
`document.getElementById('root')!` — trocar por verificação explícita:

```tsx
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Elemento #root nao encontrado em index.html.');
}
createRoot(rootElement).render(...)
```

### Passo 3 — ESLint e Prettier

**Arquivo novo:** `eslint.config.js`

```js
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules', 'src/types/api.d.ts'] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      globals: globals.browser,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'max-lines': ['error', { max: 200, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['error', { max: 60, skipBlankLines: true, skipComments: true }],
      complexity: ['error', 10],
      'no-magic-numbers': ['error', { ignore: [-1, 0, 1, 2], ignoreArrayIndexes: true }],
    },
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx', 'src/test/**'],
    rules: {
      'no-magic-numbers': 'off',
      'max-lines-per-function': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  { files: ['*.config.js', '*.config.ts'], ...tseslint.configs.disableTypeChecked },
  prettier,
);
```

Se a versão instalada do `eslint-plugin-react-hooks` expuser a configuração plana com outro
nome (ex.: `reactHooks.configs.flat.recommended`), use esse nome — o resultado exigido é
o mesmo: as regras `rules-of-hooks` e `exhaustive-deps` ativas.

**Arquivo novo:** `.prettierrc`

```json
{ "singleQuote": true, "semi": true, "trailingComma": "all", "printWidth": 100 }
```

**Arquivo novo:** `.prettierignore` com `dist`, `coverage`, `node_modules`,
`package-lock.json`, `src/types/api.d.ts`.

### Passo 4 — Scripts

**Arquivo:** `package.json`, bloco `scripts` (manter `dev`, `build`, `preview`, `clean`):

```json
"lint": "eslint . && tsc --noEmit",
"format": "prettier --write .",
"format:check": "prettier --check .",
"test": "vitest run",
"test:coverage": "vitest run --coverage"
```

Rode `npm run format` e faça um commit só com a formatação.

### Passo 5 — Configuração de teste

**Arquivo novo:** `vitest.config.ts`

```ts
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/main.tsx', 'src/**/*.d.ts', 'src/types/**', 'src/test/**'],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
```

**Arquivo novo:** `src/test/setup.ts` com `import '@testing-library/jest-dom/vitest';` e
`afterEach(() => { localStorage.clear(); })`.

### Passo 6 — Decompor `Login.tsx`

Resultado esperado (mesma aparência e mesmo comportamento):

| Arquivo novo | Conteúdo |
|---|---|
| `src/hooks/useLoginForm.ts` | Estados `email`, `password`, `error`, `isLoading` e a função `submit(event)` (o atual `handleLogin`, `Login.tsx:32-55`). Retorna `{ email, setEmail, password, setPassword, error, isLoading, submit }` |
| `src/components/login/IconInput.tsx` | `<label>` + ícone + `<input>` reutilizado por e-mail e senha (hoje duplicado em `Login.tsx:88-120`). Props: `label`, `icon`, `type`, `value`, `onChange`, `placeholder` |
| `src/components/login/FirstAccessNotice.tsx` | O bloco azul de `Login.tsx:65-79` |
| `src/components/login/LoginForm.tsx` | Mensagem de erro + formulário + botão, recebendo o retorno de `useLoginForm` |

`src/pages/Login.tsx` fica só com: `useAuth()`, os dois retornos antecipados (loader e
`Navigate`), e a composição do cartão. O `onSubmit` usa
`onSubmit={(event) => { void submit(event); }}`.

O `<label>` passa a ter `htmlFor` ligado ao `id` do input (exigido pelos testes com
`getByLabelText`); `id` gerado com `useId()`.

### Passo 7 — Decompor `Dashboard.tsx`

| Arquivo novo | Conteúdo |
|---|---|
| `src/constants/dashboard.ts` | `navigationItems` e `dashboardMetrics` (`Dashboard.tsx:5-15`), exportados |
| `src/components/dashboard/Sidebar.tsx` | `<aside>` com título, menu e botão "Sair do sistema"; prop `onLogout` |
| `src/components/dashboard/MetricCards.tsx` | A grade de cartões |
| `src/components/dashboard/UserDataPanel.tsx` | O bloco com o JSON de `/users/me`; prop `user` |

`src/pages/Dashboard.tsx` compõe os três e mantém `handleLogout`.

### Passo 8 — Corrigir o lint restante

Rode `npm run lint` e corrija tudo. Casos previstos:

- `@typescript-eslint/no-unnecessary-condition` e `restrict-template-expressions`:
  corrigir o tipo, não desligar a regra.
- `src/services/api.ts:5`: trocar `||` por `??` somente se o lint pedir; manter o mesmo
  comportamento para string vazia (`import.meta.env.VITE_API_URL || ...` trata `''` como
  ausente — se trocar, documente no PR que `VITE_API_URL=` vazio passa a ser respeitado;
  prefira manter `||` com `// eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- string vazia deve cair no padrao`).
- `console.error` é permitido (não há regra contra).

### Passo 9 — Testes

Crie os testes da seção 7. Padrão para mockar a API:

```ts
vi.mock('../services/api', () => ({
  api: { get: vi.fn(), post: vi.fn() },
  getStoredToken: vi.fn(),
  setAuthToken: vi.fn(),
  clearAuthToken: vi.fn(),
  API_DOCS_URL: 'http://api.test/docs',
}));
```

Componentes com rota são renderizados dentro de `MemoryRouter`; os que usam `useAuth`,
dentro de `AuthProvider` (com a API mockada) ou com `vi.mock('../contexts/AuthContext')`.

### Passo 10 — Documentação

No orquestrador, branch `plano/004-qualidade-frontend`:

- `docs/04-artefato-frontend.md`: **Stack** (ESLint, Prettier, Vitest); **Estrutura** com
  as pastas novas (`components/login`, `components/dashboard`, `constants`, `hooks`,
  `test`); tabela de scripts; remover "Não há testes automatizados nem linter"; marcação
  `⚠️ sem strict` do `tsconfig.json` sai.
- `docs/07-convencoes.md`, Frontend: "Verificação mínima antes do commit: `npm run lint`,
  `npm run format:check`, `npm run test:coverage`".
- `services/frontend/README.md`: seção "Como testar" com os três comandos.

## 7. Testes

| Arquivo | Teste | Verifica |
|---|---|---|
| `src/contexts/AuthContext.test.tsx` | restaura sessão com token válido | `user` preenchido após `GET /users/me` |
| | token salvo inválido | `clearAuthToken` chamado, `user` nulo, `loading` falso |
| | `signOut` | limpa token e usuário |
| | `useAuth` fora do provider | lança o erro em português |
| `src/components/ProtectedRoute.test.tsx` | carregando | mostra o loader |
| | sem sessão | redireciona para `/login` |
| | com sessão | renderiza a rota filha |
| `src/pages/Login.test.tsx` | login com sucesso | `POST /auth/login`, `signIn` e navegação para `/dashboard` |
| | erro do backend | mostra o `detail` retornado |
| | erro sem `detail` | mostra "Credenciais invalidas. Tente novamente." |
| | já autenticado | redireciona para `/dashboard` |
| `src/components/login/IconInput.test.tsx` | digitação | chama `onChange` com o valor |
| `src/pages/Dashboard.test.tsx` | nome exibido | usa `full_name`, depois `username`, depois `email` |
| | sair | chama `signOut` e navega para `/login` |

```bash
cd services/frontend
npm run lint
npm run format:check
npm run test:coverage
npm run build
```

## 8. Documentação a atualizar

- [ ] `docs/04-artefato-frontend.md` — passo 10
- [ ] `docs/07-convencoes.md` — passo 10
- [ ] `services/frontend/README.md` — passo 10
- [ ] `docs/implementacoes-futuras/DT-013-...md` — `Resolvida` (o item "lint e testes em
      PR" fica para o plano 006; anotar isso)
- [ ] `docs/implementacoes-futuras/README.md` — índice

## 9. Critérios de aceite

- [ ] Os quatro comandos da seção 7 terminam com código 0
- [ ] Cobertura ≥ 80% em linhas, funções, ramos e comandos
- [ ] Pelo menos os 14 testes da seção 7
- [ ] Nenhuma função acima de 60 linhas, nenhum arquivo acima de 200
- [ ] Nenhuma regra desligada além das da seção 5 (exceção justificada do passo 8)
- [ ] Tela de login e dashboard visualmente idênticas às de antes
- [ ] Documentação atualizada

## 10. Commits esperados

`services/frontend`:

```
build: adiciona eslint, prettier e vitest
build: ativa o modo strict do typescript
style: aplica prettier em todo o projeto
refactor: decompoe a pagina de login em componentes e hook
refactor: decompoe o dashboard em componentes
fix: corrige avisos do eslint com regras de tipo
test: cobre autenticacao, guarda de rota, login e dashboard
docs: atualiza o README com os comandos de verificacao
```

Orquestrador:

```
docs: documenta lint, testes e estrutura do frontend
docs: marca DT-013 como resolvida
```

## 11. Riscos e pontos de atenção

- **`strictTypeChecked` é rigoroso**: pode acusar dezenas de pontos. Corrija um arquivo de
  cada vez e rode `npm run lint` com frequência.
- **`StrictMode` executa efeitos duas vezes em desenvolvimento**, mas não nos testes; não
  escreva teste que dependa do número de chamadas de `GET /users/me` maior que 1.
- **`eslint .` lê `vite.config.ts`** com o bloco `disableTypeChecked`; se acusar
  `__dirname`, acrescente `globals.node` só para os arquivos de configuração.
- **Volume `node_modules` do compose**: depois de instalar dependências novas localmente,
  o container ainda tem as antigas. Rode `docker compose up -d --build frontend` para
  conferir no navegador.

## 12. Verificação pelo aluno

1. `bash scripts/up.sh` e abra `http://localhost:3000`: a tela de login está **igual** à de
   antes. Entre com seu usuário de teste: o dashboard também está igual.
2. No terminal: `cd services/frontend` e `npm run test:coverage`. Aparece a lista de testes
   com ✓ verde e uma tabela de cobertura com "All files" acima de 80.
3. Abra `src/pages/Login.tsx` no VS Code: o arquivo ficou curto e usa componentes como
   `LoginForm`.

---

## Prompt de delegação

Cole no Claude Code, na pasta `quest-project`, trocando o nome:

```text
Você é a sessão de EXECUÇÃO do projeto TourVR.
Execute o plano docs/tasks/004-qualidade-frontend.md.
Antes de qualquer ação, leia docs/tasks/protocolo-execucao.md e siga o "Prompt 1 — EXECUTAR" etapa por etapa.
Meu nome, para registrar no plano: <SEU NOME>
```
