import { test, expect, type Page } from '@playwright/test';
import { mkdir, copyFile } from 'node:fs/promises';
import path from 'node:path';

async function authenticate(page: Page) {
  await page.route('**/api/**', async route => route.fulfill({ response: await route.fetch({ headers: {
    ...route.request().headers(), 'oai-authenticated-user-id': 'catalog-editor',
    'oai-authenticated-user-email': 'local@studio.test', origin: 'https://studio.example.com', 'sec-fetch-site': 'same-origin',
  } }) }));
  await page.route('https://studio.example.com/assets/**', async route => route.fulfill({ response: await page.request.get(new URL(route.request().url()).pathname) }));
}

test('import a directory, navigate folders, find images and share organization across browsers', async ({ page, browser }) => {
  const name = `Catálogo teste ${Date.now()}`;
  const directory = path.resolve('.sites-runtime', 'browser-catalog', name);
  await mkdir(path.join(directory, 'Amazonita'), { recursive: true });
  await mkdir(path.join(directory, 'Institucional'), { recursive: true });
  await copyFile('public/brand/whatsapp.png', path.join(directory, 'Amazonita', 'Verde.png'));
  await copyFile('public/brand/whatsapp.png', path.join(directory, 'Institucional', 'Verde repetido.png'));
  await copyFile('public/brand/instagram.png', path.join(directory, 'Institucional', 'Institucional.png'));
  await authenticate(page); await page.goto('/');
  await page.getByRole('button', { name: 'Biblioteca', exact: true }).click();
  await page.getByLabel('Importar pasta de imagens').setInputFiles(directory);
  await expect(page.getByText('3 de 3 arquivos importados. Imagens repetidas são reutilizadas.')).toBeVisible({ timeout: 30000 });
  await page.getByRole('button', { name: `${name} 2 imagens`, exact: true }).click();
  await expect(page.getByRole('button', { name: 'Amazonita 1 imagem', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Amazonita 1 imagem', exact: true }).click();
  await expect(page.locator('.asset-card')).toHaveCount(1);
  await expect.poll(() => page.locator('.asset-card img').evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  await page.getByPlaceholder('Buscar por nome…').fill('amazonita');
  await expect(page.locator('.asset-card')).toHaveCount(1);
  const context = await browser.newContext(); const second = await context.newPage();
  try {
    await authenticate(second); await second.goto('/');
    await second.getByRole('button', { name: 'Biblioteca', exact: true }).click();
    await expect(second.getByRole('button', { name: `${name} 2 imagens`, exact: true })).toBeVisible();
    await second.getByRole('button', { name: `${name} 2 imagens`, exact: true }).click();
    await expect(second.locator('.asset-card')).toHaveCount(2);
    await second.setViewportSize({ width: 390, height: 844 });
    expect(await second.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await second.screenshot({ path: 'test-results/catalog-mobile.png', fullPage: true });
  } finally { await context.close(); }
});
