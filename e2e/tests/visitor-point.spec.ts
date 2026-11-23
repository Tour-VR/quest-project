import { expect, test } from '@playwright/test';
import { createAdminUser, createPublishedPoint, getMetrics, loginPelaApi } from '../support/api';
import { URLS } from '../support/urls';

test('@golden visitante abre a pagina do ponto e a visita e registrada', async ({
  page,
  request,
}) => {
  const admin = await createAdminUser(request);
  const token = await loginPelaApi(request, admin);
  const slug = `e2e-ponto-${Date.now()}`;
  await createPublishedPoint(request, token, {
    slug,
    name: 'Biblioteca E2E',
    summary: 'Resumo',
    history: 'Historia do nome.',
  });
  const before = await getMetrics(request, token);

  await page.goto(`${URLS.visitante}/p/${slug}`);
  await expect(page.getByRole('heading', { name: 'Biblioteca E2E' })).toBeVisible();
  await expect(page.getByText('Historia do nome.')).toBeVisible();

  await expect
    .poll(async () => (await getMetrics(request, token)).visits_by_mode.ar)
    .toBe(before.visits_by_mode.ar + 1);
});

test('visitante ve mensagem amigavel para ponto inexistente', async ({ page }) => {
  await page.goto(`${URLS.visitante}/p/nao-existe-${Date.now()}`);
  await expect(page.getByText('Este ponto não existe')).toBeVisible();
});
