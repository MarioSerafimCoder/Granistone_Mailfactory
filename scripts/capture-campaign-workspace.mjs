import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const phase = process.argv[2] === 'before' ? 'before' : 'after';
const baseUrl = process.env.CAPTURE_URL || 'http://127.0.0.1:3000/';
const browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : undefined });
const directory = 'docs/screenshots/campaign-workspace';
await mkdir(directory, { recursive: true });

for (const theme of ['light', 'dark']) {
  for (const [width, height] of [[1366, 768], [1440, 900], [1920, 1080]]) {
    const context = await browser.newContext({ viewport: { width, height } });
    await context.addInitScript((selectedTheme) => localStorage.setItem('granistone-ui-theme', selectedTheme), theme);
    const page = await context.newPage();
    await page.goto(baseUrl);
    await page.getByRole('heading', { name: 'Campanhas', exact: true }).waitFor();
    const expectedSelector = phase === 'before' ? '.production-overview' : '.campaign-stage-tabs';
    if (await page.locator(expectedSelector).count() !== 1) throw new Error(`Expected ${phase} workspace at ${baseUrl}`);
    await page.waitForFunction(() => !document.querySelector('.sidebar-sync')?.classList.contains('sync-loading'));
    await page.screenshot({ path: `${directory}/${phase}-${theme}-${width}x${height}.png`, fullPage: true });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    console.log(`${phase} ${theme} ${width}x${height}: horizontal overflow ${overflow}`);
    if (overflow) throw new Error(`Horizontal overflow at ${width}x${height} (${theme})`);
    if (phase === 'after' && width === 1440) {
      await page.getByLabel('Ações de Crystal Palace · Arquitetura').click();
      await page.screenshot({ path: `${directory}/after-${theme}-menu-1440x900.png`, fullPage: true });
      await page.getByLabel('Ações de Crystal Palace · Arquitetura').click();
      await page.getByText('Filtros', { exact: true }).click();
      await page.screenshot({ path: `${directory}/after-${theme}-filters-1440x900.png`, fullPage: true });
      await page.getByText('Filtros', { exact: true }).click();
      await page.getByRole('button', { name: 'Configurações', exact: true }).click();
      await page.screenshot({ path: `${directory}/after-${theme}-settings-1440x900.png`, fullPage: true });
    }
    await context.close();
  }
}

await browser.close();
