import type { APIRequestContext } from '@playwright/test';
import { URLS } from './urls';

export interface TestUser {
  email: string;
  password: string;
}

/** Cria um usuario de teste unico. O plano 008 troca a implementacao para a CLI. */
export async function createAdminUser(request: APIRequestContext): Promise<TestUser> {
  const user = { email: `e2e-${Date.now()}@tourvr.dev`, password: 'senhaE2E123' };
  const response = await request.post(`${URLS.api}/auth/register`, { data: user });
  if (!response.ok()) throw new Error(`Falha ao criar usuario: ${response.status()}`);
  return user;
}
