/**
 * Full-page axe checks for the finished upload confirmation using default rules.
 * Uses real form submissions against application mocks. Reports include
 * inconclusive results for manual assessment; scans do not prove full WCAG
 * conformance or screen-reader usability.
 */
import { expect, mergeTests } from '@playwright/test';

import { test as accessibilityTest } from '../../fixtures/accessibility';
import { test as documentUploadTest } from '../../fixtures/document-upload';

const test = mergeTests(documentUploadTest, accessibilityTest);

test.describe('upload confirmation accessibility', { tag: '@a11y' }, () => {
  test('finished upload confirmation', async ({ uploadSubmittedPage, checkAccessibility }) => {
    await expect(uploadSubmittedPage.receiptHeading).toBeVisible();
    await expect(uploadSubmittedPage.submittedFiles).toHaveCount(2);
    await checkAccessibility('confirmation');
  });
});
