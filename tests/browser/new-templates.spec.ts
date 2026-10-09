import { test, expect, type Page } from '@playwright/test';
import { createCampaign, richText } from '../../campaigns/model';
import { createSection } from '../../blocks/registry';
import { defaultBrand } from '../../data/brand';
import { modernTemplateIds } from '../../templates/blueprints';

async function authenticate(page: Page, id: string) {
  await page.route('**/api/**', async route => route.fulfill({ response: await route.fetch({ headers: {
    ...route.request().headers(), 'oai-authenticated-user-id': id,
    'oai-authenticated-user-email': 'local@studio.test', origin: 'https://studio.example.com', 'sec-fetch-site': 'same-origin',
  } }) }));
}

test('the four new templates have distinct live previews and editable sections', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1500 });
  await page.goto('/');
  await page.getByRole('button', { name: /Templates/ }).first().click();
  const thumbnails = page.locator('.template-live-preview iframe');
  await expect(thumbnails).toHaveCount(9);
  const colors = ['#641F2C', '#397F78', '#9D654B', '#0D0D0D'];
  for (let index = 0; index < colors.length; index++) {
    const iframe = thumbnails.nth(index + 5);
    await expect(iframe).toHaveAttribute('srcdoc', new RegExp(colors[index], 'i'));
    await expect(iframe.contentFrame().locator('.email-container')).toBeVisible();
  }
  await page.locator('.template-group').nth(1).scrollIntoViewIfNeeded();
  await page.locator('.template-group').nth(1).screenshot({ path: 'test-results/new-template-colors.png' });
  await page.screenshot({ path: 'test-results/new-template-library.png', fullPage: true });
  await page.getByRole('button', { name: /Promo · Impacto.*Usar template/ }).click();
  await page.getByLabel('Nome da campanha', { exact: true }).fill('Campanha com blocos');
  await page.getByRole('button', { name: 'Criar campanha', exact: true }).click();
  await page.locator('.editor-secondary summary').click(); await page.getByRole('button', { name: 'Configurações avançadas', exact: true }).click();
  const cards = page.locator('.sections-editor .section-card');
  await expect(cards).toHaveCount(9);
  const thirdId = await cards.nth(2).getAttribute('data-section-id');
  const first = (await cards.first().boundingBox())!;
  const thirdHandle = (await cards.nth(2).locator('.section-drag-handle').boundingBox())!;
  await page.mouse.move(thirdHandle.x + thirdHandle.width / 2, thirdHandle.y + thirdHandle.height / 2);
  await page.mouse.down();
  await page.mouse.move(first.x + first.width / 2, first.y + 4, { steps: 8 });
  await page.mouse.up();
  await expect(cards.first()).toHaveAttribute('data-section-id', thirdId!);
  await page.reload();
  await page.getByRole('button', { name: 'Campanha com blocos', exact: true }).click();
  await page.locator('.editor-secondary summary').click(); await page.getByRole('button', { name: 'Configurações avançadas', exact: true }).click();
  await expect(cards.first()).toHaveAttribute('data-section-id', thirdId!);
  await cards.nth(1).getByRole('button', { name: 'Subir bloco' }).focus();
  await page.keyboard.press('Enter');
  await expect(cards.nth(1)).toHaveAttribute('data-section-id', thirdId!);
  await cards.first().locator('.section-heading .text-button').click();
  await cards.first().getByRole('button', { name: 'Alinhar à direita' }).click();
  await expect(cards.first().getByRole('button', { name: 'Alinhar à direita' })).toHaveAttribute('aria-pressed', 'true');
  const frame = page.frameLocator('.preview-stage iframe');
  await expect(frame.locator('.email-container td[align="right"]').first()).toBeVisible();
  await cards.nth(2).locator('.section-heading-main .text-button').click();
  await expect(cards.nth(2).locator('.section-fields')).toBeVisible();
  await page.getByRole('button', { name: 'Preview mobile' }).click();
  await expect.poll(() => frame.locator('html').evaluate(element => element.scrollWidth)).toBeLessThanOrEqual(375);
});

for (const id of modernTemplateIds) test(`${id} creates an editable layout with replaceable photography and mobile-safe final HTML`, async ({ page }) => {
  await page.route('https://images.example.com/stone.png', route => route.fulfill({ path: 'public/brand/granistone-logo.png', contentType: 'image/png', headers: { 'Access-Control-Allow-Origin': '*' } }));
  await page.goto('/');
  await page.getByRole('button', { name: /Templates/ }).first().click();
  const card = page.locator('.template-card').filter({ has: page.locator(`.mini-${id}`) });
  await card.click();
  await page.getByLabel('Nome da campanha', { exact: true }).fill(`Teste ${id}`);
  await page.getByRole('button', { name: 'Criar campanha', exact: true }).click();
  await page.locator('.editor-secondary summary').click(); await page.getByRole('button', { name: 'Configurações avançadas', exact: true }).click();
  const sections = page.locator('.sections-editor .section-card');
  await expect(sections).toHaveCount(id === 'promo-impact' ? 9 : 8);
  const imageIndex = id === 'promo-impact' ? 3 : id === 'brand-story' ? 1 : 0;
  await sections.nth(imageIndex).locator('.section-heading-main .text-button').click();
  await sections.nth(imageIndex).getByRole('button', { name: 'Link da web' }).click();
  await sections.nth(imageIndex).getByLabel('URL · imagem do bloco').fill('https://images.example.com/stone.png');
  await sections.nth(imageIndex).getByRole('button', { name: 'Usar imagem da web' }).click();
  await expect(sections.nth(imageIndex).locator('.image-current img')).toHaveAttribute('src', 'https://images.example.com/stone.png');
  await page.getByRole('button', { name: 'Visualizar final' }).click();
  const frame = page.frameLocator('.preview-stage iframe');
  await expect(frame.locator(`.email-container[data-template="${id}"]`)).toBeVisible();
  await expect(frame.locator('img[src="https://images.example.com/stone.png"]')).toBeVisible();
  await expect(frame.locator('[data-section-id]')).toHaveCount(0);
  await expect(frame.locator('script')).toHaveCount(0);
  await page.getByRole('button', { name: 'Preview mobile' }).click();
  await expect.poll(() => frame.locator('html').evaluate(element => element.scrollWidth)).toBeLessThanOrEqual(375);
});

test('rich paragraph alignment persists and appears in the final email', async ({ page }) => {
  const section = createSection('centeredText');
  section.content.pt = { title: 'Alinhamento', text: 'Texto de prova' };
  section.richBody = { pt: richText('Texto de prova') };
  const campaign = createCampaign({ title: 'Alinhamento rico', sections: [section] });
  await page.addInitScript(value => {
    if (sessionStorage.getItem('rich-align-seeded')) return;
    localStorage.setItem('granistone-mail-studio:v2', JSON.stringify(value));
    sessionStorage.setItem('rich-align-seeded', '1');
  }, { version: 2, campaigns: [campaign], brand: defaultBrand });
  await page.goto('/');
  await page.getByRole('button', { name: campaign.title, exact: true }).click();
  await page.locator('.editor-secondary summary').click(); await page.getByRole('button', { name: 'Configurações avançadas', exact: true }).click();
  const card = page.locator('.sections-editor .section-card').first();
  await card.locator('.section-heading-main .text-button').click();
  await card.getByRole('textbox', { name: 'Texto editorial' }).click();
  await card.getByRole('button', { name: 'Alinhar texto à direita' }).click();
  await page.getByRole('button', { name: 'Visualizar final' }).click();
  const frame = page.frameLocator('.preview-stage iframe');
  await expect(frame.locator('p[style*="text-align:right"]')).toContainText('Texto de prova');
  await page.reload();
  await page.getByRole('button', { name: campaign.title, exact: true }).click();
  await page.locator('.editor-secondary summary').click(); await page.getByRole('button', { name: 'Configurações avançadas', exact: true }).click();
  await page.getByRole('button', { name: 'Visualizar final' }).click();
  await expect(frame.locator('p[style*="text-align:right"]')).toContainText('Texto de prova');
});

test('section order and alignment synchronize between collaborators', async ({ page, browser }) => {
  const context = await browser.newContext(), second = await context.newPage();
  await authenticate(page, 'section-owner'); await authenticate(second, 'section-collaborator');
  try {
    const title = `Seções compartilhadas ${Date.now()}`;
    await page.goto('/');
    await page.getByRole('button', { name: /Templates/ }).first().click();
    await page.locator('.template-card').filter({ has: page.locator('.mini-catalog-color') }).click();
    await page.getByLabel('Nome da campanha', { exact: true }).fill(title);
    await page.getByRole('button', { name: 'Criar campanha', exact: true }).click();
  await page.locator('.editor-secondary summary').click(); await page.getByRole('button', { name: 'Configurações avançadas', exact: true }).click();
    await expect(page.locator('.save-indicator')).toHaveText('Salvo na nuvem');
    const firstCards = page.locator('.sections-editor .section-card');
    const movedId = await firstCards.nth(2).getAttribute('data-section-id');
    await second.goto('/');
    await second.getByRole('button', { name: title, exact: true }).click();
  await second.locator('.editor-secondary summary').click(); await second.getByRole('button', { name: 'Configurações avançadas', exact: true }).click();
    await expect(second.locator('.sections-editor .section-card')).toHaveCount(8);
    await expect(page.locator('.edit-lease-bar')).toContainText('Em edição');
    await firstCards.nth(2).getByRole('button', { name: 'Subir bloco' }).click();
    await firstCards.nth(1).getByRole('button', { name: 'Subir bloco' }).click();
    await expect(firstCards.first()).toHaveAttribute('data-section-id', movedId!);
    await firstCards.first().locator('.section-heading-main .text-button').click();
    await firstCards.first().getByRole('button', { name: 'Alinhar à direita' }).click();
    await expect(page.locator('.save-indicator')).toHaveText('Salvo na nuvem');
    await page.getByRole('button', { name: 'Salvar e encerrar edição' }).click();
    await second.locator('.edit-lease-bar').getByRole('button', { name: 'Tentar novamente', exact: true }).click();
    const secondCards = second.locator('.sections-editor .section-card');
    await expect(secondCards.first()).toHaveAttribute('data-section-id', movedId!);
    await secondCards.first().locator('.section-heading-main .text-button').click();
    await expect(secondCards.first().getByRole('button', { name: 'Alinhar à direita' })).toHaveAttribute('aria-pressed', 'true');
  } finally { await context.close(); }
});
