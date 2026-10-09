/**
 * Browser E2E coverage for the document upload confirmation page.
 *
 * Completes real form submissions against the configured backend mocks before
 * checking receipt content, successful filenames, next steps, and session-backed
 * navigation. Confirmation represents submission, not Power Platform ingestion.
 * Optional screenshots are configured centrally; external dashboard links are
 * not followed. Upload-form interactions and malformed HTTP payloads are covered by
 * upload.spec.ts and upload-contract.spec.ts respectively.
 */
import { expect, test } from '../../fixtures/document-upload';
import { uploadEntryUrl, uploadFailureName } from '../../pages/upload-page';
import { UploadSubmittedPage } from '../../pages/upload-submitted-page';

const submittedNames = ['eligibility-review.txt', 'employer-letter.txt'];

test.describe('finished upload confirmation', () => {
  test('shows the receipt and successful filenames in selection order', async ({ uploadSubmittedPage, page }) => {
    const { main } = uploadSubmittedPage;
    await expect(uploadSubmittedPage.receiptHeading).toBeVisible();
    await expect(main.getByText('You submitted:', { exact: true })).toBeVisible();
    await expect(uploadSubmittedPage.submittedFiles).toHaveText(submittedNames);
    await expect(main.getByRole('combobox')).toHaveCount(0);
    await expect(main.getByRole('button', { name: /^(Submit|Submit remaining files)$/ })).toHaveCount(0);
    await expect(page).toHaveTitle(/^Documents submitted/);
  });

  test('explains delayed account visibility and both next steps', async ({ uploadSubmittedPage }) => {
    await expect(uploadSubmittedPage.delayNotice).toBeVisible();
    await expect(uploadSubmittedPage.nextStepsHeading).toBeVisible();
    await expect(uploadSubmittedPage.nextSteps).toHaveText(["We'll review the documents submitted.", "We'll send you a letter to let you know whether or not you are eligible for the Canadian Dental Care Plan."]);
  });

  test('offers a return link without following the external dashboard', async ({ uploadSubmittedPage }) => {
    const { returnLink } = uploadSubmittedPage;
    await expect(returnLink).toBeVisible();
    await expect(returnLink).toHaveAttribute('href', /^https:\/\/.+\/en\/my-dashboard$/);
  });

  test('refresh retains confirmation without submitting files again', async ({ uploadPage, uploadSubmittedPage, page }) => {
    const confirmationUrl = page.url();
    const requests = uploadPage.requests();
    await page.reload();
    await uploadSubmittedPage.waitForConfirmation();
    await expect(page).toHaveURL(confirmationUrl);
    await expect(uploadSubmittedPage.submittedFiles).toHaveText(submittedNames);
    expect(requests).toHaveLength(0);
  });

  test('revisiting the finished form redirects to the same confirmation', async ({ uploadSubmittedPage, page }) => {
    const confirmationUrl = page.url();
    const formUrl = confirmationUrl.replace(/\/submitted$/, '');
    await page.goto(formUrl);
    await uploadSubmittedPage.waitForConfirmation();
    await expect(page).toHaveURL(confirmationUrl);
    await expect(uploadSubmittedPage.submittedFiles).toHaveText(submittedNames);
  });
});

test.describe('confirmation access and partial completion', () => {
  test('unfinished flow redirects to the documents index', async ({ uploadPage }) => {
    await uploadPage.page.goto(`${uploadPage.page.url()}/submitted`);
    await uploadPage.isLoaded('/en/protected/documents', 'View documents');
    await expect(uploadPage.page.getByRole('heading', { name: 'We received your documents', exact: true })).toHaveCount(0);
  });

  test('unavailable session flow redirects to the documents index', async ({ uploadPage }) => {
    await uploadPage.page.goto(`${uploadEntryUrl}/00000000-0000-4000-8000-000000000000/submitted`);
    await uploadPage.isLoaded('/en/protected/documents', 'View documents');
  });

  test('partial upload confirms only successful files after explicit completion', async ({ uploadPage }) => {
    await uploadPage.partialUpload();
    await uploadPage.removeFile(uploadFailureName);
    await uploadPage.page.getByRole('button', { name: 'View submission confirmation', exact: true }).click();
    const submittedPage = new UploadSubmittedPage(uploadPage.page);
    await submittedPage.waitForConfirmation();
    await expect(submittedPage.submittedFiles).toHaveText(['evidence.txt']);
    await expect(submittedPage.main.getByText(uploadFailureName, { exact: true })).toHaveCount(0);
  });
});
