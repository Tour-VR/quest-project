import type { Page } from '@playwright/test';
import type { TestUser } from './api';

/** Abre a tela de login do painel, preenche as credenciais e envia. */
export async function loginNoPainel(page: Page, user: TestUser): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Senha').fill(user.password);
  await page.getByRole('button', { name: 'Entrar no Painel' }).click();
}
