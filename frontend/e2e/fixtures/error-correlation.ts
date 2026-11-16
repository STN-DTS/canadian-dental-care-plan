import { StatusCheckerPage } from '../pages/status-checker-page';
import type { StatusCheckerLocale } from '../pages/status-checker-page';
import { test as accessibilityTest } from './accessibility';

/**
 * Provides an opened status checker for each test, plus axe scans.
 *
 * `statusLocale` selects the route language. The page waits for React Router
 * hydration unless the test disables JavaScript, so submissions take the same
 * fetcher or document path a user's browser would.
 */
export const test = accessibilityTest.extend<{ statusLocale: StatusCheckerLocale; statusCheckerPage: StatusCheckerPage }>({
  statusLocale: ['en', { option: true }],
  statusCheckerPage: async ({ page, statusLocale, javaScriptEnabled }, use) => {
    const statusCheckerPage = new StatusCheckerPage(page, statusLocale);
    await statusCheckerPage.goto({ hydrate: javaScriptEnabled !== false });
    await use(statusCheckerPage);
  },
});

export { expect } from '@playwright/test';
