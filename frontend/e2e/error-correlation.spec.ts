import { test as base, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

import config from '../playwright.config';

const test = base.extend<{}, { diagnostics: string[] }>({
  diagnostics: [
    async ({ playwright }, use) => {
      const records: string[] = [];
      const readiness = await playwright.request.newContext();
      const serverConfig = Array.isArray(config.webServer) ? config.webServer[0] : config.webServer;
      const server = spawn('pnpm', ['run', 'start:test-errors'], {
        cwd: process.cwd(),
        detached: true,
        env: { ...process.env, ...serverConfig?.env, PORT: '3011', AUDIT_LOG_ENABLED: 'false', LOG_LEVEL: 'error', OTEL_SDK_DISABLED: 'true' },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      server.stdout.on('data', (chunk: Buffer) => records.push(chunk.toString()));
      server.stderr.on('data', (chunk: Buffer) => records.push(chunk.toString()));

      try {
        await expect
          .poll(
            async () => {
              try {
                await readiness.get('http://localhost:3011/');
                return true;
              } catch {
                if (server.exitCode !== null) {
                  throw new Error(`Synthetic server exited: ${records.join('')}`);
                }

                return false;
              }
            },
            { timeout: 30_000 },
          )
          .toBe(true);
        await use(records);
      } finally {
        await readiness.dispose();

        if (server.pid && server.exitCode === null) {
          const exit = once(server, 'exit');
          process.kill(-server.pid, 'SIGTERM');
          await exit;
        }
      }
    },
    { scope: 'worker', auto: true },
  ],
});

for (const path of ['/en/application', '/fr/demande', '/en/protected/application', '/fr/protege/demande']) {
  test(`production SSR preserves localized selectable IDs at ${path}`, async ({ page, request }) => {
    const response = await request.get(`${path}?synthetic=direct`);
    expect(response.status()).toBe(500);
    expect(await response.text()).toContain('AB-123456');
    await page.goto(`${path}?synthetic=direct`);
    await page.waitForFunction(() => (window as unknown as { __reactRouterDataRouter?: { state: { initialized: boolean } } }).__reactRouterDataRouter?.state.initialized === true);
    await expect(page.locator('main .select-text')).toHaveText('AB-123456');
    await expect(page.locator('main strong').filter({ hasText: path.startsWith('/fr') ? 'Identifiant de corrélation' : 'Correlation ID:' })).toBeVisible();
    await expect(page.locator('main')).not.toContainText('Synthetic application failure');
    await expect(page.locator('main')).not.toContainText('TST-0000');
    const selection = await page.locator('main .select-text').evaluate((element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      const selected = window.getSelection();
      selected?.removeAllRanges();
      selected?.addRange(range);
      return { text: selected?.toString(), userSelect: getComputedStyle(element).userSelect, tabIndex: (element as HTMLElement).tabIndex };
    });
    expect(selection).toEqual({ text: 'AB-123456', userSelect: 'text', tabIndex: -1 });
  });
}

test('production client navigation preserves bilingual IDs and sanitized diagnostics', async ({ page, request, diagnostics }) => {
  const bilingualResponse = await request.get('/');
  expect(bilingualResponse.status()).toBe(500);
  const bilingualHtml = await bilingualResponse.text();
  expect(bilingualHtml).toContain('Correlation ID:');
  expect(bilingualHtml).toContain('Identifiant de corrélation');
  expect(bilingualHtml).toContain('AB-123456');

  await page.goto('/en/application?synthetic=not-found');
  await expect(page.getByText('(Error 404)')).toBeVisible();
  await expect(page.locator('main .select-text')).toHaveText('AB-123456');

  await page.goto('/en/application?synthetic=generic');
  await expect(page.locator('main .select-text')).toHaveCount(0);

  await page.goto('/en/application?synthetic=direct');
  await page.waitForFunction(() => (window as unknown as { __reactRouterDataRouter?: { state: { initialized: boolean } } }).__reactRouterDataRouter?.state.initialized === true);
  let documentRequests = 0;
  page.on('request', (event) => {
    if (event.isNavigationRequest()) {
      documentRequests++;
    }
  });
  const recovery = page.locator('main a[href="/"]');
  await recovery.focus();
  await expect(recovery).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#english .select-text')).toHaveText('AB-123456');
  await expect(page.locator('#french .select-text')).toHaveText('AB-123456');
  await expect(page.locator('#english strong')).toHaveText('Correlation ID:');
  await expect(page.locator('#french strong')).toHaveText('Identifiant de corrélation\u00A0:');
  expect(documentRequests).toBe(0);
  await page.screenshot({ path: 'test-results/error-correlation-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.screenshot({ path: 'test-results/error-correlation-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  const applicationRecords = diagnostics
    .join('')
    .split('\n')
    .filter((line) => line.startsWith('{'))
    .map((line) => JSON.parse(line) as Record<string, unknown>)
    .filter((record) => record.label === 'entry.server/handleError' && record.message === 'Application error');
  expect(applicationRecords.length).toBeGreaterThan(0);

  for (const record of applicationRecords) {
    expect(record.correlationId).toBe('AB-123456');
    expect(record).not.toHaveProperty('msg');
    expect(record).not.toHaveProperty('stack');
  }
});
