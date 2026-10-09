/**
 * Full-page axe checks for the upload form and its interactive states.
 * Uses the existing mock-backed application and default axe rules, without exclusions.
 * Scan reports include inconclusive results that require manual assessment.
 * These checks do not establish full WCAG conformance or screen-reader usability.
 */
import { expect, mergeTests } from '@playwright/test';

import { test as accessibilityTest } from '../../fixtures/accessibility';
import { test as documentUploadTest } from '../../fixtures/document-upload';
import { navigateUploadRouter, uploadFailureName } from '../../utils/document-upload';

const test = mergeTests(documentUploadTest, accessibilityTest);

test.describe('upload form accessibility', { tag: '@a11y' }, () => {
  test('empty upload form', async ({ uploadPage, checkAccessibility }) => {
    await expect(uploadPage.status).toHaveText('0 of 10 files selected');
    await checkAccessibility('empty-form');
  });

  test('selected file and document type', async ({ uploadPage, checkAccessibility }) => {
    await uploadPage.addFile();
    await uploadPage.chooseType('evidence.txt');
    await expect(uploadPage.item('evidence.txt').getByRole('combobox')).not.toHaveValue('');
    await checkAccessibility('selected-file');
  });

  test('required-file validation error', async ({ uploadPage, page, checkAccessibility }) => {
    await uploadPage.submit();
    await expect(page.getByText('You must upload a file before clicking', { exact: false }).first()).toBeVisible();
    await checkAccessibility('required-file-error');
    await uploadPage.uploadButton.hover();
    await checkAccessibility('required-file-error-hover');
    await uploadPage.uploadButton.focus();
    await checkAccessibility('required-file-error-focus');
  });

  test('file-specific document-type validation error', async ({ uploadPage, checkAccessibility }) => {
    await uploadPage.addFile();
    await uploadPage.submit();
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
    await expect(uploadPage.status).toContainText('1 file uploaded successfully. 1 file remaining to upload');
    await checkAccessibility('partial-upload');
  });

  test('uploaded-only status and explicit completion action', async ({ uploadPage, checkAccessibility }) => {
    await uploadPage.partialUpload();
    await uploadPage.removeFile(uploadFailureName);
    await expect(uploadPage.finishButton).toBeVisible();
    await expect(uploadPage.page.getByRole('region', { name: '1 file uploaded successfully' })).toBeFocused();
    await checkAccessibility('uploaded-only');
  });
});
