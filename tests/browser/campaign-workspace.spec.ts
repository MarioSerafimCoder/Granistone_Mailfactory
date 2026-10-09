import { test, expect } from '@playwright/test';

test('campaign workspace filters, sorting, row navigation and contextual actions', async ({ page }) => {
  await page.goto('/');
  const rows = page.locator('.campaign-table tbody tr');
  await expect(rows).toHaveCount(5);
  await expect(page.locator('.production-overview')).toHaveCount(0);
  await expect(page.locator('.campaign-stage-tabs')).toBeVisible();
  await page.getByRole('button', { name: /Revisão 1/ }).click();
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('Dentro da Granistone');
  await page.getByLabel('Buscar campanhas').fill('não existe');
  await expect(rows).toHaveCount(0);
  await expect(page.getByText('Nenhuma campanha em revisão')).toBeVisible();
  await page.getByRole('button', { name: 'Limpar filtros' }).click();
  await expect(rows).toHaveCount(5);
  await page.getByLabel('Ordenar campanhas').selectOption('name');
  await expect(rows.first()).toContainText('Comunicado de atendimento');
  await page.getByText('Filtros', { exact: true }).click();
  await page.getByLabel('Filtrar tipo').selectOption('Newsletter');
  await expect(rows).toHaveCount(1);
  await page.getByLabel('Filtrar idioma').selectOption('EN');
  await expect(rows).toHaveCount(1);
  await page.getByLabel('Filtrar mês').selectOption('2026-10');
  await expect(rows).toHaveCount(1);
  await page.getByRole('button', { name: 'Limpar filtros' }).click();
  await expect(rows).toHaveCount(5);
  await page.getByLabel('Ações de Crystal Palace · Arquitetura', { exact: true }).click();
  await expect(page.locator('.campaign-menu[open]')).toContainText('Duplicar');
  await page.locator('.campaign-menu[open]').getByRole('button', { name: 'Duplicar' }).click();
  await expect(page.getByRole('button', { name: 'Voltar às campanhas' })).toBeVisible();
  await page.getByRole('button', { name: 'Voltar às campanhas' }).click();
  await expect(rows).toHaveCount(6);
  await expect(page.getByRole('button', { name: /Retomar Crystal Palace/ })).toBeVisible();
  await page.getByLabel('Ações de Crystal Palace · Arquitetura', { exact: true }).click();
  await page.locator('.campaign-menu[open]').getByRole('button', { name: 'Excluir' }).click();
  await expect(page.getByRole('dialog', { name: 'Excluir e-mail' })).toBeVisible();
  await page.getByRole('dialog', { name: 'Excluir e-mail' }).getByRole('button', { name: 'Cancelar' }).click();
  await expect(rows).toHaveCount(6);
  await rows.filter({ hasText: 'Dia da Arquitetura' }).first().focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Voltar às campanhas' })).toBeVisible();
});

test('sidebar settings, theme, navigation and desktop widths remain usable', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Configurações', exact: true }).click();
  const settings = page.getByRole('dialog', { name: 'Configurações' });
  await expect(settings.getByRole('button', { name: /Marca e rodapé/ })).toBeVisible();
  await expect(settings.getByText('Restaurar JSON')).toBeVisible();
  await settings.getByRole('button', { name: 'Ativar modo escuro' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await settings.getByRole('button', { name: /Lixeira/ }).click();
  await expect(page.getByRole('dialog', { name: 'Lixeira' })).toBeVisible();
  await page.getByRole('dialog', { name: 'Lixeira' }).getByRole('button', { name: 'Fechar' }).click();
  await page.getByRole('button', { name: 'Templates', exact: false }).click();
  await expect(page.getByRole('heading', { name: 'Templates', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Biblioteca', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Biblioteca visual' })).toBeVisible();
  await page.getByRole('button', { name: /Campanhas/ }).first().click();
  for (const [width, height] of [[1366, 768], [1440, 900], [1920, 1080]]) {
    await page.setViewportSize({ width, height });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});
