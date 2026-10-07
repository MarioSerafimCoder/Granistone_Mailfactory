import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createCampaign } from '../../campaigns/model';
import { createSection } from '../../blocks/registry';
const auth = { 'oai-authenticated-user-id': 'ux-theme-owner', 'oai-authenticated-user-email': 'local@studio.test', origin: 'https://studio.example.com', 'sec-fetch-site': 'same-origin' };
async function authenticate(page: Page) {
  await page.route('**/api/**', async route => route.fulfill({ response: await route.fetch({ headers: { ...route.request().headers(), ...auth } }) }));
}
test('app theme follows system, persists choice and leaves the email HTML untouched', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' }); await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('button', { name: 'Ativar modo claro' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Nova campanha', exact: true }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Nova campanha' });
  const darkSurface = await dialog.evaluate(el => getComputedStyle(el).backgroundColor);
  expect(darkSurface).toBe('rgb(36, 39, 42)');
  await dialog.getByLabel('Nome da campanha', { exact: true }).fill('Tema independente');
  await dialog.getByRole('button', { name: 'Criar campanha' }).click();
  await expect(page.frameLocator('.preview-stage iframe').locator('html')).toHaveAttribute('lang', 'pt-BR');
  await page.screenshot({ path: 'test-results/theme-editor-dark.png', fullPage: true });
  const before = await page.locator('.preview-stage iframe').getAttribute('srcdoc');
  await page.getByRole('button', { name: 'Ativar modo claro' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(await page.locator('.preview-stage iframe').getAttribute('srcdoc')).toBe(before);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: 'Ativar modo escuro' }).click();
  for (const width of [1366, 1024, 820]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test('block search and material catalog show previews, filters and a compact detail panel', async ({ page, request }) => {
  const name = 'Ágata ' + Date.now(), block = createSection('centeredText');
  block.content.pt.title = 'Ágata';
  const design = { id: crypto.randomUUID(), kind: 'block', payload: block, name: name + ' editorial', description: 'Textura clara', category: 'Quartzito', revision: 0 };
  expect((await request.post('/api/designs', { headers: auth, data: design })).status()).toBe(201);
  const image = await request.post('/api/assets', { headers: { ...auth, 'Content-Type': 'image/png', 'X-Asset-Metadata': encodeURIComponent(JSON.stringify({ fileName: 'material.png', name: name, alt: 'Material Ágata' })) }, data: await readFile('public/brand/granistone-logo.png') });
  expect(image.status()).toBe(201);
  const asset = await image.json();
  const material = await request.post('/api/materials', { headers: auth, data: { name, category: 'Quartzito', description: 'Chapa natural clara', heroAssetId: asset.id, assetIds: [asset.id], active: true } });
  expect(material.status()).toBe(201);
  const campaign = createCampaign({ title: 'Acervo ' + Date.now(), sections: [] });
  expect((await request.post('/api/campaigns', { headers: auth, data: { campaign, requestId: crypto.randomUUID() } })).status()).toBe(201);
  await page.route('https://studio.example.com/assets/**', async route => route.fulfill({ response: await request.get(new URL(route.request().url()).pathname) }));
  await authenticate(page); await page.goto('/');
  await page.getByRole('button', { name: 'Biblioteca', exact: true }).click();
  await page.getByRole('button', { name: 'Materiais', exact: true }).click();
  await page.getByLabel('Buscar material').fill('agata');
  await expect(page.getByRole('button', { name: 'Abrir material ' + name })).toBeVisible();
  await page.getByLabel('Filtrar categoria de material').selectOption('Quartzito');
  await page.getByRole('button', { name: 'Abrir material ' + name }).focus();
  await page.keyboard.press('Enter');
  const drawer = page.getByRole('dialog', { name: 'Editar ' + name });
  await expect(drawer).toBeVisible();
  expect(await drawer.evaluate(el => el.getBoundingClientRect().height)).toBe(await page.evaluate(() => innerHeight));
  await expect(drawer.getByRole('img', { name: asset.alt }).first()).toBeVisible();
  await drawer.getByRole('button', { name: 'Fechar', exact: true }).last().click();
  await page.getByRole('button', { name: 'Campanhas' }).click();
  await page.getByRole('button', { name: campaign.title, exact: true }).click();
  await expect(page.locator('.save-indicator')).toHaveText('Salvo na nuvem');
  await page.locator('.edit-lease-bar').getByRole('button', { name: 'Editar', exact: true }).click();
  await page.getByRole('button', { name: 'Inserir bloco salvo' }).click();
  const library = page.getByRole('dialog', { name: 'Blocos Granistone' });
  await library.getByLabel('Buscar blocos').fill('agata');
  const card = library.locator('.saved-design-card').filter({ hasText: name });
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: 'Visualizar ' + design.name }).click();
  await expect(card.getByRole('button', { name: 'Visualizar ' + design.name })).toHaveAttribute('aria-pressed', 'true');
  await library.getByLabel('Filtrar categoria').selectOption('Quartzito');
  await library.getByLabel('Buscar blocos').fill('inexistente');
  await expect(library.getByText('Nenhum resultado para esta busca')).toBeVisible();
  await library.getByRole('button', { name: 'Limpar filtros' }).click();
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: 'Inserir bloco' }).click();
  await expect(page.locator('.section-card')).toHaveCount(1);
});
