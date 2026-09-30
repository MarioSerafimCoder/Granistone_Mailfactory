import { test, expect } from '@playwright/test';
import { exampleWorkbook } from '../../import/xlsx';

test('material autofill, image preview and restricted rich formatting remain editable', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Crystal Palace · Arquitetura', exact: true }).click();
  await page.getByRole('option', { name: /Speranza/ }).click();
  await expect(page.getByText('Como aplicar Speranza?')).toBeVisible();
  await page.getByRole('button', { name: 'Substituir conteúdo', exact: true }).click();
  await expect(page.locator('.tiptap')).toContainText('Speranza');
  await page.getByLabel('Nome do material', { exact: true }).fill('Speranza revisado');
  await page
    .locator('.image-field input[type=file]')
    .first()
    .setInputFiles('public/brand/granistone-logo.png');
  await page
    .getByLabel('Texto alternativo · imagem principal', { exact: true })
    .fill('Imagem de teste');
  await expect(
    page.frameLocator('iframe').getByRole('img', { name: 'Imagem de teste' }),
  ).toBeVisible();
  await page.locator('.tiptap').fill('Texto editável');
  await page.locator('.tiptap').press('Home');
  await page.locator('.tiptap').press('Control+Alt+1');
  await expect(page.locator('.tiptap')).toHaveText('Texto editável');
  await expect(page.locator('.tiptap h1')).toHaveCount(0);
  await page.getByRole('button', { name: 'Negrito', exact: true }).click();
  await page.locator('.tiptap').press('End');
  await page.locator('.tiptap').pressSequentially(' Preservado');
  await expect(page.frameLocator('iframe').getByText(/Texto editável.*Preservado/)).toBeVisible();
  await page.getByRole('button', { name: 'Exportar', exact: true }).click();
  await expect(
    page.getByText(/A imagem principal precisa de uma URL HTTPS pública/),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Fechar', exact: true }).click();
  await page.getByRole('button', { name: 'Voltar às campanhas', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Crystal Palace · Arquitetura', exact: true }).click();
  await expect(page.getByLabel('Nome do material', { exact: true })).toHaveValue(
    'Speranza revisado',
  );
  await expect(
    page.frameLocator('iframe').getByRole('img', { name: 'Imagem de teste' }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test('reimport preview identifies duplicates without overwriting campaigns', async ({ page }) => {
  await page.goto('/');
  const file = {
    name: 'CRM.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from(exampleWorkbook()),
  };
  await page.getByRole('button', { name: 'Importar planejamento', exact: true }).first().click();
  await page.locator('dialog input[type=file]').setInputFiles(file);
  await page.getByRole('button', { name: 'Importar 2 campanhas', exact: true }).click();
  await page.getByRole('button', { name: 'Importar planejamento', exact: true }).first().click();
  await page.locator('dialog input[type=file]').setInputFiles(file);
  await expect(
    page.getByRole('button', { name: 'Importar 0 campanhas', exact: true }),
  ).toBeDisabled();
  await expect(page.getByText(/2 duplicata.*será.*ignorada/)).toBeVisible();
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(page.locator('.campaign-table tbody tr')).toHaveCount(7);
});
