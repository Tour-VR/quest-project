import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { createAdminUser, createPoint, loginPelaApi } from '../support/api';
import { loginNoPainel } from '../support/painel';

const FOTO_TESTE = fileURLToPath(new URL('../fixtures/foto-teste.jpg', import.meta.url));

test('@golden admin envia foto para um ponto', async ({ page, request }) => {
  const admin = await createAdminUser(request);
  const token = await loginPelaApi(request, admin);
  const ponto = await createPoint(request, token);
  await loginNoPainel(page, admin);
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto(`/pontos/${ponto.id}`);
  await expect(page.getByRole('heading', { name: 'Fotos' })).toBeVisible();
  await page.getByLabel('Enviar foto').setInputFiles(FOTO_TESTE);
  await expect(page.getByText('Preencha o texto alternativo')).toBeVisible();

  const gravado = page.waitForResponse(
    (response) => response.request().method() === 'PUT' && response.ok(),
  );
  await page.getByLabel('Texto alternativo').fill('Fachada do ponto de teste');
  await page.getByLabel('Texto alternativo').blur();
  await gravado;

  await page.reload();
  const miniatura = page.getByRole('img', { name: 'Fachada do ponto de teste' });
  await expect(miniatura).toBeVisible();
  await expect(page.getByText('Preencha o texto alternativo')).toHaveCount(0);
  const carregada = await miniatura.evaluate((img: HTMLImageElement) => img.naturalWidth > 0);
  expect(carregada).toBe(true);

  const src = await miniatura.getAttribute('src');
  const arquivo = await request.get(src ?? '');
  expect(arquivo.status()).toBe(200);
  expect(arquivo.headers()['content-type']).toBe('image/jpeg');
});

test('arquivo que não é imagem é recusado', async ({ page, request }) => {
  const admin = await createAdminUser(request);
  const token = await loginPelaApi(request, admin);
  const ponto = await createPoint(request, token);
  await loginNoPainel(page, admin);
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto(`/pontos/${ponto.id}`);
  await page.getByLabel('Enviar foto').setInputFiles({
    name: 'nao-e-foto.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from('isto e um texto com extensao de foto'),
  });

  await expect(page.getByRole('alert')).toContainText('Formato não suportado');
  await expect(page.getByText('Nenhuma foto enviada ainda.')).toBeVisible();
});
