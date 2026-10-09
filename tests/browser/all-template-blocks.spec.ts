import { test, expect, type Page } from '@playwright/test';
import { createCampaign } from '../../campaigns/model';
import { convertSections } from '../../blocks/model';
import { defaultBrand } from '../../data/brand';
import { templates } from '../../templates/registry';
import { templateContent } from '../../templates/starter';
import type { TemplateId } from '../../types/campaign';

async function openCampaign(page: Page, template: TemplateId) {
  const campaign = createCampaign({ template, title: `Blocos ${template}`, content: templateContent(template, `Blocos ${template}`) });
  await page.addInitScript(data => {
    if (!sessionStorage.getItem('all-blocks-seeded')) {
      localStorage.setItem('granistone-mail-studio:v2', JSON.stringify(data));
      sessionStorage.setItem('all-blocks-seeded', '1');
    }
  }, { version: 2, campaigns: [campaign], brand: defaultBrand });
  await page.goto('/');
  await page.getByRole('button', { name: campaign.title, exact: true }).click();
  return campaign;
}

for (const template of templates) {
  test(`${template.id}: add, edit, export, undo and persist blocks without manual conversion`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    const campaign = await openCampaign(page, template.id);
    const count = convertSections(campaign).length;
    await page.getByRole('button', { name: 'Abrir biblioteca', exact: true }).click();
    await page.locator('.canvas-library').getByRole('button', { name: 'Texto centralizado', exact: true }).click();
    const blocks = page.locator('[data-canvas-block]');
    await expect(blocks).toHaveCount(count + 1);
    await page.getByRole('button', { name: '↶ Desfazer', exact: true }).click();
    await expect(blocks).toHaveCount(campaign.sections?.length ?? 0);
    await page.getByRole('button', { name: '↷ Refazer', exact: true }).click();
    await expect(blocks).toHaveCount(count + 1);
    await blocks.last().getByRole('button', { name: 'Editar bloco', exact: true }).click();
    const inspector = page.getByRole('complementary', { name: 'Propriedades do elemento' });
    await inspector.getByLabel('Título do bloco', { exact: true }).fill('Bloco adicional revisado');
    await inspector.getByLabel('Texto do bloco', { exact: true }).fill('Texto preservado ao recarregar.');
    await page.getByRole('button', { name: 'Visualizar final', exact: true }).click();
    await expect(page.frameLocator('.preview-stage iframe').getByRole('heading', { name: 'Bloco adicional revisado' })).toBeVisible();
    await page.reload();
    await page.getByRole('button', { name: campaign.title, exact: true }).click();
    await expect(blocks).toHaveCount(count + 1);
    await expect(blocks.last().getByRole('textbox', { name: 'Título do bloco', exact: true })).toHaveText('Bloco adicional revisado');
    await expect(blocks.last().getByRole('textbox', { name: 'Texto do bloco', exact: true })).toHaveText('Texto preservado ao recarregar.');
    expect(errors).toEqual([]);
  });
}

test('planning edits keep the chosen template and the template library applies the selected layout', async ({ page }) => {
  await openCampaign(page, 'promo-impact');
  const first = page.locator('[data-canvas-block]').first();
  const id = await first.getAttribute('data-canvas-block');
  await first.getByRole('textbox', { name: 'Título do bloco', exact: true }).fill('Conteúdo protegido');
  await page.locator('.editor-secondary summary').click();
  await page.getByRole('button', { name: 'Configurações avançadas', exact: true }).click();
  await page.getByRole('button', { name: 'Planejamento', exact: true }).click();
  await page.getByLabel('Público', { exact: true }).fill('Arquitetos e designers');
  await page.getByLabel('Tipo de conteúdo', { exact: true }).selectOption('Produto');
  await page.getByRole('button', { name: 'Estrutura', exact: true }).click();
  await expect(page.getByLabel('Template', { exact: true })).toHaveValue('promo-impact');
  await page.getByRole('button', { name: 'Editar no canvas', exact: true }).click();
  await expect(first).toHaveAttribute('data-canvas-block', id!);
  await expect(first.getByRole('textbox', { name: 'Título do bloco', exact: true })).toHaveText('Conteúdo protegido');
  await page.getByRole('button', { name: 'Abrir templates', exact: true }).click();
  await page.locator('.canvas-library').getByRole('button', { name: 'Notice', exact: true }).click();
  await expect(page.locator('.canvas-legacy.template-notice')).toBeVisible();
  await page.getByRole('button', { name: '↶ Desfazer', exact: true }).click();
  await expect(first.getByRole('textbox', { name: 'Título do bloco', exact: true })).toHaveText('Conteúdo protegido');
});

test('original blocks can be edited directly from Structure before inserting a new block', async ({ page }) => {
  await openCampaign(page, 'institutional');
  await page.locator('.editor-secondary summary').click();
  await page.getByRole('button', { name: 'Configurações avançadas', exact: true }).click();
  await page.getByRole('button', { name: 'Estrutura', exact: true }).click();
  const card = page.locator('.section-card').first();
  await card.locator('.section-heading-main .text-button').click();
  await card.getByLabel('Título do bloco', { exact: true }).fill('Título original revisado');
  await expect(page.frameLocator('.preview-stage iframe').getByRole('heading', { name: 'Título original revisado' })).toBeVisible();
  await page.getByRole('button', { name: 'Adicionar bloco', exact: true }).click();
  await page.getByRole('dialog', { name: 'Adicionar bloco' }).getByRole('button', { name: 'Divisor', exact: true }).click();
  await expect(page.locator('.section-card')).toHaveCount(5);
});
