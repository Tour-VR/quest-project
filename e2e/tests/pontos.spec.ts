import { expect, test } from '@playwright/test';
import { createAdminUser, createPoint, loginPelaApi } from '../support/api';
import { loginNoPainel } from '../support/painel';
import { URLS } from '../support/urls';

test('@golden admin cria e publica um ponto pelo painel', async ({ page, request }) => {
  const admin = await createAdminUser(request);
  await loginNoPainel(page, admin);
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole('link', { name: 'Pontos' }).click();
  await page.getByRole('link', { name: 'Novo ponto' }).first().click();

  const stamp = Date.now();
  const slug = `biblioteca-central-e2e-${stamp}`;
  await page.getByLabel('Nome').fill(`Biblioteca Central E2E ${stamp}`);
  await expect(page.getByLabel('Identificador')).toHaveValue(slug);
  await page.getByLabel('Resumo').fill('Onde ficam os livros e as salas de estudo.');
  await page.getByLabel('História').fill('A biblioteca foi inaugurada junto com o campus.');
  await page.getByRole('button', { name: 'Salvar' }).click();

  await expect(page.getByText('Ponto criado.')).toBeVisible();
  await expect(page.getByText('Rascunho')).toBeVisible();
  await page.getByRole('button', { name: 'Publicar' }).click();
  await expect(page.getByText('Publicado', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Identificador')).toBeDisabled();

  const publico = await request.get(`${URLS.api}/public/points/${slug}`);
  expect(publico.status()).toBe(200);
});

test('slug duplicado mostra erro no campo', async ({ page, request }) => {
  const admin = await createAdminUser(request);
  const token = await loginPelaApi(request, admin);
  const existente = await createPoint(request, token);
  await loginNoPainel(page, admin);
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto('/pontos/novo');
  await page.getByLabel('Nome').fill('Outro ponto com o mesmo slug');
  await page.getByLabel('Identificador').fill(existente.slug);
  await page.getByLabel('Resumo').fill('Resumo');
  await page.getByLabel('História').fill('Historia');
  await page.getByRole('button', { name: 'Salvar' }).click();

  await expect(page.getByText('Já existe um ponto com este identificador.')).toBeVisible();
  await expect(page.getByLabel('Nome')).toHaveValue('Outro ponto com o mesmo slug');
});

test('excluir remove da lista', async ({ page, request }) => {
  const admin = await createAdminUser(request);
  const token = await loginPelaApi(request, admin);
  const ponto = await createPoint(request, token);
  await loginNoPainel(page, admin);
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto('/pontos');
  await expect(page.getByRole('link', { name: ponto.name })).toBeVisible();
  page.once('dialog', (dialog) => void dialog.accept());
  await page.getByRole('button', { name: `Ações do ponto ${ponto.name}` }).click();
  await page.getByRole('menuitem', { name: 'Excluir' }).click();

  await expect(page.getByRole('link', { name: ponto.name })).toHaveCount(0);
});
