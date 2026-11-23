import { expect, test } from '@playwright/test';
import { createAdminUser, uniqueSuffix } from '../support/api';
import { loginNoPainel } from '../support/painel';

// Mesma regra do app do visitante (services/vr-app/src/core/qr/parseTourUrl.ts):
// o dominio e ignorado; o caminho /p/<slug> identifica o ponto.
const POINT_PATH = /^\/p\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/;

test('@golden admin publica o ponto, gera o QR e o visitante e contabilizado', async ({
  page,
  browser,
  request,
}) => {
  const slug = `e2e-campus-${uniqueSuffix()}`;
  const name = `Campus E2E ${slug}`;
  const admin = await createAdminUser(request);

  // 1. Painel: login de admin e total de visitas antes do teste.
  await loginNoPainel(page, admin);
  await expect(page).toHaveURL(/\/dashboard$/);
  const visitas = page.getByRole('group', { name: 'Visitas (total)' }).getByRole('definition');
  await expect(visitas).toHaveText(/^\d+$/);
  const antes = Number(await visitas.textContent());

  // 2. Painel: criar o ponto e publicar pela interface.
  await page.getByRole('link', { name: 'Pontos' }).click();
  await page.getByRole('link', { name: 'Novo ponto' }).first().click();
  await page.getByLabel('Nome').fill(name);
  await page.getByLabel('Identificador').fill(slug);
  await page.getByLabel('Resumo').fill('Ponto criado pelo golden path do campus.');
  await page.getByLabel('História').fill('História escrita pelo golden path do campus.');
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByText('Ponto criado.')).toBeVisible();
  await page.getByRole('button', { name: 'Publicar' }).click();
  await expect(page.getByText('Publicado', { exact: true })).toBeVisible();

  // 3. Painel: /qrcodes mostra o cartao com a URL que vai no QR.
  const lista = page.waitForResponse(
    (response) => response.url().includes('/admin/points?status=published') && response.ok(),
  );
  await page.getByRole('link', { name: 'QR Codes' }).click();
  await lista;
  const cartao = page.getByRole('article', { name });
  await expect(cartao.getByRole('img', { name: `QR Code de ${name}` })).toBeVisible();
  const urlTexto = cartao.getByText(new RegExp(`/p/${slug}$`));
  await expect(urlTexto).toBeVisible();
  const qrUrl = (await urlTexto.textContent())?.trim() ?? '';

  // 4. A URL do painel segue a regra do app: o caminho e /p/<slug>.
  expect(POINT_PATH.exec(new URL(qrUrl).pathname)?.[1]).toBe(slug);

  // 5. Visitante, sem login, em outro contexto: abre a URL do QR e ve o ponto.
  const visitante = await browser.newContext();
  try {
    const aba = await visitante.newPage();
    const visita = aba.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        new URL(response.url()).pathname === `/api/public/points/${slug}/visits`,
    );
    await aba.goto(qrUrl);
    await expect(aba.getByRole('heading', { name })).toBeVisible();
    await expect(aba.getByText('História escrita pelo golden path do campus.')).toBeVisible();
    expect((await visita).status()).toBe(201);
  } finally {
    await visitante.close();
  }

  // 6. Painel: o dashboard conta a visita. Outros testes em paralelo tambem registram
  //    visitas, entao o total sobe pelo menos 1.
  await page.getByRole('link', { name: 'Dashboard' }).click();
  await expect
    .poll(async () => {
      await page.getByRole('button', { name: 'Atualizar' }).click();
      return Number(await visitas.textContent());
    })
    .toBeGreaterThanOrEqual(antes + 1);
});
