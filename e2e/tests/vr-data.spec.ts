import { expect, test } from '@playwright/test';
import {
  createAdminUser,
  createPublishedPoint,
  loginPelaApi,
  uniqueSuffix,
} from '../support/api';
import { URLS } from '../support/urls';

// Plano 019: dados do modo VR (conexoes entre pontos) vistos pela API publica.
test('conexao publica traz o nome do destino e some quando ele e despublicado', async ({
  request,
}) => {
  const admin = await createAdminUser(request);
  const token = await loginPelaApi(request, admin);
  const headers = { Authorization: `Bearer ${token}` };
  const suffix = uniqueSuffix();
  const a = await createPublishedPoint(request, token, {
    slug: `biblioteca-vr-${suffix}`,
    name: 'Biblioteca VR',
  });
  const b = await createPublishedPoint(request, token, {
    slug: `cantina-vr-${suffix}`,
    name: 'Cantina VR',
  });

  const linked = await request.put(`${URLS.api}/admin/points/${a.id}`, {
    data: { connections: [{ target_slug: b.slug, label: 'Ir para a cantina', yaw_degrees: 90 }] },
    headers,
  });
  expect(linked.status()).toBe(200);

  const before = await (await request.get(`${URLS.api}/public/points/${a.slug}`)).json();
  expect(before.panorama_url).toBeNull();
  expect(before.connections).toEqual([
    {
      target_slug: b.slug,
      target_name: 'Cantina VR',
      label: 'Ir para a cantina',
      yaw_degrees: 90,
    },
  ]);

  const unpublished = await request.post(`${URLS.api}/admin/points/${b.id}/unpublish`, {
    headers,
  });
  expect(unpublished.status()).toBe(200);

  const after = await (await request.get(`${URLS.api}/public/points/${a.slug}`)).json();
  expect(after.connections).toEqual([]);
  const adminView = await (
    await request.get(`${URLS.api}/admin/points/${a.id}`, { headers })
  ).json();
  expect(adminView.connections).toHaveLength(1);
});
