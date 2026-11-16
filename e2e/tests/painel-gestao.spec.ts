import { expect, test } from '@playwright/test';
import {
  createAdminUser,
  createPoint,
  loginPelaApi,
  publishPoint,
  uniqueSuffix,
} from '../support/api';
import { loginNoPainel } from '../support/painel';
import { URLS } from '../support/urls';

test('@golden dashboard conta a visita registrada', async ({ page, request }) => {
  const admin = await createAdminUser(request);
  const token = await loginPelaApi(request, admin);
  const ponto = await createPoint(request, token);
  await publishPoint(request, token, ponto.id);
  await loginNoPainel(page, admin);
  await expect(page).toHaveURL(/\/dashboard$/);

  // Outros testes alteram as contagens: compara antes e depois, nunca um numero absoluto.
  const visitas = page.getByRole('group', { name: 'Visitas (total)' }).getByRole('definition');
  await expect(visitas).toHaveText(/^\d+$/);
  const antes = Number(await visitas.textContent());

  const visita = await request.post(`${URLS.api}/public/points/${ponto.slug}/visits`, {
    data: { mode: 'ar' },
  });
  expect(visita.ok()).toBeTruthy();
  await page.getByRole('button', { name: 'Atualizar' }).click();

  await expect(visitas).toHaveText(String(antes + 1));
});

test('admin desativa usuário e ele não entra mais', async ({ page, request }) => {
  const admin = await createAdminUser(request);
  const novo = { email: `e2e-novo-${uniqueSuffix()}@tourvr.dev`, password: 'senhaE2E123' };
  await loginNoPainel(page, admin);
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole('link', { name: 'Usuários' }).click();
  await page.getByRole('button', { name: 'Novo usuário' }).click();
  await page.getByLabel('E-mail').fill(novo.email);
  await page.getByLabel('Nome completo').fill('Colega E2E');
  await page.getByLabel('Senha inicial').fill(novo.password);
  await page.getByRole('button', { name: 'Criar usuário' }).click();
  await expect(page.getByText('Usuário criado. Informe a senha inicial à pessoa.')).toBeVisible();

  const linha = page.getByRole('row').filter({ hasText: novo.email });
  await linha.getByRole('button', { name: 'Desativar' }).click();
  await expect(page.getByRole('row').filter({ hasText: novo.email })).toContainText('Inativo');

  await page.evaluate(() => {
    localStorage.clear();
  });
  await loginNoPainel(page, novo);
  await expect(page.getByText('Credenciais invalidas.')).toBeVisible();
});

test('perfil atualiza o nome no menu', async ({ page, request }) => {
  const admin = await createAdminUser(request);
  const nome = `Admin Renomeado ${Date.now()}`;
  await loginNoPainel(page, admin);
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole('link', { name: 'Meu perfil' }).click();
  await page.getByLabel('Nome completo').fill(nome);
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByText('Perfil atualizado.')).toBeVisible();

  await page.getByRole('link', { name: 'Dashboard' }).click();
  await expect(page.getByText(`Bem-vindo(a) de volta, ${nome}.`)).toBeVisible();
});
