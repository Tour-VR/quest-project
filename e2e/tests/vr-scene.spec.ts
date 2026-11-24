import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import {
  addPanorama,
  createAdminUser,
  createPoint,
  getMetrics,
  loginPelaApi,
  publishPoint,
  uniqueSuffix,
  uploadMedia,
} from '../support/api';
import { URLS } from '../support/urls';

// Panorama 2048x1024 gerado para o teste: faixa vermelha no centro, azul a +90 graus.
const PANORAMA_TESTE = fileURLToPath(new URL('../fixtures/panorama-teste.jpg', import.meta.url));

// Plano 020: cena 360 no navegador comum (sem WebXR), o caminho do visitante remoto.
test('@golden visitante remoto abre a cena 360 do ponto', async ({ page, request }) => {
  const admin = await createAdminUser(request);
  const token = await loginPelaApi(request, admin);
  const slug = `e2e-vr-${uniqueSuffix()}`;
  const name = 'Praca Central VR';
  const point = await createPoint(request, token, { slug, name, summary: 'Vista 360 da praca.' });
  await addPanorama(request, token, point.id, await uploadMedia(request, token, PANORAMA_TESTE));
  await publishPoint(request, token, point.id);
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

  await page.goto(`${URLS.visitante}/vr/${slug}`);
  await expect(page.getByTestId('vr-canvas')).toBeVisible();
  await expect(page.getByRole('heading', { name })).toBeVisible();
  await expect(page.getByText('Arraste para olhar em volta.')).toBeVisible();
  // headless nao tem WebXR: o botao nao aparece
  await expect(page.getByRole('button', { name: 'Entrar em VR' })).toHaveCount(0);

  // Outros testes tambem registram visitas em paralelo: o total vr sobe pelo menos 1.
  await expect
    .poll(async () => (await getMetrics(request, token)).visits_by_mode.vr)
    .toBeGreaterThanOrEqual(before.visits_by_mode.vr + 1);
  await page.waitForLoadState('networkidle');
  expect(recorded).toEqual([201]);
});

test('ponto sem panorama mostra o aviso com link para a pagina do ponto', async ({
  page,
  request,
}) => {
  const admin = await createAdminUser(request);
  const token = await loginPelaApi(request, admin);
  const slug = `e2e-sem-360-${uniqueSuffix()}`;
  const point = await createPoint(request, token, { slug });
  await publishPoint(request, token, point.id);

  await page.goto(`${URLS.visitante}/vr/${slug}`);
  await expect(page.getByText('Este ponto ainda não tem visita 360°.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Ver a página do ponto' })).toHaveAttribute(
    'href',
    `/p/${slug}`,
  );
});
