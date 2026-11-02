/**
 * Browser E2E coverage for the document upload confirmation page.
 *
 * Completes real form submissions against the configured backend mocks before
 * checking localized filename/type pairs, next steps, and session-backed
 * navigation. Confirmation represents submission, not Power Platform ingestion.
 * Optional screenshots are configured centrally; external dashboard links are
 * not followed. Upload-form interactions and malformed HTTP payloads are covered by
 * upload.spec.ts and upload-contract.spec.ts respectively.
 */
import type { Locator, Page } from '@playwright/test';

import { expect, test } from '../../fixtures/document-upload';
import { collectUploadRequests, documentFile, readUploadSubmissions, uploadEntryUrl, uploadFailureName, waitForUploadRouter } from '../../utils/document-upload';

const submittedNames = ['eligibility-review.txt', 'employer-letter.txt'];
// Expected natural labels from the configured code-table mock, not loader output.
const receiptCopy = {
  en: {
    types: ['Canadian Dental Care Plan Eligibility Review Form', 'Employer Letter'],
    heading: 'We received your documents',
    paragraph: 'You submitted:',
    nextSteps: 'Next steps',
    picker: 'Upload file',
    documentType: 'Document Type',
    submit: 'Submit',
    review: 'Confirm submission',
  },
  fr: {
    types: ['Formulaire d’examen de l’admissibilité des membres du Régime canadien de soins dentaires', 'Lettre – employeur'],
    heading: 'Nous avons reçu vos documents',
    paragraph: 'Vous avez soumis :',
    nextSteps: 'Prochaines étapes',
    picker: 'Ajouter un fichier',
    documentType: 'Type de document',
    submit: 'Soumettre',
    review: 'Confirmer la soumission',
  },
} as const;

/** Exact punctuation, filename identity, localized type, count, and journey order. */
function pairs(names: string[], locale: keyof typeof receiptCopy = 'en') {
  return names.map((name, index) => `${name}, (${receiptCopy[locale].types[index]})`);
}

/** Uses actual localized form controls rather than the English-only page object. */
async function submitLocalizedFiles(page: Page, locale: keyof typeof receiptCopy, names: string[]) {
  const copy = receiptCopy[locale];

  if (locale === 'fr') {
    await page.goto('/fr/protege/documents/televerser');
    await expect(page).toHaveURL(/\/fr\/protege\/documents\/televerser\/[0-9a-f-]+$/);
    await expect(page.getByRole('heading', { name: 'Soumettre des documents', exact: true })).toBeVisible();
    await waitForUploadRouter(page);
  }

  // Picker interactions and session mutations must run sequentially.
  await names.reduce(async (previous, name, index) => {
    await previous;
    const picker = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: copy.picker, exact: true }).click();
    await (await picker).setFiles(documentFile(name, `Evidence ${index}`));
    const item = page.getByRole('listitem').filter({ has: page.getByText(name, { exact: true }) });
    await expect(item).toBeVisible();
    await item.getByRole('combobox', { name: copy.documentType, exact: true }).selectOption({ label: copy.types[index] });
  }, Promise.resolve());

  await page.getByRole('button', { name: copy.submit, exact: true }).click();
  await page.getByRole('dialog', { name: copy.review, exact: true }).getByRole('button', { name: copy.submit, exact: true }).click();
  await expect(page).toHaveURL(locale === 'fr' ? /\/soumis$/ : /\/submitted$/);
  await expect(page.getByRole('heading', { name: copy.heading, exact: true })).toBeVisible();
}

/** Measures plain text directly; no filename/type spans are required by the UI. */
async function expectUnclippedPairs(items: Locator, width: number) {
  const measurements = await items.evaluateAll((elements) =>
    elements.map((element) => {
      const bounds = element.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(element);
      const lines = [...range.getClientRects()].map((rect) => ({ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }));
      return {
        left: bounds.left,
        right: bounds.right,
        top: bounds.top,
        bottom: bounds.bottom,
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
        marker: getComputedStyle(element).listStyleType,
        lines,
      };
    }),
  );

  for (const item of measurements) {
    expect(item.marker).toBe('none');
    expect(item.scrollWidth).toBeLessThanOrEqual(item.clientWidth + 1);
    expect(item.scrollHeight).toBeLessThanOrEqual(item.clientHeight + 1);
    expect(item.left).toBeGreaterThanOrEqual(0);
    expect(item.right).toBeLessThanOrEqual(width);
    // The unbroken filename must wrap even at the desktop width.
    expect(new Set(item.lines.map(({ top }) => top)).size).toBeGreaterThan(1);

    for (const [lineIndex, line] of item.lines.entries()) {
      expect(line.left).toBeGreaterThanOrEqual(item.left - 1);
      expect(line.right).toBeLessThanOrEqual(item.right + 1);
      expect(line.top).toBeGreaterThanOrEqual(item.top - 1);
      expect(line.bottom).toBeLessThanOrEqual(item.bottom + 1);
      const previousLine = item.lines[lineIndex - 1];

      if (previousLine) {
        expect(line.top).toBeGreaterThanOrEqual(previousLine.bottom - 1);
      }
    }
  }

  for (const [index, item] of measurements.entries()) {
    const previous = measurements[index - 1];

    if (previous) {
      expect(item.top).toBeGreaterThanOrEqual(previous.bottom);
    }
  }
}

test.describe('finished upload confirmation', () => {
  test('shows exact unnumbered filename/type pairs under the receipt paragraph in selection order', async ({ uploadSubmittedPage, page }) => {
    const { main } = uploadSubmittedPage;
    await expect(uploadSubmittedPage.receiptHeading).toBeVisible();
    await expect(main.getByText('You submitted:', { exact: true })).toBeVisible();
    await expect(uploadSubmittedPage.submittedFiles).toHaveText(pairs(submittedNames));
    const list = main.locator('ol');
    await expect(list).toHaveAttribute('role', 'list');
    await expect(list.locator('li > *')).toHaveCount(0);
    await expect(list).toHaveCSS('list-style-type', 'none');
    expect(await list.evaluate((element) => element.previousElementSibling?.textContent)).toBe('You submitted:');
    const headingBounds = await uploadSubmittedPage.receiptHeading.boundingBox();
    const listBounds = await list.boundingBox();
    expect(headingBounds).not.toBeNull();
    expect(listBounds).not.toBeNull();
    expect(listBounds!.y).toBeGreaterThan(headingBounds!.y + headingBounds!.height);
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
    const requests = collectUploadRequests(uploadPage.page);
    await page.reload();
    await uploadSubmittedPage.waitForConfirmation();
    await expect(page).toHaveURL(confirmationUrl);
    await expect(uploadSubmittedPage.submittedFiles).toHaveText(pairs(submittedNames));
    expect(requests).toHaveLength(0);
  });

  test('revisiting the finished form redirects to the same confirmation', async ({ uploadSubmittedPage, page }) => {
    const confirmationUrl = page.url();
    const formUrl = confirmationUrl.replace(/\/submitted$/, '');
    await page.goto(formUrl);
    await uploadSubmittedPage.waitForConfirmation();
    await expect(page).toHaveURL(confirmationUrl);
    await expect(uploadSubmittedPage.submittedFiles).toHaveText(pairs(submittedNames));
  });

  test('switches the completed receipt EN/FR/EN using the same session and flow without reuploads', async ({ uploadSubmittedPage, page }) => {
    const confirmationUrl = page.url();
    const flowId = new URL(confirmationUrl).pathname.split('/').at(-2);
    const requests = collectUploadRequests(page);
    await page.getByRole('link', { name: 'Français', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/fr/protege/documents/televerser/${flowId}/soumis$`));
    await expect(page.getByRole('heading', { name: receiptCopy.fr.heading, exact: true })).toBeVisible();
    await expect(uploadSubmittedPage.main.getByText(receiptCopy.fr.paragraph, { exact: true })).toBeVisible();
    await expect(uploadSubmittedPage.submittedFiles).toHaveText(pairs(submittedNames, 'fr'));
    await expect(page).toHaveTitle(/^Vos documents sont soumis/);
    await page.reload();
    await expect(uploadSubmittedPage.submittedFiles).toHaveText(pairs(submittedNames, 'fr'));
    await page.getByRole('link', { name: 'English', exact: true }).click();
    await uploadSubmittedPage.waitForConfirmation();
    await expect(page).toHaveURL(confirmationUrl);
    await expect(uploadSubmittedPage.submittedFiles).toHaveText(pairs(submittedNames));
    expect(requests).toHaveLength(0);
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

  test('partial upload confirms only successful files after explicit completion', async ({ uploadPage, submittedPage }) => {
    await uploadPage.partialUpload();
    await uploadPage.removeFile(uploadFailureName);
    await uploadPage.finishButton.click();
    await submittedPage.waitForConfirmation();
    await expect(submittedPage.submittedFiles).toHaveText([`evidence.txt, (${receiptCopy.en.types[0]})`]);
    await expect(submittedPage.main.getByText(uploadFailureName, { exact: true })).toHaveCount(0);
  });

  test('repeated retries retain earlier successes exactly once and finish excludes removed failures', async ({ uploadPage, submittedPage }) => {
    const { page } = uploadPage;
    await uploadPage.addFile(documentFile(uploadFailureName));
    await uploadPage.chooseType(uploadFailureName, 'Other');
    await uploadPage.addFile(documentFile('earlier-success.txt'));
    await uploadPage.chooseType('earlier-success.txt', receiptCopy.en.types[0]);
    await uploadPage.submit();
    await uploadPage.expectUploadCounts(1, 1);

    // Await each response before opening another review of the same failed file.
    await [1, 2].reduce(async (previous) => {
      await previous;
      await expect(uploadPage.submitButton).toBeEnabled();
      const response = page.waitForResponse((value) => value.request().method() === 'POST' && value.url().includes('/documents/upload/'));
      await uploadPage.submit();
      expect((await response).status()).toBe(400);
      await expect(uploadPage.reviewDialog).not.toBeVisible();
      await uploadPage.expectUploadCounts(1, 1);
    }, Promise.resolve());

    await uploadPage.addFile(documentFile('later-success.txt'));
    await uploadPage.chooseType('later-success.txt', receiptCopy.en.types[1]);
    await uploadPage.submit();
    await uploadPage.expectUploadCounts(2, 1);
    await expect(uploadPage.submitButton).toBeEnabled();
    expect((await readUploadSubmissions(page)).map(({ fileNames }) => fileNames)).toEqual([[uploadFailureName, 'earlier-success.txt'], [uploadFailureName], [uploadFailureName], [uploadFailureName, 'later-success.txt']]);
    await uploadPage.removeFile(uploadFailureName);
    await uploadPage.finishButton.click();
    await submittedPage.waitForConfirmation();
    const expectedPairs = pairs(['earlier-success.txt', 'later-success.txt']);
    await expect(submittedPage.submittedFiles).toHaveText(expectedPairs);
    await expect(submittedPage.main).not.toContainText(uploadFailureName);
    await page.reload();
    await expect(submittedPage.submittedFiles).toHaveText(expectedPairs);
  });

  test('keeps distinct document IDs with the same filename and different contents/types', async ({ uploadPage, submittedPage }) => {
    const name = 'same-name.txt';
    await uploadPage.addFile(documentFile(name, 'First distinct evidence'));
    await uploadPage.chooseType(name, receiptCopy.en.types[0]);
    // The filename-based helper intentionally requires a unique name. Use the
    // native picker and scoped selectors for two legitimate same-name records.
    const picker = uploadPage.page.waitForEvent('filechooser');
    await uploadPage.uploadButton.click();
    await (await picker).setFiles(documentFile(name, 'Second distinct evidence'));
    await expect(uploadPage.item(name)).toHaveCount(2);
    await uploadPage.item(name).nth(1).getByRole('combobox', { name: 'Document Type', exact: true }).selectOption({ label: receiptCopy.en.types[1] });
    await uploadPage.submit();
    await submittedPage.waitForConfirmation();
    await expect(submittedPage.submittedFiles).toHaveText(pairs([name, name]));
    await uploadPage.page.reload();
    await expect(submittedPage.submittedFiles).toHaveText(pairs([name, name]));
  });
});

test.describe('localized receipt layout', () => {
  for (const locale of ['en', 'fr'] as const) {
    for (const width of [320, 1280]) {
      test(`${locale} exact pairs wrap without clipping or overlap at ${width}px`, async ({ uploadPage }) => {
        const { page } = uploadPage;
        await page.setViewportSize({ width, height: 900 });
        // Browser multipart payloads do not depend on filesystem filename limits.
        // Both unbroken names remain below 255 characters including extensions.
        const names = [`${'a'.repeat(240)}.txt`, `${'b'.repeat(240)}.txt`];
        await submitLocalizedFiles(page, locale, names);
        const main = page.getByRole('main');
        const list = main.locator('ol');
        const items = list.getByRole('listitem');
        await expect(items).toHaveText(pairs(names, locale));
        await expect(list).toHaveAttribute('role', 'list');
        await expect(list.locator('li > *')).toHaveCount(0);
        await expectUnclippedPairs(items, width);
        const geometry = await list.evaluate((element) => ({
          clientWidth: element.clientWidth,
          scrollWidth: element.scrollWidth,
          clientHeight: element.clientHeight,
          scrollHeight: element.scrollHeight,
          bottom: element.getBoundingClientRect().bottom,
          pageWidth: document.documentElement.scrollWidth,
        }));
        expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
        expect(geometry.scrollHeight).toBeLessThanOrEqual(geometry.clientHeight + 1);
        expect(geometry.pageWidth).toBeLessThanOrEqual(width);
        const nextSteps = await main.getByRole('heading', { name: receiptCopy[locale].nextSteps, exact: true }).boundingBox();
        expect(nextSteps).not.toBeNull();
        expect(nextSteps!.y).toBeGreaterThanOrEqual(geometry.bottom);
      });
    }
  }
});
