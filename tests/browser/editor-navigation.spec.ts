import { test, expect, type Page } from '@playwright/test';

async function authenticate(page: Page) {
  await page.route('**/api/**', async route => route.fulfill({ response: await route.fetch({ headers: {
    ...route.request().headers(),
    'oai-authenticated-user-id': 'navigation-editor',
    'oai-authenticated-user-email': 'local@studio.test',
    origin: 'https://studio.example.com',
    'sec-fetch-site': 'same-origin',
  } }) }));
}

async function create(page: Page, title: string) {
  await page.getByRole('button', { name: 'Nova campanha', exact: true }).first().click();
  await page.getByLabel('Nome da campanha', { exact: true }).fill(title);
  await page.getByRole('button', { name: 'Criar campanha', exact: true }).click();
  await expect(page.locator('.save-indicator')).toHaveText('Salvo na nuvem');
  await expect(page.locator('.edit-lease-bar')).toContainText('Em edição');
}

test('direct campaign switch and sidebar exit preserve a pending local draft', async ({ page }) => {
  await authenticate(page);
  const first = `Troca A ${Date.now()}`, second = `Troca B ${Date.now()}`;
  await page.goto('/');
  await create(page, first);
  await page.getByRole('button', { name: 'Voltar às campanhas' }).click();
  await expect(page.getByRole('heading', { name: 'Campanhas', exact: true })).toBeVisible();
  await create(page, second);
  await page.locator('.editor-secondary summary').click();
  await page.getByLabel('Trocar campanha').selectOption({ label: first });
  await expect(page.getByRole('heading', { name: first, exact: true })).toBeVisible();
  await expect(page.locator('.edit-lease-bar')).toContainText('Em edição');
  await expect(page.getByRole('dialog', { name: 'Alterações pendentes' })).toHaveCount(0);

  await page.route('**/api/campaigns/*', async route => {
    if (route.request().method() === 'PUT') await route.abort('failed');
    else await route.fallback();
  });
  const title = page.locator('.visual-email').getByRole('textbox', { name: 'Título', exact: true });
  await title.fill('Rascunho guardado após falha');
  await page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('button', { name: /Templates/ }).click();
  const pending = page.getByRole('dialog', { name: 'Alterações pendentes' });
  await expect(pending).toBeVisible();
  await expect(pending).toContainText('salvo neste navegador');
  await expect(title).toHaveText('Rascunho guardado após falha');
  await pending.getByRole('button', { name: 'Sair com rascunho local' }).click();
  await expect(page.getByRole('heading', { name: 'Templates', exact: true })).toBeVisible();

  await page.unroute('**/api/campaigns/*');
  await page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('button', { name: /Campanhas/ }).click();
  await page.getByRole('button', { name: first, exact: true }).click();
  await expect(page.locator('.edit-lease-bar')).toContainText('Em edição');
  await expect(title).toHaveText('Rascunho guardado após falha');
  await page.locator('.editor-secondary summary').click();
  await page.getByRole('button', { name: 'Sincronizar agora', exact: true }).click();
  await expect(page.locator('.save-indicator')).toHaveText('Salvo na nuvem');
  await page.getByRole('button', { name: 'Voltar às campanhas' }).click();
  await expect(page.getByRole('heading', { name: 'Campanhas', exact: true })).toBeVisible();
  await page.getByRole('button', { name: first, exact: true }).click();
  await expect(title).toHaveText('Rascunho guardado após falha');
  await page.getByRole('button', { name: 'Importar planejamento' }).click();
  await expect(page.getByRole('dialog', { name: /Importar/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Campanhas', exact: true })).toBeVisible();
});
