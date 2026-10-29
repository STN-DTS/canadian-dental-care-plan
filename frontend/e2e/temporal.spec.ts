import { expect, test } from '@playwright/test';

import { BasePage } from './pages/base-page';
import { waitForUploadRouter } from './utils/document-upload';

test.describe('Temporal fallback', () => {
  test.use({ timezoneId: 'America/Vancouver' });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(globalThis, 'Temporal', { value: undefined, writable: true, configurable: true });
    });
  });

  for (const { path, title, date } of [
    { path: '/en/protected/documents', title: 'View documents', date: 'October 21, 2025' },
    { path: '/fr/protege/documents', title: 'Consulter mes documents', date: '21 octobre 2025' },
  ]) {
    test(`renders localized dates without native Temporal at ${path}`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') {
          errors.push(message.text());
        }
      });

      await page.goto(path);
      await new BasePage(page).isLoaded(path, title);
      await waitForUploadRouter(page);
      await expect(page.getByRole('table').locator('time')).toHaveText([date, date]);
      await expect(page.getByRole('table').locator('time').first()).toHaveAttribute('datetime', '2025-10-21T16:33:31Z');
      expect(await page.evaluate(() => Temporal.PlainDate.from('2000-01-01').toLocaleString('fr-CA', { dateStyle: 'long' }))).toBe('1 janvier 2000');
      expect(errors).toEqual([]);
    });
  }
});
