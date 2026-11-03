/**
 * Full-page axe checks for the upload form and its interactive states.
 * Uses the existing mock-backed application and default axe rules, without exclusions.
 * Scan reports include inconclusive results that require manual assessment.
 * These checks do not establish full WCAG conformance or screen-reader usability.
 */
import { expect, mergeTests } from '@playwright/test';

import { test as accessibilityTest } from '../../fixtures/accessibility';
import { test as documentUploadTest } from '../../fixtures/document-upload';
import { collectUploadRequests, documentFile, navigateUploadRouter, uploadFailureName } from '../../utils/document-upload';

const test = mergeTests(documentUploadTest, accessibilityTest);

for (const locale of ['en', 'fr'] as const) {
  for (const width of [375, 1280]) {
    test.describe(`review accessibility ${locale} ${width}px`, { tag: '@a11y' }, () => {
      test.use({ uploadLocale: locale, viewport: { width, height: 900 } });
      test('traps keyboard focus, restores it on Escape, and announces busy results', async ({ uploadPage, checkAccessibility }) => {
        test.setTimeout(30_000);
        const { page, copy } = uploadPage;
        const requests = collectUploadRequests(page);
        await uploadPage.addFile();
        await uploadPage.chooseType('evidence.txt');
        await uploadPage.submitButton.focus();
        await uploadPage.submitButton.press('Enter');
        const back = uploadPage.reviewDialog.getByRole('button', { name: copy.back, exact: true });
        const close = uploadPage.reviewDialog.getByRole('button', { name: locale === 'en' ? 'Close' : 'Fermer', exact: true });
        await expect(back).toBeFocused();
        await checkAccessibility('submission-review');
        await back.press('Shift+Tab');
        await expect(close).toBeFocused();
        await close.press('Tab');
        await expect(back).toBeFocused();
        await back.press('Escape');
        await expect(uploadPage.reviewDialog).not.toBeVisible();
        await expect(uploadPage.submitButton).toBeFocused();
        expect(requests).toHaveLength(0);
        await uploadPage.addFile(documentFile(uploadFailureName));
        await uploadPage.chooseType(uploadFailureName);
        let release!: () => void;
        const pending = new Promise<void>((resolve) => {
          release = resolve;
        });
        await page.route(/\/(documents\/upload|documents\/televerser)\//, async (route) => {
          if (route.request().method() === 'POST') {
            await pending;
          }

          await route.continue();
        });

        try {
          await uploadPage.submit();
          await expect(uploadPage.reviewDialog).toHaveAttribute('aria-busy', 'true');
          const confirm = uploadPage.reviewDialog.getByRole('button', { name: copy.submit, exact: true });
          await expect(confirm).toBeDisabled();
          await expect(back).toBeDisabled();
          await expect(confirm.locator('[data-icon="spinner"]')).toBeVisible();
          await expect(close).toHaveCount(0);
          await page.keyboard.press('Escape');
          await page.mouse.click(0, 0);
          await expect(uploadPage.reviewDialog).toBeVisible();
          await checkAccessibility('submission-review-busy');
          expect(requests).toHaveLength(1);
        } finally {
          release();
        }

        await uploadPage.expectUploadCounts(1, 1);
        await expect(uploadPage.reviewDialog).not.toBeVisible();
        await expect(page.locator('[data-error-summary-id]')).toBeFocused();
        await expect(page.locator('[data-error-summary-id]').getByRole('heading')).toContainText(locale === 'fr' ? /erreur/i : /error/i);
        await checkAccessibility('localized-upload-errors');
      });
    });
  }
}

test.describe('upload form accessibility', { tag: '@a11y' }, () => {
  test('empty upload form', async ({ uploadPage, checkAccessibility }) => {
    await expect(uploadPage.status).toHaveText('Files selected: 0');
    await checkAccessibility('empty-form');
  });

  test('selected file and document type', async ({ uploadPage, checkAccessibility }) => {
    await uploadPage.addFile();
    await uploadPage.chooseType('evidence.txt');
    await expect(uploadPage.item('evidence.txt').getByRole('combobox')).not.toHaveValue('');
    await checkAccessibility('selected-file');
  });

  test('required-file validation error', async ({ uploadPage, page, checkAccessibility }) => {
    await uploadPage.openReview();
    await expect(page.getByText('You must upload a file before clicking', { exact: false }).first()).toBeVisible();
    await checkAccessibility('required-file-error');
    await uploadPage.uploadButton.hover();
    await checkAccessibility('required-file-error-hover');
    await uploadPage.uploadButton.focus();
    await checkAccessibility('required-file-error-focus');
  });

  test('file-specific document-type validation error', async ({ uploadPage, checkAccessibility }) => {
    await uploadPage.addFile();
    await uploadPage.openReview();
    await expect(uploadPage.item('evidence.txt')).toContainText('Select a document type for file');
    await checkAccessibility('document-type-error');
  });

  test('removal dialog supports keyboard trapping and dismissal', async ({ uploadPage, checkAccessibility }) => {
    await uploadPage.addFile();
    const trigger = uploadPage.item('evidence.txt').getByRole('button', { name: 'Remove file', exact: true });
    await trigger.focus();
    await trigger.press('Enter');
    await expect(uploadPage.removeDialog).toBeVisible();
    await checkAccessibility('removal-dialog');
    const firstButton = uploadPage.removeDialog.getByRole('button', { name: 'Keep file', exact: true });
    const lastButton = uploadPage.removeDialog.getByRole('button', { name: 'Close', exact: true });
    await firstButton.focus();
    await firstButton.press('Shift+Tab');
    await expect(lastButton).toBeFocused();
    await lastButton.press('Tab');
    await expect(firstButton).toBeFocused();
    await firstButton.press('Escape');
    await expect(uploadPage.removeDialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
    await expect(uploadPage.item('evidence.txt')).toBeVisible();
  });

  test('unsaved-changes dialog supports keyboard trapping and dismissal', async ({ uploadPage, checkAccessibility }) => {
    await uploadPage.addFile();
    await uploadPage.uploadButton.focus();
    await navigateUploadRouter(uploadPage.page, '/en/protected/documents');
    await expect(uploadPage.unsavedChangesDialog).toBeVisible();
    await checkAccessibility('unsaved-changes-dialog');
    const firstButton = uploadPage.unsavedChangesDialog.getByRole('button', { name: 'Stay on this page', exact: true });
    const lastButton = uploadPage.unsavedChangesDialog.getByRole('button', { name: 'Close', exact: true });
    await firstButton.focus();
    await firstButton.press('Shift+Tab');
    await expect(lastButton).toBeFocused();
    await lastButton.press('Tab');
    await expect(firstButton).toBeFocused();
    await firstButton.press('Escape');
    await expect(uploadPage.unsavedChangesDialog).not.toBeVisible();
    await expect(uploadPage.uploadButton).toBeFocused();
    await expect(uploadPage.item('evidence.txt')).toBeVisible();
  });

  test('partial upload success and file-specific failure', async ({ uploadPage, checkAccessibility }) => {
    await uploadPage.partialUpload();
    const uploadedItem = uploadPage.item('evidence.txt');
    await expect(uploadedItem).toHaveAccessibleName('');
    await expect(uploadedItem).toHaveAccessibleDescription('');
    await expect(uploadedItem).not.toHaveAttribute('aria-labelledby');
    await expect(uploadedItem).not.toHaveAttribute('aria-describedby');
    const documentType = await uploadPage.item(uploadFailureName).locator('option:checked').innerText();
    const time = uploadedItem.locator('time');
    const uploadDateText = await time.innerText();
    await expect(uploadedItem.getByRole('term')).toHaveText(['File name', 'Document Type:', 'Uploaded on:', 'Status']);
    await expect(uploadedItem.getByRole('definition')).toHaveText(['evidence.txt', documentType, uploadDateText, 'Uploaded successfully']);
    await expect(time).toHaveAttribute('datetime', /^\d{4}-\d{2}-\d{2}T.+Z$/);
    await expect(time.locator('..')).toHaveAttribute('aria-label', uploadDateText);
    await expect(uploadedItem.getByRole('definition').nth(1)).toHaveText(documentType);
    await expect(uploadPage.item(uploadFailureName)).toHaveAccessibleName(uploadFailureName);
    await expect(uploadPage.uploadedFiles).toHaveAttribute('id', 'uploaded-files-list');
    await expect(uploadPage.pendingFiles).toHaveAttribute('id', 'pending-files-list');
    await Promise.all([uploadPage.uploadedFiles, uploadPage.pendingFiles].map(async (list) => await expect(list.getByRole('listitem')).toHaveCount(1)));
    await checkAccessibility('partial-upload');
  });

  test('uploaded-only status and explicit completion action', async ({ uploadPage, checkAccessibility }) => {
    await uploadPage.partialUpload();
    await uploadPage.removeFile(uploadFailureName);
    await expect(uploadPage.finishButton).toBeVisible();
    await expect(uploadPage.page.getByRole('region', { name: 'Files uploaded: 1', exact: true })).toBeFocused();
    await checkAccessibility('uploaded-only');
  });
});
