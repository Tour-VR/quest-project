import { expect, test } from '@playwright/test';
import { createAdminUser, createCommonUser } from '../support/api';
import { loginNoPainel } from '../support/painel';

const TOKEN_STORAGE_KEY = '@OculosVR:token';

test('@golden admin entra e vê o layout com menu', async ({ page, request }) => {
  const admin = await createAdminUser(request);
  await loginNoPainel(page, admin);

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText('TourVR Admin')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
});

test('usuário comum vê acesso restrito', async ({ page, request }) => {
  const admin = await createAdminUser(request);
  const comum = await createCommonUser(request, admin);
  await loginNoPainel(page, comum);

  await expect(page.getByText('Acesso restrito a administradores.')).toBeVisible();
  await expect(page.getByText('TourVR Admin')).toHaveCount(0);
});

test('token inválido leva ao login com aviso', async ({ page, request }) => {
  const admin = await createAdminUser(request);
  await loginNoPainel(page, admin);
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.evaluate((key) => {
    localStorage.setItem(key, 'invalido');
  }, TOKEN_STORAGE_KEY);
  // Recarregar faz o painel revalidar o token salvo: GET /users/me responde 401.
  await page.goto('/dashboard');

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText('Sua sessão expirou. Entre novamente.')).toBeVisible();
});
