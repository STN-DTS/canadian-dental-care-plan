/**
 * Browser E2E coverage for the submitted-documents index.
 *
 * Verifies the configured backend mock's document rows, displayed metadata,
 * refresh behavior, and navigation into a new upload flow. The fixed mock always
 * returns documents, so this suite does not claim empty-list coverage or test
 * live Power Platform ingestion. External dashboard links are not followed.
 */
import { expect, test } from '@playwright/test';

import { BasePage } from '../../pages/base-page';
import { uploadEntryUrl, uploadFlowUrl } from '../../pages/upload-page';

test.describe('documents index', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/en/protected/documents');
    await new BasePage(page).isLoaded('/en/protected/documents', 'View documents');
  });

  test('shows the submitted documents with accessible column headings', async ({ page }) => {
    await expect(page.getByText('Here is the list of documents you have submitted.', { exact: true })).toBeVisible();
    const table = page.getByRole('table');
    await expect(table.getByRole('columnheader')).toHaveText(['File name', 'Type of document', 'Submitted by', 'Date received']);
    await expect(table.getByRole('row')).toHaveCount(3);
    await expect(table.getByRole('row').nth(1).getByRole('cell').nth(0)).toHaveText('Benefit Provider Letter.pdf');
    await expect(table.getByRole('row').nth(2).getByRole('cell').nth(0)).toHaveText('Employer Letter.pdf');
  });

  test('shows each filename with its document type and submission method', async ({ page }) => {
    const table = page.getByRole('table');
    const benefitLetter = table.getByRole('row').filter({ hasText: 'Benefit Provider Letter.pdf' });
    const employerLetter = table.getByRole('row').filter({ hasText: 'Employer Letter.pdf' });
    await expect(benefitLetter.getByRole('cell').nth(1)).toHaveText('Benefit Provider Letter');
    await expect(benefitLetter.getByRole('cell').nth(2)).toHaveText('Upload');
    await expect(employerLetter.getByRole('cell').nth(1)).toHaveText('Employer Letter');
    await expect(employerLetter.getByRole('cell').nth(2)).toHaveText('Online');
  });

  test('shows received dates for both documents', async ({ page }) => {
    const table = page.getByRole('table');
    const benefitDate = table.getByRole('row').filter({ hasText: 'Benefit Provider Letter.pdf' }).getByRole('cell').nth(3);
    const employerDate = table.getByRole('row').filter({ hasText: 'Employer Letter.pdf' }).getByRole('cell').nth(3);
    await expect(benefitDate).toContainText('2025');
    await expect(benefitDate.locator('time')).toHaveAttribute('datetime', '2025-10-21T16:33:31.000Z');
    await expect(employerDate).toContainText('2025');
    await expect(employerDate.locator('time')).toHaveAttribute('datetime', '2025-10-21T15:53:11.000Z');
  });

  test('retains the submitted list after refreshing', async ({ page }) => {
    await page.reload();
    await new BasePage(page).isLoaded('/en/protected/documents', 'View documents');
    await expect(page.getByRole('table').getByRole('row')).toHaveCount(3);
    await expect(page.getByRole('cell', { name: 'Benefit Provider Letter.pdf', exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Employer Letter.pdf', exact: true })).toBeVisible();
  });

  test('Upload more documents opens a new upload flow', async ({ page }) => {
    const uploadLink = page.getByRole('link', { name: 'Upload more documents', exact: true });
    await expect(uploadLink).toHaveAttribute('href', uploadEntryUrl);
    await uploadLink.click();
    await new BasePage(page).isLoaded(uploadFlowUrl, 'Submit documents');
    await expect(page.getByRole('status')).toHaveText('0 of 10 files selected');
  });

  test('offers a return link without testing the external dashboard', async ({ page }) => {
    const returnLink = page.getByRole('main').getByRole('link', { name: 'Return to dashboard', exact: true });
    await expect(returnLink).toBeVisible();
    await expect(returnLink).toHaveAttribute('href', /^https:\/\/.+\/en\/my-dashboard$/);
  });
});
