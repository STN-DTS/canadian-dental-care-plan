import { expect, test } from '@playwright/test';

test.describe('data unavailable page', () => {
  test('should navigate data unavailable page', async ({ page }) => {
    await page.goto('/en/protected/data-unavailable');
    await expect(page).toHaveURL('/en/protected/data-unavailable');
  });
});
