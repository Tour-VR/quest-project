import { expect, test } from '@playwright/test';
import { createAdminUser, createPoint, loginPelaApi, publishPoint } from '../support/api';
import { loginNoPainel } from '../support/painel';

test('@golden QR Code do ponto publicado aponta para /p/<slug>', async ({ page, request }) => {
  const admin = await createAdminUser(request);
  const token = await loginPelaApi(request, admin);
  const ponto = await createPoint(request, token);
  await publishPoint(request, token, ponto.id);
  await loginNoPainel(page, admin);
  await expect(page).toHaveURL(/\/dashboard$/);

  // Sob carga dos testes em paralelo a lista pode demorar mais que o timeout do expect.
  const lista = page.waitForResponse(
    (response) => response.url().includes('/admin/points?status=published') && response.ok(),
  );
  await page.getByRole('link', { name: 'QR Codes' }).click();
  await lista;
  const cartao = page.getByRole('article', { name: ponto.name });
  await expect(cartao).toBeVisible();
  await expect(cartao.getByText(new RegExp(`/p/${ponto.slug}$`))).toBeVisible();

  const qr = cartao.getByRole('img', { name: `QR Code de ${ponto.name}` });
  await expect(qr).toHaveAttribute('src', /^data:image\/png/);
});

test('rascunho não aparece', async ({ page, request }) => {
  const admin = await createAdminUser(request);
  const token = await loginPelaApi(request, admin);
  const rascunho = await createPoint(request, token);
  await loginNoPainel(page, admin);
  await expect(page).toHaveURL(/\/dashboard$/);

  const lista = page.waitForResponse(
    (response) => response.url().includes('/admin/points?status=published') && response.ok(),
  );
  await page.goto('/qrcodes');
  await lista;
  await expect(page.getByRole('heading', { name: 'QR Codes dos pontos' })).toBeVisible();
  await expect(page.getByText('Carregando...')).toHaveCount(0);
  await expect(page.getByRole('article', { name: rascunho.name })).toHaveCount(0);
});
