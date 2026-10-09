import { test, expect, type Page } from '@playwright/test';
import { mkdir, copyFile, readFile } from 'node:fs/promises';
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

test('all stone folders appear as materials and remain usable in campaigns', async ({ page, request }) => {
  const stamp = Date.now();
  const folderNames = Array.from({ length: 21 }, (_, index) => `Pedra QA ${stamp} ${index + 1}`);
  const headers = { 'oai-authenticated-user-id': 'catalog-editor', 'oai-authenticated-user-email': 'local@studio.test', origin: 'https://studio.example.com', 'sec-fetch-site': 'same-origin' };
  const upload = await request.post('/api/assets', { headers: { ...headers, 'Content-Type': 'image/png', 'X-Asset-Metadata': encodeURIComponent(JSON.stringify({ fileName: 'pedra-qa.png', name: 'Pedra QA', alt: 'Foto de pedra', folderPaths: folderNames.map(name => `Imagens Catálogo/${name}`) })) }, data: await readFile('public/brand/granistone-logo.png') });
  expect(upload.status()).toBe(201);
  const uploaded = await upload.json();
  await authenticate(page); await page.goto('/');
  await page.getByRole('button', { name: 'Biblioteca', exact: true }).click();
  await page.getByRole('button', { name: 'Materiais', exact: true }).click();
  await page.getByLabel('Buscar material').fill(`Pedra QA ${stamp}`);
  await expect(page.locator('.material-card')).toHaveCount(21);
  await page.getByRole('button', { name: 'Configurações', exact: true }).click();
  await page.getByRole('dialog', { name: 'Configurações' }).getByRole('button', { name: 'Ativar modo escuro' }).click();
  await page.getByRole('dialog', { name: 'Configurações' }).getByRole('button', { name: 'Fechar' }).click();
  await page.setViewportSize({ width: 1024, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/stone-folders-dark.png', fullPage: true });
  await page.getByRole('button', { name: `Abrir material ${folderNames[0]}`, exact: true }).click();
  const folder = page.getByRole('dialog', { name: folderNames[0] });
  await expect(folder.getByRole('img', { name: uploaded.alt })).toBeVisible();
  await folder.getByRole('button', { name: 'Abrir pasta em Imagens' }).click();
  await expect(page.getByRole('button', { name: folderNames[0], exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('.asset-card')).toHaveCount(1);
  await page.getByRole('button', { name: /Campanhas/ }).first().click();
  await page.getByRole('button', { name: 'Nova campanha', exact: true }).click();
  await page.getByLabel('Template inicial', { exact: true }).selectOption('product-architect');
  await page.getByLabel('Nome da campanha', { exact: true }).fill(`Campanha pedra ${stamp}`);
  await page.getByRole('button', { name: 'Criar campanha' }).click();
  await page.locator('.editor-secondary summary').click(); await page.getByRole('button', { name: 'Configurações avançadas', exact: true }).click();
  await expect(page.locator('.edit-lease-bar')).toContainText('Em edição');
  const bodyBefore = await page.locator('.edit-panel .tiptap').innerText();
  const option = page.getByRole('option', { name: `${folderNames[0]} Pedra natural`, exact: true });
  await expect(option).toBeVisible();
  await option.click();
  await page.getByRole('button', { name: 'Substituir conteúdo' }).click();
  await expect(page.getByLabel('Nome do material', { exact: true })).toHaveValue(folderNames[0]);
  await expect(page.locator('.edit-panel .tiptap')).toHaveText(bodyBefore);
});
