import { test, expect, type Page } from '@playwright/test';
// Only local tests inject dispatcher identities. No production identity bypass.
async function authenticate(page: Page, id: string) {
  await page.route('**/api/**', async route => route.fulfill({ response: await route.fetch({ headers: {
    ...route.request().headers(), 'oai-authenticated-user-id': id,
    'oai-authenticated-user-email': 'local@studio.test', origin: 'https://studio.example.com', 'sec-fetch-site': 'same-origin',
  } }) }));
}
test('shared campaign coordinates two browsers, preserves edits, trash and restoration', async ({ page, browser }) => {
  const other = await browser.newContext(); const second = await other.newPage();
  await authenticate(page, 'employee-one'); await authenticate(second, 'employee-two');
  try {
    const title = `Workspace ${Date.now()}`;
    await page.goto('/');
    await expect(page.getByText('ChatGPT conectado')).toBeVisible();
    await page.getByRole('button', { name: 'Nova campanha', exact: true }).first().click();
    await page.getByLabel('Nome da campanha', { exact: true }).fill(title);
    await page.getByRole('button', { name: 'Criar campanha', exact: true }).click();
    await expect(page.locator('.save-indicator')).toHaveText('Salvo na nuvem');
    await second.goto('/');
    await second.getByRole('button', { name: title, exact: true }).click();
    await expect(second.locator('.save-indicator')).toHaveText('Salvo na nuvem');
    await second.locator('.edit-lease-bar').getByRole('button', { name: 'Editar', exact: true }).click();
    await expect(second.locator('.visual-email').getByRole('textbox', { name: 'Título', exact: true })).toHaveAttribute('contenteditable', 'true');
    await second.locator('.visual-email').getByRole('textbox', { name: 'Título', exact: true }).fill('Conteúdo de outro funcionário');
    await expect(second.locator('.save-indicator')).toHaveText('Salvo na nuvem');
    await page.locator('.edit-lease-bar').getByRole('button', { name: 'Editar', exact: true }).click();
    await expect(page.locator('.edit-lease-bar')).toContainText('está editando');
    await expect(page.getByLabel('Status da campanha', { exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Voltar às campanhas' }).click();
    await second.getByRole('button', { name: 'Voltar às campanhas' }).click();
    await second.getByRole('button', { name: `Excluir ${title}`, exact: true }).click();
    await second.getByRole('dialog', { name: 'Excluir e-mail' }).getByRole('button', { name: 'Excluir e-mail', exact: true }).click();
    await second.getByRole('button', { name: /^Lixeira/ }).click();
    const trash = second.getByRole('dialog', { name: 'Lixeira' }).locator('.workspace-trash').filter({ hasText: title });
    await expect(trash.getByText(/Excluída por Local/)).toBeVisible();
    await expect(trash.getByRole('button', { name: 'Restaurar', exact: true })).toBeEnabled();
    await trash.getByRole('button', { name: 'Restaurar', exact: true }).click();
    await second.getByRole('button', { name: 'Fechar', exact: true }).click();
    await expect(second.getByRole('button', { name: title, exact: true })).toBeVisible();
  } finally { await other.close(); }
});
test('legacy migration requires an explicit choice and status stays independent by language', async ({ page }) => {
  await authenticate(page, 'migration-user');
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Importar para o workspace', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Manter somente local por enquanto' }).click();
  await expect(page.getByRole('button', { name: /Enviar campanhas locais/ })).toBeVisible();
  await page.getByRole('button', { name: 'Nova campanha', exact: true }).first().click();
  await page.getByLabel('Nome da campanha', { exact: true }).fill(`Idiomas ${Date.now()}`);
  await page.getByRole('button', { name: 'Criar campanha', exact: true }).click();
    await page.getByLabel('Status da campanha', { exact: true }).selectOption('Aprovado');
    await expect(page.locator('.save-indicator')).toHaveText('Salvo na nuvem');
    await page.locator('.edit-lease-bar').getByRole('button', { name: 'Editar', exact: true }).click();
    await page.getByRole('button', { name: 'ENGLISH', exact: true }).click();
  await expect(page.getByLabel('Status da campanha', { exact: true })).toHaveValue('Pendente');
  await expect(page.locator('.visual-email').getByRole('textbox', { name: 'Título', exact: true })).toHaveAttribute('contenteditable', 'true');
  await page.locator('.visual-email').getByRole('textbox', { name: 'Título', exact: true }).fill('English copy');
  await page.getByRole('button', { name: 'PORTUGUÊS', exact: true }).click();
  await expect(page.getByLabel('Status da campanha', { exact: true })).toHaveValue('Aprovado');
  await page.setViewportSize({ width: 1366, height: 768 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.screenshot({ path: 'test-results/workspace-mobile.png', fullPage: true });
});
