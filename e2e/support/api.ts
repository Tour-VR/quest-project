import type { APIRequestContext } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

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
