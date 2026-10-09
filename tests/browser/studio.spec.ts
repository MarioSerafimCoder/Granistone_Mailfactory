import { test, expect } from '@playwright/test';
import { exampleWorkbook } from '../../import/xlsx';
test('complete production flow: XLSX, template, Maily, PT/EN, preview, persistence, export', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.route('https://assets.example.com/**', (route) =>
    route.fulfill({
      path: `public${new URL(route.request().url()).pathname}`,
      contentType: 'image/png',
    }),
  );
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Campanhas', exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/campaigns-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Importar planejamento', exact: true }).first().click();
  await page
    .locator('dialog input[type=file]')
    .setInputFiles({
      name: 'CRM Outubro 2026.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from(exampleWorkbook()),
    });
  await expect(page.getByText('2 campanhas identificadas')).toBeVisible();
  await page.getByRole('button', { name: 'Importar 2 campanhas' }).click();
  await expect(page.locator('.global-feedback')).toContainText('2 campanhas importadas');
  await page.getByRole('button', { name: 'Crystal Palace', exact: true }).first().click();
  await page.locator('.editor-secondary summary').click(); await page.getByRole('button', { name: 'Configurações avançadas', exact: true }).click();
  await page.locator('.edit-panel').getByLabel('Assunto', { exact: true }).fill('Crystal Palace · arquitetura');
  await page.locator('.edit-panel').getByLabel('Preheader', { exact: true }).fill('Conheça a coleção');
  await page.getByLabel('Headline', { exact: true }).fill('Arquitetura com identidade');
  await page.locator('.edit-panel .tiptap').fill('Um texto produzido no Maily.');
  await page.getByRole('button', { name: 'ENGLISH', exact: true }).click();
  await expect(page.getByLabel('Headline', { exact: true })).toHaveValue('');
  await page.getByLabel('Headline', { exact: true }).fill('Architecture with identity');
  await page.locator('.edit-panel').getByLabel('Assunto', { exact: true }).fill('Crystal Palace · architecture');
  await page.locator('.edit-panel .tiptap').fill('English editorial content.');
  await page.getByRole('button', { name: 'PORTUGUÊS', exact: true }).click();
  await expect(page.getByLabel('Headline', { exact: true })).toHaveValue(
    'Arquitetura com identidade',
  );
  await expect(page.locator('.edit-panel .tiptap')).toContainText('Um texto produzido no Maily.');
  await expect(page.locator('iframe')).toHaveAttribute('title', 'Preview desktop do e-mail');
  await page.getByRole('button', { name: 'Preview mobile', exact: true }).click();
  await expect(page.locator('iframe')).toHaveAttribute('title', 'Preview mobile do e-mail');
  await expect(
    page.frameLocator('iframe').getByRole('heading', { name: 'Arquitetura com identidade' }),
  ).toBeVisible();
  await expect(page.frameLocator('iframe').getByText('Um texto produzido no Maily.')).toBeVisible();
  await page.screenshot({ path: 'test-results/editor-mobile-preview.png', fullPage: true });
  await page.getByRole('button', { name: 'Estrutura', exact: true }).click();
  await expect(page.getByLabel('Template', { exact: true })).toHaveValue('product-architect');
  await page.locator('.legacy-block-controls summary').click();
  await page.getByLabel('Imagem de aplicação', { exact: true }).uncheck();
  await page.getByLabel('Imagem principal', { exact: true }).uncheck();
  await page.getByRole('button', { name: 'Conteúdo', exact: true }).click();
  await page.getByRole('button', { name: 'Revisar e publicar', exact: true }).click();
  await page.getByRole('dialog', { name: 'Revisar e publicar' }).getByRole('button', { name: 'Exportar HTML' }).click();
  await expect(page.getByRole('button', { name: 'Baixar HTML', exact: true })).toBeDisabled();
  const draftPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Baixar HTML com fotos locais', exact: true }).click();
  const draft = await draftPromise;
  expect(draft.suggestedFilename()).toContain('-pt-local.html');
  await page.getByRole('button', { name: 'Fechar', exact: true }).click();
  await page.getByRole('button', { name: 'Configurações', exact: true }).click();
  await page.getByRole('dialog', { name: 'Configurações' }).getByRole('button', { name: /Marca e rodapé/ }).click();
  await page
    .getByLabel('Endereço público dos arquivos', { exact: true })
    .fill('https://assets.example.com');
  await expect(page.getByText('O link oficial da Granistone já é aplicado automaticamente em todos os e-mails.')).toBeVisible();
  await page.getByLabel('Facebook', { exact: true }).fill('https://facebook.com/example');
  await page.getByLabel('Instagram', { exact: true }).fill('https://instagram.com/example');
  await page.getByRole('button', { name: 'Salvar configurações' }).click();
  await page.getByRole('button', { name: 'Revisar e publicar', exact: true }).click();
  await page.getByRole('dialog', { name: 'Revisar e publicar' }).getByRole('button', { name: 'Exportar HTML' }).click();
  await expect(page.getByRole('button', { name: 'Baixar HTML', exact: true })).toBeEnabled();
  const jsonPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Baixar JSON', exact: true }).click();
  const json = await jsonPromise;
  expect(json.suggestedFilename()).toBe('granistone-crystal-palace-arquitetos-pt.json');
  await page.getByRole('button', { name: 'Copiar assunto', exact: true }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('Crystal Palace · arquitetura');
  await page.getByRole('button', { name: 'Copiar preheader', exact: true }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('Conheça a coleção');
  await page.getByRole('button', { name: 'Copiar HTML', exact: true }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('Arquitetura com identidade');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Baixar HTML', exact: true }).click();
  const output = await downloadPromise;
  expect(output.suggestedFilename()).toBe(
    'granistone-crystal-palace-arquitetos-pt.html',
  );
  await page.getByRole('button', { name: 'Fechar', exact: true }).click();
  await expect(page.getByLabel('Status da campanha', { exact: true })).toHaveValue('Exportado');
  await page.reload();
  await page.getByRole('button', { name: 'Crystal Palace', exact: true }).first().click();
  await page.locator('.editor-secondary summary').click(); await page.getByRole('button', { name: 'Configurações avançadas', exact: true }).click();
  await expect(page.getByLabel('Headline', { exact: true })).toHaveValue(
    'Arquitetura com identidade',
  );
  await expect(page.getByLabel('Status da campanha', { exact: true })).toHaveValue('Exportado');
  await page.getByRole('button', { name: 'ENGLISH', exact: true }).click();
  await expect(page.getByLabel('Headline', { exact: true })).toHaveValue(
    'Architecture with identity',
  );
  expect(errors).toEqual([]);
});
test('template library, creation, newsletter reorder and narrow screen', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Templates', exact: false }).first().click();
  await expect(page.getByRole('heading', { name: 'Templates', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Newsletter.*Usar template/ }).click();
  await page.getByLabel('Nome da campanha', { exact: true }).fill('Newsletter de teste');
  await page.getByRole('button', { name: 'Criar campanha', exact: true }).click();
  await page.locator('.editor-secondary summary').click(); await page.getByRole('button', { name: 'Configurações avançadas', exact: true }).click();
  await page.getByRole('button', { name: 'Estrutura', exact: true }).click();
  await page.locator('.legacy-block-controls summary').click();
  await page.getByRole('button', { name: 'Subir Evento', exact: true }).click();
  await expect(page.getByLabel('Template', { exact: true })).toHaveValue('newsletter');
  await page.getByLabel('Template', { exact: true }).selectOption('notice');
  await expect(page.locator('.legacy-block-controls').getByRole('checkbox')).toHaveCount(2);
  await page.getByRole('button', { name: 'Voltar às campanhas', exact: true }).click();
  await page.getByLabel('Buscar campanhas', { exact: true }).fill('Newsletter de teste');
  await expect(page.locator('.campaign-table tbody tr')).toHaveCount(1);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/campaigns-mobile.png', fullPage: true });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
  expect(errors).toEqual([]);
});

test('translation keeps Portuguese and creates Spanish, while visual library stays image-first', async ({ page }) => {
  await page.route('**/api/assets**', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/materials**', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/translate', async (route) => {
    const body = route.request().postDataJSON() as { target: string; items: { id: string; text: string }[] };
    await route.fulfill({ json: { target: body.target, items: body.items.map((item) => ({ ...item, text: item.id === 'headline' ? 'Piedra natural' : `ES: ${item.text}` })) } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Nova campanha', exact: true }).first().click();
  await page.getByLabel('Nome da campanha', { exact: true }).fill('Campanha trilíngue');
  await page.getByRole('button', { name: 'Criar campanha', exact: true }).click();
  await page.locator('.editor-secondary summary').click(); await page.getByRole('button', { name: 'Configurações avançadas', exact: true }).click();
  await page.getByLabel('Headline', { exact: true }).fill('Pedra natural');
  await page.getByRole('button', { name: 'Converter para espanhol', exact: true }).click();
  await page.getByRole('button', { name: 'Gerar em espanhol', exact: true }).click();
  await expect(page.getByLabel('Headline', { exact: true })).toHaveValue('Piedra natural');
  await page.getByRole('button', { name: 'PORTUGUÊS', exact: true }).click();
  await expect(page.getByLabel('Headline', { exact: true })).toHaveValue('Pedra natural');
  await page.getByRole('button', { name: 'Voltar às campanhas', exact: true }).click();
  await page.getByRole('button', { name: 'Biblioteca', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Biblioteca visual' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enviar imagens', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /Entrar com ChatGPT/ }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Materiais' }).click();
  await expect(page.getByText('Nenhuma pasta de pedra encontrada')).toBeVisible();
});

test('campaign list deletes an email only after confirmation and persists the change', async ({ page }) => {
  await page.goto('/');
  const rows = page.locator('.campaign-table tbody tr');
  await expect(rows.first()).toBeVisible();
  const initialCount = await rows.count();
  expect(initialCount).toBeGreaterThan(0);
  await page.getByLabel('Ações de Crystal Palace · Arquitetura').click();
  await page.locator('.campaign-menu[open]').getByRole('button', { name: 'Excluir' }).click();
  const dialog = page.getByRole('dialog', { name: 'Excluir e-mail' });
  await expect(dialog.getByText('Crystal Palace · Arquitetura')).toBeVisible();
  await dialog.getByRole('button', { name: 'Excluir e-mail', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Crystal Palace · Arquitetura', exact: true })).toHaveCount(0);
  await expect.poll(() => page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('granistone-mail-studio', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return await new Promise<boolean>((resolve, reject) => {
      const request = database.transaction('workspace', 'readonly').objectStore('workspace').get('studio');
      request.onsuccess = () => resolve(request.result.campaigns.some((campaign: { title: string }) => campaign.title === 'Crystal Palace · Arquitetura'));
      request.onerror = () => reject(request.error);
    });
  })).toBe(false);
  await page.reload();
  await expect(rows).toHaveCount(initialCount - 1);
});

test('new campaign dialog creates the email with the selected template', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Nova campanha', exact: true }).first().click();
  await expect(page.getByLabel('Template inicial', { exact: true })).toHaveValue('institutional');
  await page.getByLabel('Template inicial', { exact: true }).selectOption('product-commercial');
  await expect(page.getByText('Vitrine em duas colunas: fotografia à esquerda e chamada comercial à direita.')).toBeVisible();
  await page.getByLabel('Nome da campanha', { exact: true }).fill('Campanha comercial');
  await page.getByRole('button', { name: 'Criar campanha', exact: true }).click();
  await page.locator('.editor-secondary summary').click(); await page.getByRole('button', { name: 'Configurações avançadas', exact: true }).click();
  await page.getByRole('button', { name: 'Estrutura', exact: true }).click();
  await expect(page.getByLabel('Template', { exact: true })).toHaveValue('product-commercial');
});
