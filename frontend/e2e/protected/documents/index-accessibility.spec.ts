/**
 * Full-page axe checks for the submitted-documents index using default axe rules.
 * Reports include inconclusive results for manual assessment; scans do not prove
 * full WCAG conformance or screen-reader usability.
 */
import { expect } from '@playwright/test';

import { test } from '../../fixtures/accessibility';
import { BasePage } from '../../pages/base-page';

test.describe('documents index accessibility', { tag: '@a11y' }, () => {
  test('populated documents table', async ({ page, checkAccessibility }) => {
    await page.goto('/en/protected/documents');
    await new BasePage(page).isLoaded('/en/protected/documents', 'View documents');
    await expect(page.getByRole('table')).toBeVisible();
    await checkAccessibility('documents-index');
  });
});
