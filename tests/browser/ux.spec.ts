import { test, expect, type Page } from '@playwright/test';

async function authenticate(page: Page) {
  await page.route('**/api/**', async route => route.fulfill({ response: await route.fetch({ headers: {
    ...route.request().headers(), 'oai-authenticated-user-id': 'ux-editor',
    'oai-authenticated-user-email': 'local@studio.test', origin: 'https://studio.example.com', 'sec-fetch-site': 'same-origin',
  } }) }));
}
async function create(page: Page, title: string) {
  await page.getByRole('button', { name: 'Nova campanha', exact: true }).first().click();
  await page.getByLabel('Nome da campanha', { exact: true }).fill(title);
  await page.getByRole('button', { name: 'Criar campanha', exact: true }).click();
}
test('history requires confirmation, list shows author, and language status follows the tab', async ({ page }) => {
  await authenticate(page);
  await page.goto('/');
  const title = `UX ${Date.now()}`;
  await create(page, title);
  await expect(page.locator('.save-indicator')).toHaveText('Salvo na nuvem', { timeout: 15000 });
  await page.locator('.edit-lease-bar').getByRole('button', { name: 'Editar', exact: true }).click();
  await expect(page.locator('.save-indicator')).toHaveText('Salvo na nuvem', { timeout: 15000 });
  await expect(page.getByText(/Última alteração por Local/)).toBeVisible();
  await page.getByLabel('Status da campanha').selectOption('Aprovado');
  await expect(page.locator('.save-indicator')).toHaveText('Salvo na nuvem', { timeout: 15000 });
  await page.getByRole('button', { name: 'ENGLISH', exact: true }).click();
  await expect(page.getByLabel('Status da campanha')).toHaveValue('Pendente');
  await page.getByRole('button', { name: 'Histórico', exact: true }).click();
  const history = page.getByRole('dialog', { name: 'Histórico da campanha' });
  await expect(history.getByText(/Mudou o status PT para Aprovado/)).toBeVisible();
  await history.getByRole('button', { name: 'Restaurar esta versão' }).first().click();
  await expect(history.getByText(/Restaurar revisão/)).toBeVisible();
  await history.getByRole('button', { name: 'Cancelar' }).click();
  await expect(history.getByRole('button', { name: 'Confirmar restauração' })).toHaveCount(0);
  await history.getByRole('button', { name: 'Fechar' }).click();
  await page.getByRole('button', { name: 'Voltar às campanhas' }).click();
  await expect(page.getByText(/Atualizado (agora|há .*|em .*) · Local/).first()).toBeVisible();
  await page.getByLabel('Ordenar campanhas').selectOption('updated');
  await page.getByRole('button', { name: 'Aprovadas', exact: true }).click();
  await expect(page.getByText(/campanhas com os filtros atuais/)).toBeVisible();
});

test('HTTPS image entry and guided publication remain clear at desktop and narrow widths', async ({ page }) => {
  await authenticate(page);
  await page.goto('/');
  await create(page, `Preparação ${Date.now()}`);
  await expect(page.locator('.save-indicator')).toHaveText('Salvo na nuvem');
  await page.locator('.edit-lease-bar').getByRole('button', { name: 'Editar', exact: true }).click();
  await expect(page.locator('.save-indicator')).toHaveText('Salvo na nuvem');
  await page.frameLocator('.preview-stage iframe').getByRole('button', { name: 'Adicionar capa editorial' }).click();
  const image = page.getByRole('dialog', { name: 'Imagem principal' });
  await image.getByRole('button', { name: 'Link da web' }).click();
  await image.getByLabel('URL · imagem principal').fill('http://example.com/photo.png');
  await image.getByRole('button', { name: 'Usar imagem da web' }).click();
  await expect(image.getByText('Use uma URL pública HTTPS.')).toBeVisible();
  await image.getByRole('button', { name: 'Fechar' }).click();
  await page.getByRole('button', { name: 'Publicar online' }).click();
  const publish = page.getByRole('dialog', { name: 'Publicar e-mail · PT' });
  await expect(publish.getByRole('heading', { name: 'STATUS' })).toBeVisible();
  await expect(publish.getByRole('heading', { name: 'PRÉ-FLIGHT' })).toBeVisible();
  await expect(publish.getByRole('heading', { name: 'VERSÕES PUBLICADAS' })).toBeVisible();
  await publish.getByRole('button', { name: 'Preparar para RD Station' }).click();
  await expect(publish.getByText('Ver detalhes do pré-flight')).toBeVisible();
  await expect(publish.getByRole('button', { name: 'Publicar versão' })).toBeDisabled();
  await publish.getByRole('button', { name: 'Fechar' }).click();
  for (const [width, height] of [[1366, 768], [1440, 900], [1920, 1080], [390, 844]]) {
    await page.setViewportSize({ width, height });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});
