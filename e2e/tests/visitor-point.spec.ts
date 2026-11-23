import { expect, test } from '@playwright/test';
import {
  createAdminUser,
  createPublishedPoint,
  getMetrics,
  loginPelaApi,
  uniqueSuffix,
} from '../support/api';
import { URLS } from '../support/urls';

test('@golden visitante abre a pagina do ponto e a visita e registrada', async ({
  page,
  request,
}) => {
  const admin = await createAdminUser(request);
  const token = await loginPelaApi(request, admin);
  const slug = `e2e-ponto-${uniqueSuffix()}`;
  await createPublishedPoint(request, token, {
    slug,
    name: 'Biblioteca E2E',
    summary: 'Resumo',
    history: 'Historia do nome.',
  });
  const before = await getMetrics(request, token);

  // Conta os registros de visita deste ponto feitos pela pagina: precisa ser exatamente 1.
  const visitPath = `/api/public/points/${slug}/visits`;
  const recorded: number[] = [];
  page.on('response', (response) => {
    const req = response.request();
    if (req.method() === 'POST' && new URL(req.url()).pathname === visitPath) {
      recorded.push(response.status());
    }
  });

  await page.goto(`${URLS.visitante}/p/${slug}`);
  await expect(page.getByRole('heading', { name: 'Biblioteca E2E' })).toBeVisible();
  await expect(page.getByText('Historia do nome.')).toBeVisible();

  // Outros testes tambem registram visitas em paralelo: o total geral sobe pelo menos 1.
  await expect
    .poll(async () => (await getMetrics(request, token)).visits_by_mode.ar)
    .toBeGreaterThanOrEqual(before.visits_by_mode.ar + 1);
  await page.waitForLoadState('networkidle');
  expect(recorded).toEqual([201]);
});

test('visitante ve mensagem amigavel para ponto inexistente', async ({ page }) => {
  await page.goto(`${URLS.visitante}/p/nao-existe-${uniqueSuffix()}`);
  await expect(page.getByText('Este ponto não existe')).toBeVisible();
});
