import { expect, test } from '@playwright/test';

import { PublicApplicationPage } from './pages/public-application-page';
import { SessionTimeoutDialog } from './pages/session-timeout-dialog';
import { StatusCheckerPage } from './pages/status-checker-page';
import type { StatusCheckerLocale } from './pages/status-checker-page';

for (const locale of ['en', 'fr'] as const satisfies readonly StatusCheckerLocale[]) {
  test(`status results survive a session extension (${locale})`, async ({ page }) => {
    await page.clock.install();
    const statusPage = new StatusCheckerPage(page, locale);
    await statusPage.goto({ hydrate: true });
    await statusPage.checkStatus({ code: '000001', sin: '800000002' });
    await expect(page).toHaveURL(locale === 'en' ? /\/en\/status\/result\?id=/ : /\/fr\/etat\/resultat\?id=/);
    const resultUrl = page.url();

    await page.clock.fastForward('14:01');
    const timeoutDialog = new SessionTimeoutDialog(page, locale);
    await timeoutDialog.waitForPrompt();
    const response = await timeoutDialog.extend();
    expect(response.status()).toBe(200);
    await expect(timeoutDialog.dialog).not.toBeVisible();
    await page.reload();
    await expect(page).toHaveURL(resultUrl);
    await expect(statusPage.checkAnotherStatusButton).toBeVisible();
  });
}

test('extending a session refreshes application state beyond its original TTL', async ({ browser, page, baseURL }) => {
  test.setTimeout(60_000);
  const controlContext = await browser.newContext({ baseURL });

  try {
    const controlPage = await controlContext.newPage();
    await controlPage.route('https://www.canada.ca/**', async (route) => await route.fulfill({ status: 200, contentType: 'text/html', body: 'Test destination' }));
    await page.clock.install();
    const application = new PublicApplicationPage(page);
    await application.start();
    await application.acceptTermsAndConditions();
    const extendedUrl = page.url();
    await expect(application.completedSections).toBeVisible();

    const controlApplication = new PublicApplicationPage(controlPage);
    await controlApplication.goto();
    await controlApplication.waitForEligibilityPage();
    const controlUrl = controlPage.url();

    // Measure real server-side expiration; the browser clock only opens the timeout prompt.
    await page.waitForTimeout(7000);
    await page.clock.fastForward('14:01');
    const timeoutDialog = new SessionTimeoutDialog(page, 'en');
    await timeoutDialog.waitForPrompt();
    const response = await timeoutDialog.extend();
    expect(response.status()).toBe(200);

    await page.waitForTimeout(10_000);
    await page.reload();
    await expect(page).toHaveURL(extendedUrl);
    await expect(application.completedSections).toBeVisible();

    await controlPage.goto(controlUrl);
    await expect(controlPage).toHaveURL('https://www.canada.ca/en/services/benefits/dental/dental-care-plan/apply.html');
  } finally {
    await controlContext.close();
  }
});
