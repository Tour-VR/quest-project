# 016 — Fundação do app do visitante

| | |
|---|---|
| **Status** | Validado |
| **Fase** | 3 — App do visitante, modo AR |
| **Depende de** | 006 |
| **Dívidas atendidas** | DT-016 (parcial: o consumidor do domínio passa a existir) |
| **ADRs relacionadas** | ADR-0006 |
| **Artefatos afetados** | VR App · Orquestrador |
| **Planejado em** | 2026-11-05 |
| **Validado em** | 2026-11-05 por Ciro Macedo |
| **Executado em** | — |

---

## 1. Objetivo

Criar do zero o projeto `services/vr-app`, o app do visitante: React + Vite + TypeScript,
com as mesmas regras de qualidade do painel, integrado ao Docker Compose, ao
`validate.sh` e à CI. Ao fim do plano, `http://localhost:3001` mostra uma página inicial
provisória que confirma a conexão com a API pelo *proxy*. As telas de verdade vêm nos
planos 017 a 021.

## 2. Leia antes de começar

- `docs/05-artefato-vr-app.md`: estrutura de pastas prevista
- `docs/08-decisoes-arquiteturais.md`: ADR-0006
- `docs/04-artefato-frontend.md`: o painel, que serve de modelo
- `docs/tasks/004-qualidade-frontend.md`: configurações de lint, formatação e testes a
  **copiar**
- `docs/tasks/005-validacao-e-e2e.md` e `docs/tasks/006-integracao-continua.md`: como o
  `validate.sh` e a CI estão organizados

## 3. Estado esperado ao iniciar

- `services/vr-app/` contém só `LICENSE` e `README.md` (commit `4e6f85f`, "Initial commit").
- Planos 002 a 006 concluídos:
  - `docker-compose.yml` na raiz com `mongo`, `backend` e `frontend`;
  - `services/frontend` com `eslint.config.js`, `.prettierrc`, `vitest.config.ts`,
    `tsconfig.json` estrito e os scripts `lint`, `format`, `format:check`, `test`,
    `test:coverage`, `build` e `gen:types` (este último criado no 011; se o 011 ainda não
    estiver concluído, o `gen:types` do vr-app é criado aqui do mesmo modo);
  - `scripts/validate.sh`, com uma etapa `vr-app` que é pulada quando
    `services/vr-app/package.json` não existe;
  - `.github/workflows/ci.yml` no backend, no frontend e no orquestrador.
- O backend responde `GET /health/` em `http://localhost:8000`.

Se algum desses itens não existir, **pare** (ver protocolo, "Quando parar").

## 4. Escopo

**Dentro:**

- projeto Vite + React 19 + TS + Tailwind 4 + react-router 7 em `services/vr-app`;
- lint, formatação, testes e cobertura idênticos aos do painel;
- cliente HTTP `src/core/api/client.ts` com base `/api` e *proxy* do Vite;
- script `dev:https` com certificado autoassinado, para testes na rede local;
- estrutura de pastas `src/core`, `src/modes/ar`, `src/modes/vr`, `src/routes`;
- página inicial provisória com o estado da API;
- `Dockerfile.dev`, serviço `vr-app` no compose, workflow de CI;
- README curto do submódulo.

**Fora:**

- lista de pontos e página do ponto: plano 017;
- leitor de QR: plano 018;
- qualquer código de three.js ou WebXR: planos 020 e 021;
- build de produção servido por Nginx: não faz parte do projeto acadêmico.

## 5. Decisões tomadas no planejamento

| Questão | Decisão | Motivo |
|---|---|---|
| Como o app chama a API | Caminho relativo `/api/...`, com *proxy* do Vite que remove o prefixo `/api` | Mesma origem: sem CORS e sem conteúdo misto quando a página estiver em HTTPS |
| Mídia | `/media/...` também passa pelo *proxy*, para o mesmo backend | Texturas WebGL de mesma origem não precisam de CORS (plano 020) |
| Alvo do *proxy* | Variável `VITE_PROXY_TARGET`, padrão `http://localhost:8000`; no compose, `http://backend:8000` | Funciona com e sem Docker |
| HTTPS local | `@vitejs/plugin-basic-ssl`, ativado só no script `dev:https` (`--mode https`) | Câmera (018) e WebXR (020) exigem contexto seguro fora de `localhost` |
| Rede local | `server.host: true` (escuta em `0.0.0.0`) | Celular e Quest acessam pelo IP da máquina |
| Tooling | Cópia das configurações do painel (plano 004), mesmos limites | Uma única regra para os dois apps; `jscpd` não analisa arquivos de configuração |
| Tipos da API | `openapi-typescript` → `src/core/types/api.d.ts`, script `gen:types`, arquivo versionado | Mesmo mecanismo do painel (plano 011) |
| Estado | `useState` + Context; sem bibliotecas de estado | `docs/07-convencoes.md` |

Versões (faixas compatíveis com React 19):

| Pacote | Faixa |
|---|---|
| `react`, `react-dom` | `^19.0.0` |
| `react-router-dom` | `^7.13.1` |
| `axios` | `^1.13.6` |
| `vite` | `^6.2.0` |
| `@vitejs/plugin-react` | `^5.0.4` |
| `@vitejs/plugin-basic-ssl` | `^2.0.0` |
| `tailwindcss`, `@tailwindcss/vite` | `^4.1.14` |
| `typescript` | `~5.8.2` |
| `openapi-typescript` | `^7.0.0` |
| demais ferramentas de dev | as **mesmas versões** do `services/frontend/package.json` |

Antes de instalar, rode `npm view <pacote> peerDependencies` para cada pacote novo
(`@vitejs/plugin-basic-ssl`, `openapi-typescript`) e confira que a faixa aceita a versão
de Vite e TypeScript acima. Se houver conflito, **pare** e reporte. Não use `--force` nem
`--legacy-peer-deps`.

## 6. Passos de implementação

Todos os passos de 1 a 7 acontecem em `services/vr-app` (branch `plano/016-fundacao-app-visitante`).

### Passo 1 — Criar o projeto

Crie à mão (não use `npm create vite`, que gera arquivos que não queremos):

```
services/vr-app/
├── index.html                 lang="pt-BR", <title>TourVR</title>, meta viewport
├── package.json               name "tourvr-visitor-app", "type": "module"
├── tsconfig.json              cópia do painel (strict, noUnusedLocals...) com "include": ["src", "vite.config.ts"]
├── vite.config.ts             passo 2
├── vite-env.d.ts              /// <reference types="vite/client" /> + tipagem de ImportMetaEnv
├── .env.example               VITE_PROXY_TARGET=http://localhost:8000
├── .gitignore                 cópia do .gitignore do painel
└── src/
    ├── main.tsx
    ├── App.tsx                export default (exceção da convenção)
    ├── index.css              @import "tailwindcss";
    ├── core/
    │   ├── api/client.ts
    │   ├── api/health.ts
    │   ├── types/api.d.ts     gerado (passo 4)
    │   ├── types/index.ts     aliases
    │   ├── constants/routes.ts
    │   ├── hooks/
    │   └── components/
    ├── modes/ar/              (vazio até o 017: crie só quando houver arquivo)
    ├── modes/vr/              (vazio até o 020)
    └── routes/
        ├── AppRoutes.tsx
        └── HomePage.tsx
```

Não crie pasta vazia com `.gitkeep`: `docs/README.md` proíbe arquivo sem conteúdo. As
pastas `modes/` nascem nos planos seguintes.

Scripts do `package.json` (mesmos nomes do painel, mais `dev:https`):

```json
{
  "dev": "vite --port=3001",
  "dev:https": "vite --port=3001 --mode https",
  "build": "tsc --noEmit && vite build",
  "preview": "vite preview --port=3001",
  "lint": "eslint . && tsc --noEmit",
  "format": "prettier --write .",
  "format:check": "prettier --check .",
  "test": "vitest run",
  "test:coverage": "vitest run --coverage",
  "gen:types": "node scripts/gen-types.mjs"
}
```

**Arquivo novo:** `scripts/gen-types.mjs` — mesmo conteúdo do painel (plano 011), lendo
`process.env.VITE_PROXY_TARGET` (padrão `http://localhost:8000`) e gravando em
`src/core/types/api.d.ts`.

### Passo 2 — `vite.config.ts` com *proxy* e HTTPS opcional

```ts
import basicSsl from '@vitejs/plugin-basic-ssl';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

const DEFAULT_PROXY_TARGET = 'http://localhost:8000';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.VITE_PROXY_TARGET ?? DEFAULT_PROXY_TARGET;
  return {
    plugins: [react(), tailwindcss(), ...(mode === 'https' ? [basicSsl()] : [])],
    server: {
      host: true,
      proxy: {
        '/api': { target, changeOrigin: true, rewrite: (p) => p.replace(/^\/api/, '') },
        '/media': { target, changeOrigin: true },
      },
    },
  };
});
```

**Verificação:** com o backend no ar, `npm run dev` e depois
`curl http://localhost:3001/api/health/` devolve o JSON do `/health/` do backend.

### Passo 3 — Qualidade: ESLint, Prettier, Vitest

Copie do painel, sem alterar limites: `eslint.config.js`, `.prettierrc`,
`.prettierignore`, `vitest.config.ts` e o `setupTests` correspondente. Copie as
`devDependencies` de lint e teste com as **mesmas versões**. Ajustes permitidos:

- `vitest.config.ts`: `coverage.include: ['src/**/*.{ts,tsx}']` e
  `coverage.exclude: ['src/main.tsx', 'src/core/types/**', '**/*.d.ts']`;
- ignorar `src/core/types/api.d.ts` no ESLint e no Prettier (arquivo gerado).

**Verificação:** `npm run lint` e `npm run format:check` passam.

### Passo 4 — Núcleo da API

`src/core/api/client.ts`:

```ts
import axios from 'axios';

/** Prefixo resolvido pelo proxy do Vite; nunca usar a URL do backend diretamente. */
export const API_PREFIX = '/api';

export const apiClient = axios.create({ baseURL: API_PREFIX, timeout: 10_000 });
```

Mova o `10_000` para `src/core/constants/http.ts` (`REQUEST_TIMEOUT_MS`), por causa da
regra `no-magic-numbers`.

`src/core/api/health.ts`: `fetchApiHealth(): Promise<HealthStatus>` → `GET /health/`.

Rode `npm run gen:types` com o backend no ar e versione `src/core/types/api.d.ts`. Em
`src/core/types/index.ts`, exporte o alias `HealthStatus` a partir do tipo gerado. Se o
`/health/` não tiver esquema de resposta tipado no OpenAPI, declare `HealthStatus`
manualmente em `index.ts` espelhando `docs/06-contrato-api.md`.

`src/core/constants/routes.ts`:

```ts
export const ROUTES = {
  home: '/',
  point: (slug: string) => `/p/${slug}`,
  scan: '/scan',
  vr: '/vr',
  vrPoint: (slug: string) => `/vr/${slug}`,
} as const;
```

### Passo 5 — Página inicial provisória

- `src/routes/AppRoutes.tsx`: `BrowserRouter` + `Routes` com `/` → `HomePage` e `*` →
  `NotFoundPage` simples ("Página não encontrada", link para o início).
- `src/core/hooks/useApiHealth.ts`: estados `loading | ok | error`.
- `src/routes/HomePage.tsx`: título "TourVR", subtítulo "Tour do campus", e um selo:
  "API conectada" (verde) / "API indisponível" (vermelho) / "Verificando…". Layout
  *mobile-first* (coluna única, `max-w-md mx-auto`, fonte mínima de 16 px).

### Passo 6 — Testes

| Arquivo | Teste | Verifica |
|---|---|---|
| `src/core/api/health.test.ts` | chama `GET /health/` pelo `apiClient` | URL e retorno (mock com `vi.spyOn(apiClient, 'get')`) |
| `src/core/hooks/useApiHealth.test.tsx` | sucesso e erro | transição `loading → ok` e `loading → error` |
| `src/routes/HomePage.test.tsx` | três estados | textos "API conectada", "API indisponível", "Verificando" |
| `src/routes/AppRoutes.test.tsx` | rota desconhecida | renderiza "Página não encontrada" (`MemoryRouter`) |
| `src/core/constants/routes.test.ts` | construtores de rota | `ROUTES.point('biblioteca') === '/p/biblioteca'` |

**Verificação:** `npm run test:coverage` passa com os limites de 80%.

### Passo 7 — Docker, README e CI do submódulo

- `services/vr-app/Dockerfile.dev`: espelha o `Dockerfile.dev` do painel (plano 002),
  com `EXPOSE 3001` e `CMD ["npm", "run", "dev"]`.
- `services/vr-app/.dockerignore`: `node_modules`, `dist`, `.env`, `coverage`.
- `services/vr-app/README.md`: 30 a 50 linhas, no padrão dos READMEs curtos do plano 002:
  o que é, como rodar (`docker compose up` na raiz ou `npm ci && npm run dev`), HTTPS na
  rede local (`npm run dev:https`), comandos de teste, link para
  `docs/05-artefato-vr-app.md` do orquestrador.
- `services/vr-app/.github/workflows/ci.yml`: cópia do workflow do painel (plano 006).

### Passo 8 — Integração no orquestrador

Branch `plano/016-fundacao-app-visitante` no orquestrador.

`docker-compose.yml`: novo serviço no mesmo padrão do `frontend`:

```yaml
  vr-app:
    build:
      context: ./services/vr-app
      dockerfile: Dockerfile.dev
    ports:
      - "3001:3001"
    environment:
      VITE_PROXY_TARGET: http://backend:8000
    volumes:
      - ./services/vr-app:/app
      - vr-app-node-modules:/app/node_modules
    depends_on:
      backend:
        condition: service_healthy
```

Declare o volume `vr-app-node-modules`. Se o `frontend` usar um comando como
`sh -c "npm ci && npm run dev"`, use o mesmo comando aqui.

`scripts/validate.sh`: confirme que a etapa `vr-app` passa a rodar (não é mais pulada).
Não altere o script se ele já detectar `services/vr-app/package.json`.

Workflow do orquestrador: se ele lista os submódulos explicitamente, acrescente o `vr-app`.

### Passo 9 — Documentar HTTPS na rede local

Em `docs/05-artefato-vr-app.md`, crie uma seção **Testar no celular e no Quest** com:

1. Celular/Quest na **mesma rede Wi-Fi** do computador.
2. Descobrir o IP da máquina: `ipconfig` (Windows, linha "Endereço IPv4") ou
   `ip addr` (Linux).
3. No computador: `cd services/vr-app && npm run dev:https` (fora do Docker; o certificado
   autoassinado é gerado na hora).
4. No aparelho: abrir `https://<IP>:3001`. O navegador avisa que o certificado não é
   confiável. É esperado: tocar em "Avançado" e "Continuar mesmo assim".
5. Firewall do Windows: na primeira execução, permitir o Node.js em **redes privadas**.

Explique em uma frase o motivo: câmera e WebXR só funcionam em HTTPS (ou em `localhost`).

## 7. Testes

```bash
cd services/vr-app
npm ci
npm run lint
npm run format:check
npm run test:coverage
npm run build
cd ../..
docker compose up -d --build --wait
curl -s http://localhost:3001/api/health/     # JSON do backend
bash scripts/validate.sh
```

## 8. Documentação a atualizar

- [ ] `docs/05-artefato-vr-app.md`: status "🟡 Em construção, fundação criada"; árvore
      real de arquivos; comandos; seção "Testar no celular e no Quest"
- [ ] `docs/01-arquitetura.md`: o `vr-app` na topologia, porta 3001, *proxy* `/api`
- [ ] `docs/02-artefato-orquestrador.md`: serviço `vr-app` no compose
- [ ] `docs/00-visao-geral.md`: linha "App do visitante" passa a "🟡 Fundação criada"
- [ ] `README.md` (raiz): tabela "Composição", linha do `vr-app`

## 9. Critérios de aceite

- [ ] `docker compose up` sobe também o `vr-app`, e `http://localhost:3001` mostra "API conectada"
- [ ] `curl http://localhost:3001/api/health/` responde pelo *proxy*
- [ ] `npm run dev:https` serve `https://<IP>:3001`, acessível de outro aparelho na rede
- [ ] Lint, formatação, testes (≥ 80%) e build passam no `vr-app`
- [ ] Nenhum limite de qualidade diferente do painel
- [ ] `bash scripts/validate.sh` passa e executa a etapa `vr-app`
- [ ] CI do `vr-app` roda no PR
- [ ] Documentação da seção 8 atualizada

## 10. Commits esperados

`services/vr-app`:

```
build: cria o projeto vite do app do visitante
build: configura lint, formatacao e testes iguais aos do painel
feat(core): adiciona cliente da api com proxy e verificacao de saude
feat: adiciona pagina inicial provisoria e rotas base
build: adiciona Dockerfile.dev, README e workflow de CI
```

Orquestrador:

```
build(compose): adiciona o servico vr-app na porta 3001
docs: documenta a fundacao do app do visitante e o teste em rede local
```

## 11. Riscos e pontos de atenção

- **Primeiro commit no vr-app.** O submódulo nunca teve código; confira
  `git branch --show-current` = `main` antes de criar a branch.
- **Certificado no Docker.** O `dev:https` roda fora do Docker neste plano. O compose usa
  HTTP, que basta para o computador local e para o E2E.
- **`loadEnv` e `VITE_PROXY_TARGET`.** No compose a variável vem do ambiente do container;
  `loadEnv(mode, cwd, '')` lê também `process.env`, o que cobre os dois casos.
- **Windows e scripts npm.** O `npm` no Windows executa scripts com `cmd.exe`; por isso o
  `gen:types` chama `scripts/gen-types.mjs` em vez de usar sintaxe de shell.
- **Peer dependencies.** Ver seção 5: parar diante de conflito.

## 12. Verificação pelo aluno

1. No terminal do VS Code, na pasta `quest-project`: `docker compose up -d --build`.
2. Abra `http://localhost:3001` no navegador. Deve aparecer "TourVR" e o selo verde
   **API conectada**.
3. Pare o backend (`docker compose stop backend`) e recarregue a página: o selo fica
   vermelho, **API indisponível**. Suba de novo: `docker compose start backend`.
4. **No celular:** peça ao agente para rodar `npm run dev:https` e dizer o IP da máquina.
   Com o celular no mesmo Wi-Fi, abra `https://<IP>:3001`, aceite o aviso de segurança e
   confira que a mesma página aparece.

---

## Prompt de delegação

Cole no Claude Code, na pasta `quest-project`, trocando o nome:

```text
Você é a sessão de EXECUÇÃO do projeto TourVR.
Execute o plano docs/tasks/016-fundacao-app-visitante.md.
Antes de qualquer ação, leia docs/tasks/protocolo-execucao.md e siga o "Prompt 1 — EXECUTAR" etapa por etapa.
Meu nome, para registrar no plano: <SEU NOME>
```
