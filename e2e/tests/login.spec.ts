import { expect, test } from '@playwright/test';
import { createAdminUser } from '../support/api';
import { loginNoPainel } from '../support/painel';

test('@golden administrador entra no painel', async ({ page, request }) => {
  const user = await createAdminUser(request);
  await loginNoPainel(page, user);
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText(/Bem-vindo\(a\) de volta/)).toBeVisible();
});

test('credenciais invalidas mostram mensagem', async ({ page }) => {
  await loginNoPainel(page, { email: 'ninguem@tourvr.dev', password: 'errada123' });
  await expect(page.getByText('Credenciais invalidas.')).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});
