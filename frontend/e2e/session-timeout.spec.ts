import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

import { test } from './fixtures/accessibility';
import { BasePage } from './pages/base-page';
import { PublicApplicationPage } from './pages/public-application-page';
import { SessionTimeoutDialog } from './pages/session-timeout-dialog';

async function openTimeout(page: Page, locale: 'en' | 'fr' = 'en') {
  await new BasePage(page).waitForHydration();
  await page.clock.fastForward('14:01');
  const timeoutDialog = new SessionTimeoutDialog(page, locale);
  await expect(timeoutDialog.dialog).toHaveCount(1);
  return timeoutDialog;
}

test('a fresh public application issues a session cookie and retains its state after extension', async ({ context, page }) => {
  await page.clock.install();
  expect((await context.cookies()).map(({ name }) => name)).not.toContain('__CDCP||session');

  const application = new PublicApplicationPage(page);
  await application.goto();
  expect((await context.cookies()).map(({ name }) => name)).toContain('__CDCP||session');
  await application.waitForEligibilityPage();
  const applicationUrl = page.url();

  await application.acceptTermsAndConditions();
  await expect(page).toHaveURL(applicationUrl);

  const timeoutDialog = await openTimeout(page);
  const response = await timeoutDialog.extend();
  expect(response.status()).toBe(200);
  expect(response.request().postDataJSON()).toEqual({ action: 'extend' });
  await expect(timeoutDialog.dialog).not.toBeVisible();
  await page.reload();
  await expect(page).toHaveURL(applicationUrl);
  await expect(application.completedSections).toBeVisible();
});

for (const scenario of [
  {
    name: 'English application',
    entry: '/en/application',
    application: true,
    locale: 'en',
    redirectTo: 'cdcp-website-apply',
    destination: 'https://www.canada.ca/en/services/benefits/dental/dental-care-plan/apply.html',
  },
  {
    name: 'French status',
    entry: '/fr/etat',
    application: false,
    locale: 'fr',
    redirectTo: 'cdcp-website-status',
    destination: 'https://www.canada.ca/fr/services/prestations/dentaire/regime-soins-dentaires/demande.html#etat',
  },
  {
    name: 'French public page',
    entry: '/fr/impossible-de-traiter-la-demande',
    application: false,
    locale: 'fr',
    redirectTo: 'cdcp-website',
    destination: 'https://www.canada.ca/fr/services/prestations/dentaire/regime-soins-dentaires.html',
  },
] as const) {
  test(`${scenario.name} timeout ends at the localized destination`, async ({ page }) => {
    await page.route('https://www.canada.ca/**', async (route) => await route.fulfill({ status: 200, contentType: 'text/html', body: 'Test destination' }));
    await page.clock.install();
    await page.goto(scenario.entry);

    if (scenario.application) {
      const application = new PublicApplicationPage(page);
      await application.waitForHydration();
      await application.waitForEligibilityPage();
    }

    const timeoutDialog = await openTimeout(page, scenario.locale);
    const request = await timeoutDialog.endPublic();
    expect(request.postDataJSON()).toEqual({ action: 'end', locale: scenario.locale, redirectTo: scenario.redirectTo });
    await expect(page).toHaveURL(scenario.destination);
  });
}

test('protected pages show one timeout dialog and extend the session', async ({ page }) => {
  await page.clock.install();
  await page.goto('/en/protected/letters');
  const timeoutDialog = await openTimeout(page);
  const response = await timeoutDialog.extend();
  expect(response.status()).toBe(200);
  expect(response.request().postDataJSON()).toEqual({ action: 'extend' });
  await expect(timeoutDialog.dialog).not.toBeVisible();
  await expect(page).toHaveURL('/en/protected/letters');
});

test('a general public page extends the session without navigating away', async ({ page }) => {
  await page.clock.install();
  await page.goto('/en/unable-to-process-request');
  const timeoutDialog = await openTimeout(page);
  const response = await timeoutDialog.extend();
  expect(response.status()).toBe(200);
  expect(response.request().postDataJSON()).toEqual({ action: 'extend' });
  await expect(timeoutDialog.dialog).not.toBeVisible();
  await expect(page).toHaveURL('/en/unable-to-process-request');
});

test('ending a French protected session requests logout in French', async ({ page }) => {
  await page.clock.install();
  await page.goto('/fr/protege/lettres');
  const timeoutDialog = await openTimeout(page, 'fr');
  const request = await timeoutDialog.endProtected();
  expect(new URL(request.url()).searchParams.get('locale')).toBe('fr');
  await expect(page).toHaveURL('/');
});

test('the protected timeout dialog supports keyboard dismissal', { tag: '@a11y' }, async ({ page, checkAccessibility }) => {
  await page.clock.install();
  await page.goto('/en/protected/letters');
  const timeoutDialog = await openTimeout(page);
  await expect(timeoutDialog.dialog).toHaveAccessibleName('Session timeout warning');
  await checkAccessibility('protected-session-timeout');

  const response = await timeoutDialog.dismissWithEscape();
  expect(response.status()).toBe(200);
  await expect(timeoutDialog.dialog).not.toBeVisible();
});
