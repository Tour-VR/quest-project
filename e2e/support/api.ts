import type { APIRequestContext } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { URLS } from './urls';

export interface TestUser {
  email: string;
  password: string;
}

// O pacote e ESM ("type": "module"): nao ha __dirname, a raiz vem de import.meta.url.
const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));

/**
 * Cria um administrador de teste unico pelo comando create-admin dentro do container.
 * O parametro `request` fica para manter a assinatura do plano 005 e nao alterar quem chama.
 */
export async function createAdminUser(_request: APIRequestContext): Promise<TestUser> {
  const user = { email: `e2e-${Date.now()}@tourvr.dev`, password: 'senhaE2E123' };
  execFileSync(
    'docker',
    [
      'compose', 'exec', '-T', 'backend', 'python', '-m', 'app.cli', 'create-admin',
      '--email', user.email, '--password', user.password,
    ],
    { cwd: REPO_ROOT, stdio: 'pipe' },
  );
  return user;
}

/** Entra pela API e devolve o token de acesso do usuario. */
export async function loginPelaApi(request: APIRequestContext, user: TestUser): Promise<string> {
  const response = await request.post(`${URLS.api}/auth/login`, { data: user });
  if (!response.ok()) throw new Error(`login pela API falhou: ${response.status()}`);
  const body = (await response.json()) as { access_token: string };
  return body.access_token;
}

/** Cria um usuario comum (papel `user`) via POST /auth/register, autenticado como o admin. */
export async function createCommonUser(
  request: APIRequestContext,
  admin: TestUser,
): Promise<TestUser> {
  const token = await loginPelaApi(request, admin);
  const user = { email: `e2e-comum-${Date.now()}@tourvr.dev`, password: 'senhaE2E123' };
  const response = await request.post(`${URLS.api}/auth/register`, {
    data: user,
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok()) throw new Error(`cadastro do usuario comum falhou: ${response.status()}`);
  return user;
}

export interface PointOverrides {
  slug?: string;
  name?: string;
  summary?: string;
  history?: string;
}

/** Cria um ponto (rascunho) via POST /admin/points e devolve o corpo da resposta. */
export async function createPoint(
  request: APIRequestContext,
  token: string,
  overrides: PointOverrides = {},
): Promise<{ id: string; slug: string; name: string }> {
  const stamp = Date.now();
  const response = await request.post(`${URLS.api}/admin/points`, {
    data: {
      slug: `ponto-e2e-${stamp}`,
      name: `Ponto E2E ${stamp}`,
      summary: 'Resumo criado pelo teste E2E.',
      history: 'Historia criada pelo teste E2E.',
      ...overrides,
    },
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok()) throw new Error(`criacao do ponto falhou: ${response.status()}`);
  return (await response.json()) as { id: string; slug: string; name: string };
}

/** Publica o ponto via POST /admin/points/{id}/publish. */
export async function publishPoint(
  request: APIRequestContext,
  token: string,
  pointId: string,
): Promise<void> {
  const response = await request.post(`${URLS.api}/admin/points/${pointId}/publish`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok()) throw new Error(`publicacao do ponto falhou: ${response.status()}`);
}
