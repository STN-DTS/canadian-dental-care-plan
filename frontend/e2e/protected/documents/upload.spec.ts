/**
 * Browser E2E coverage for document upload user journeys.
 *
 * Exercises selection, client validation, submission, partial recovery,
 * confirmation, focus, and navigation through the rendered application.
 * Assertions primarily verify visible UI state and URLs; payload captures also
 * verify pending-only retries and metadata-only completion.
 *
 * Uses an isolated UploadPage fixture and the configured backend mocks.
 * Server validation of crafted HTTP payloads belongs in upload-contract.spec.ts.
 */
import { expect, test } from '../../fixtures/document-upload';
import {
  collectUploadRequests,
  uploadEntryUrl as entryUrl,
  uploadFailureName as failureName,
  documentFile as file,
  uploadFlowUrl as flowUrl,
  navigateUploadRouter,
  readUploadSubmissions,
  useUploadDateFixture,
  waitForUploadRouter,
} from '../../utils/document-upload';

const maxBytes = 5 * 1024 * 1024;

for (const locale of ['en', 'fr'] as const) {
  for (const timeZone of ['America/Toronto', 'America/Vancouver', 'America/Regina']) {
    test.describe(`uploaded date ${locale} in ${timeZone}`, () => {
      test.use({ uploadLocale: locale, timezoneId: timeZone });
      const timestamps = timeZone === 'America/Vancouver' ? ['2026-03-08T09:59:00Z', '2026-03-08T10:00:00Z', '2026-11-01T08:30:00Z', '2026-11-01T09:30:00Z'] : ['2026-03-08T06:59:00Z', '2026-03-08T07:00:00Z', '2026-11-01T05:30:00Z', '2026-11-01T06:30:00Z'];

      for (const timestamp of timestamps) {
        test(`shows full inline date and matching tooltip for ${timestamp}`, async ({ uploadPage }) => {
          await useUploadDateFixture(uploadPage.page, timestamp);
          await uploadPage.partialUpload();
          const item = uploadPage.item('evidence.txt');
          const time = item.locator('time');
          const expected = await uploadPage.page.evaluate(
            ({ timestamp, locale, timeZone }) =>
              Temporal.Instant.from(timestamp).toZonedDateTimeISO(timeZone).toLocaleString(`${locale}-CA`, {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                timeZoneName: 'short',
              }),
            { timestamp, locale, timeZone },
          );
          await expect(time).toHaveAttribute('datetime', timestamp);
          await expect(time).toHaveText(expected);
          expect(await item.getByRole('term').nth(2).textContent()).toBe(`${uploadPage.copy.uploadedOn} `);
          await expect(time.locator('..')).toHaveAttribute('aria-label', expected);
          await time.hover();
          await expect(uploadPage.page.getByRole('tooltip')).toHaveText(expected);
          await expect(uploadPage.pendingFiles.locator('time')).toHaveCount(0);
        });
      }
    });
  }
}

test.describe('access and lifecycle', () => {
  test('eligible applicant starts a new empty UUID-keyed flow', async ({ uploadPage }) => {
    const { page } = uploadPage;
    await expect(page.getByRole('status')).toHaveText('Files selected: 0');
    await expect(page.getByRole('combobox')).toHaveCount(0);
    const firstFlow = page.url();
    await uploadPage.goto();
    expect(page.url()).not.toBe(firstFlow);
  });

  for (const id of ['invalid-id', '00000000-0000-4000-8000-000000000000']) {
    test(`redirects unavailable flow ${id} to the documents list`, async ({ uploadPage }) => {
      const { page } = uploadPage;
      await page.goto(`${entryUrl}/${id}`);
      await expect(page).toHaveURL('/en/protected/documents');
    });
  }

  test('initialized flow cannot open confirmation', async ({ uploadPage }) => {
    const { page } = uploadPage;
    await page.goto(`${page.url()}/submitted`);
    await expect(page).toHaveURL('/en/protected/documents');
  });

  test('partial flow cannot open confirmation', async ({ uploadPage }) => {
    const { page } = uploadPage;
    await uploadPage.partialUpload();
    page.on('dialog', async (dialog) => await dialog.accept());
    await page.goto(`${page.url()}/submitted`);
    await expect(page).toHaveURL('/en/protected/documents');
  });

  test('finished confirmation persists on refresh and form revisit', async ({ uploadPage, submittedPage }) => {
    const { page } = uploadPage;
    const originalForm = page.url();
    await uploadPage.addFile();
    await uploadPage.chooseType('evidence.txt');
    await uploadPage.submit();
    await submittedPage.confirmation(['evidence.txt']);
    await page.reload();
    await submittedPage.confirmation(['evidence.txt']);
    await page.goto(originalForm);
    await submittedPage.confirmation(['evidence.txt']);
  });
});

test.describe('selection and editing', () => {
  test('adds a pending file with an empty type and focuses it', async ({ uploadPage }) => {
    const { page } = uploadPage;
    await uploadPage.addFile();
    await expect(uploadPage.item('evidence.txt')).toBeFocused();
    await expect(uploadPage.item('evidence.txt').getByRole('combobox')).toHaveValue('');
    await expect(page.getByRole('status')).toHaveText('Files selected: 1');
  });

  test('appends files and updates only the selected document type', async ({ uploadPage }) => {
    await uploadPage.addFile();
    await uploadPage.chooseType('evidence.txt');
    const originalType = await uploadPage.item('evidence.txt').getByRole('combobox').inputValue();
    await uploadPage.addFile(file('letter.txt'));
    await expect(uploadPage.item('evidence.txt').getByRole('combobox')).toHaveValue(originalType);
    await expect(uploadPage.item('letter.txt').getByRole('combobox')).toHaveValue('');
    await uploadPage.chooseType('letter.txt', 2);
    await expect(uploadPage.item('evidence.txt').getByRole('combobox')).toHaveValue(originalType);
  });

  test('cancelling the file picker preserves selection', async ({ uploadPage }) => {
    const { page } = uploadPage;
    await uploadPage.addFile();
    const picker = page.waitForEvent('filechooser');
    await uploadPage.uploadButton.click();
    await (await picker).setFiles([]);
    await expect(uploadPage.item('evidence.txt')).toBeVisible();
    await expect(page.getByRole('status')).toHaveText('Files selected: 1');
  });

  for (const scenario of [
    { name: 'unsupported extension', payload: file('evidence.exe'), error: /You can't upload this file format\. Choose a file in one of these formats:/ },
    { name: 'oversized file', payload: { ...file('oversized.txt'), buffer: Buffer.alloc(maxBytes + 1, 'a') }, error: 'The file is too large to upload. Make sure the file size is less than 5 MB.' },
    { name: 'duplicate file', payload: file(), error: 'The file "evidence.txt" is already selected or uploaded. You must choose a different file.' },
  ]) {
    test(`rejects ${scenario.name} without changing existing selection`, async ({ uploadPage }) => {
      const { page } = uploadPage;
      await uploadPage.addFile();
      await uploadPage.chooseType('evidence.txt');
      const requests = collectUploadRequests(uploadPage.page);
      const picker = page.waitForEvent('filechooser');
      await uploadPage.uploadButton.click();
      await (await picker).setFiles(scenario.payload);
      await expect(page.getByText(scenario.error).first()).toBeVisible();
      await expect(page.getByRole('status')).toHaveText('Files selected: 1');
      await expect(uploadPage.item('evidence.txt').getByRole('combobox')).not.toHaveValue('');
      expect(requests).toHaveLength(0);
    });
  }

  test('accepts a file exactly at the size limit', async ({ uploadPage }) => {
    const { page } = uploadPage;
    await uploadPage.addFile({ ...file('limit.txt'), buffer: Buffer.alloc(maxBytes, 'a') });
    await expect(page.getByRole('status')).toHaveText('Files selected: 1');
  });

  for (const scenario of [
    { name: 'same content under different filenames', second: file('other.txt') },
    { name: 'same filename with different same-sized contents', second: file('evidence.txt', 'Different evidence!!') },
  ]) {
    test(`does not treat ${scenario.name} as duplicates`, async ({ uploadPage }) => {
      const { page } = uploadPage;
      await uploadPage.addFile();
      const picker = page.waitForEvent('filechooser');
      await uploadPage.uploadButton.click();
      await (await picker).setFiles(scenario.second);
      await expect(page.getByRole('combobox')).toHaveCount(2);
      await expect(page.getByRole('status')).toHaveText('Files selected: 2');
    });
  }

  test('rejects an eleventh file and keeps the ten selected files', async ({ uploadPage }) => {
    const { page } = uploadPage;
    await uploadPage.addFiles(Array.from({ length: 10 }, (_, index) => file(`evidence-${index}.txt`)));
    const picker = page.waitForEvent('filechooser');
    await uploadPage.uploadButton.click();
    await (await picker).setFiles(file('eleventh.txt'));
    await expect(page.getByText('You can upload up to 10 files at a time. Submit before uploading more.').first()).toBeVisible();
    await expect(page.getByRole('status')).toHaveText('Files selected: 10');
    await expect(uploadPage.item('eleventh.txt')).toHaveCount(0);
  });

  for (const dismiss of ['Keep file', 'Escape', 'Close']) {
    test(`${dismiss} cancels removal and restores focus`, async ({ uploadPage }) => {
      await uploadPage.addFile();
      const trigger = uploadPage.item('evidence.txt').getByRole('button', { name: 'Remove file', exact: true });
      await trigger.click();
      const dialog = uploadPage.removeDialog;

      if (dismiss === 'Escape') {
        await dialog.press('Escape');
      } else {
        await dialog.getByRole('button', { name: dismiss, exact: true }).click();
      }

      await expect(dialog).not.toBeVisible();
      await expect(uploadPage.item('evidence.txt')).toBeVisible();
      await expect(trigger).toBeFocused();
    });
  }

  test('confirmed removal focuses the next then preceding file then trigger', async ({ uploadPage }) => {
    const { page } = uploadPage;
    await uploadPage.addFiles(['first.txt', 'middle.txt', 'last.txt'].map((name) => file(name)));
    await uploadPage.removeFile('middle.txt');
    await expect(uploadPage.item('last.txt')).toBeFocused();
    await uploadPage.removeFile('last.txt');
    await expect(uploadPage.item('first.txt')).toBeFocused();
    await uploadPage.removeFile('first.txt');
    await expect(uploadPage.uploadButton).toBeFocused();
    await expect(page.getByRole('status')).toHaveText('Files selected: 0');
  });
});

test.describe('validation, scanning and uploading', () => {
  test('empty submission is blocked without a server POST', async ({ uploadPage }) => {
    const { page } = uploadPage;
    const requests = collectUploadRequests(uploadPage.page);
    await uploadPage.openReview();
    await expect(page.getByText('You must upload a file before clicking', { exact: false }).first()).toBeVisible();
    await expect(uploadPage.reviewDialog).not.toBeVisible();
    expect(requests).toHaveLength(0);
  });

  test('missing type produces a file-specific error without a server POST', async ({ uploadPage }) => {
    await uploadPage.addFile();
    const requests = collectUploadRequests(uploadPage.page);
    await uploadPage.openReview();
    await expect(uploadPage.item('evidence.txt')).toContainText('Select a document type for file');
    await expect(uploadPage.reviewDialog).not.toBeVisible();
    expect(requests).toHaveLength(0);
  });

  test('disables mutation controls while the upload response is pending', async ({ uploadPage, submittedPage }) => {
    const requests = collectUploadRequests(uploadPage.page);
    await uploadPage.addFile();
    await uploadPage.chooseType('evidence.txt');
    let release!: () => void;
    const pendingResponse = new Promise<void>((resolve) => {
      release = resolve;
    });
    await uploadPage.page.route('**/documents/upload/**', async (route) => {
      if (route.request().method() !== 'POST') {
        return await route.continue();
      }

      await pendingResponse;
      await route.continue();
    });

    try {
      await uploadPage.submit();
      // The modal hides background controls from the accessibility tree while uploading.
      await expect(uploadPage.page.locator('#fileUploadTrigger')).toBeDisabled();
      await expect(uploadPage.page.locator('select')).toBeDisabled();
      await expect(uploadPage.page.locator('[data-slot="file-upload-item"] button')).toBeDisabled();
      await expect(uploadPage.page.locator('#submit-button')).toBeDisabled();
      await expect(uploadPage.reviewDialog).toHaveAttribute('aria-busy', 'true');
      await expect(uploadPage.reviewDialog.getByRole('button', { name: 'Back', exact: true })).toBeDisabled();
      const confirm = uploadPage.reviewDialog.getByRole('button', { name: 'Submit', exact: true });
      await expect(confirm).toBeDisabled();
      await expect(confirm.locator('[data-icon="spinner"]')).toBeVisible();
      await expect(uploadPage.reviewDialog.getByRole('button', { name: 'Close', exact: true })).toHaveCount(0);
      await confirm.dispatchEvent('click');
      await uploadPage.page.keyboard.press('Escape');
      await uploadPage.page.mouse.click(0, 0);
      await expect(uploadPage.reviewDialog).toBeVisible();
      expect(requests).toHaveLength(1);
    } finally {
      release();
    }

    await submittedPage.confirmation(['evidence.txt']);
    expect(requests).toHaveLength(1);
  });

  test('all successful files redirect to confirmation in selection order', async ({ uploadPage, submittedPage }) => {
    await uploadPage.addFile(file('first.txt'));
    await uploadPage.chooseType('first.txt');
    await uploadPage.addFile(file('second.txt'));
    await uploadPage.chooseType('second.txt');
    await uploadPage.submit();
    await submittedPage.confirmation(['first.txt', 'second.txt']);
  });

  test('cancelling review preserves the selection and allows a confirmed retry', async ({ uploadPage, submittedPage }) => {
    const requests = collectUploadRequests(uploadPage.page);
    await uploadPage.addFile();
    await uploadPage.chooseType('evidence.txt');
    await uploadPage.openReview();
    await expect(uploadPage.reviewDialog).toBeVisible();
    await uploadPage.dismissReview();
    await expect(uploadPage.reviewDialog).not.toBeVisible();
    await expect(uploadPage.item('evidence.txt')).toBeVisible();
    expect(requests).toHaveLength(0);

    await uploadPage.submit();
    await submittedPage.confirmation(['evidence.txt']);
    expect(requests).toHaveLength(1);
  });

  test('scan rejection preserves successful uploads from the same batch', async ({ uploadPage, submittedPage }) => {
    const { page } = uploadPage;
    await uploadPage.addFile();
    await uploadPage.chooseType('evidence.txt');
    await uploadPage.addFile(file('scan-test.txt', 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*'));
    await uploadPage.chooseType('scan-test.txt');
    await uploadPage.submit();
    await expect(uploadPage.item('scan-test.txt')).toContainText('The file "scan-test.txt" does not pass our security checks. You must choose a different file.');
    await expect(uploadPage.item('evidence.txt')).toContainText('Uploaded successfully');
    await expect(page).toHaveURL(flowUrl);
    await expect(page.getByRole('combobox')).toHaveCount(1);
    await uploadPage.removeFile('scan-test.txt');
    await uploadPage.finishButton.click();
    await submittedPage.confirmation(['evidence.txt']);
  });

  for (const scenario of [
    { name: 'undetectable non-text content', payload: file('unrecognized.pdf', 'Not a PDF', 'application/pdf') },
    { name: 'detected disallowed content', payload: file('disallowed.txt', 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR', 'text/plain') },
  ]) {
    test(`rejects ${scenario.name} before upload`, async ({ uploadPage }) => {
      const { page } = uploadPage;
      await uploadPage.addFile(scenario.payload);
      await uploadPage.chooseType(scenario.payload.name);
      await uploadPage.submit();
      await expect(uploadPage.item(scenario.payload.name)).toContainText(`You can't upload this file format for "${scenario.payload.name}". Choose a file in one of these formats:`);
      await expect(page).toHaveURL(flowUrl);
    });
  }

  test('every failed upload remains pending and can be retried', async ({ uploadPage }) => {
    const { page } = uploadPage;
    await uploadPage.addFile(file(failureName));
    await uploadPage.chooseType(failureName);
    await uploadPage.submit();
    await expect(uploadPage.item(failureName)).toContainText('An unexpected error occurred while uploading file "mock-upload-failure.txt". Try to upload your file again.');
    await expect(page.getByRole('combobox')).toHaveCount(1);
    await uploadPage.expectUploadCounts(0, 1);
    await expect(uploadPage.uploadedFiles).toHaveCount(0);
    await expect(uploadPage.pendingFiles.getByRole('listitem')).toHaveCount(1);
    const response = page.waitForResponse((value) => value.request().method() === 'POST' && value.url().includes('/documents/upload/'));
    await uploadPage.submit();
    expect((await response).status()).toBe(400);
    await expect(uploadPage.item(failureName)).toContainText('An unexpected error occurred while uploading file "mock-upload-failure.txt". Try to upload your file again.');
    await uploadPage.expectUploadCounts(0, 1);
  });

  test('outcome counters persist after removing all failed files and selecting a new file', async ({ uploadPage }) => {
    await uploadPage.addFile(file(failureName));
    await uploadPage.chooseType(failureName);
    await uploadPage.submit();
    await uploadPage.expectUploadCounts(0, 1);
    await uploadPage.removeFile(failureName);
    await uploadPage.expectUploadCounts(0, 0);
    await expect(uploadPage.uploadedFiles).toHaveCount(0);
    await expect(uploadPage.pendingFiles).toHaveCount(0);
    await uploadPage.addFile(file('replacement.txt'));
    await uploadPage.expectUploadCounts(0, 1);
    await expect(uploadPage.item('replacement.txt').getByRole('combobox')).toHaveValue('');
  });

  test('truncated image content rejects every upload in the batch', async ({ uploadPage }) => {
    await uploadPage.addFile();
    await uploadPage.chooseType('evidence.txt');
    await uploadPage.addFile({ ...file('truncated.png', '', 'image/png'), buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]) });
    await uploadPage.chooseType('truncated.png');
    await uploadPage.submit();
    await expect(uploadPage.item('truncated.png')).toContainText('You can\'t upload this file format for "truncated.png". Choose a file in one of these formats:');
    await expect(uploadPage.page.getByText('Uploaded successfully', { exact: true })).toHaveCount(0);
    await expect(uploadPage.page.getByRole('combobox')).toHaveCount(2);
  });
});

for (const locale of ['en', 'fr'] as const) {
  for (const width of [375, 1280]) {
    test.describe(`localized submission review ${locale} at ${width}px`, () => {
      test.use({ uploadLocale: locale, viewport: { width, height: 900 } });

      test('wraps validation errors for long pending filenames without viewport overflow', async ({ uploadPage }) => {
        const { page } = uploadPage;
        const name = `employer-${'a'.repeat(180)}.txt`;
        await uploadPage.addFile(file(name, 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*'));
        await uploadPage.chooseType(name);
        await uploadPage.submit();
        await expect(uploadPage.item(name).getByRole('alert')).toContainText(name);
        await expect(uploadPage.pendingFiles.getByRole('listitem')).toHaveCount(1);
        await expect.poll(async () => await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      });

      test('validates before review, preserves edits on cancellation, and focuses returned file errors', async ({ uploadPage }) => {
        const { page, copy } = uploadPage;
        const requests = collectUploadRequests(page);
        const name = `employer-${'a'.repeat(180)}.txt`;
        await uploadPage.addFile(file(name));
        await uploadPage.openReview();
        await expect(uploadPage.reviewDialog).not.toBeVisible();
        const summary = page.locator('[data-error-summary-id]');
        await expect(summary).toBeFocused();
        const select = uploadPage.item(name).getByRole('combobox', { name: copy.type });
        await expect(select).toHaveAttribute('aria-invalid', 'true');
        const descriptionIds = (await select.getAttribute('aria-errormessage'))?.split(' ') ?? [];
        expect(descriptionIds.length).toBeGreaterThan(0);
        await Promise.all(descriptionIds.map(async (id) => await expect(page.locator(`[id="${id}"]`)).toHaveCount(1)));
        expect(requests).toHaveLength(0);
        await uploadPage.chooseType(name);
        await uploadPage.addFile(file(failureName));
        await uploadPage.chooseType(failureName);

        await ['back', 'close', 'escape'].reduce(async (previous, dismissal) => {
          await previous;
          const type = await select.locator('option:checked').innerText();
          await uploadPage.openReview();
          const back = uploadPage.reviewDialog.getByRole('button', { name: copy.back, exact: true });
          await expect(back).toBeFocused();
          await expect(uploadPage.reviewDialog.getByRole('listitem').first()).toHaveText(`${name}, ${type}`);
          expect(requests).toHaveLength(0);
          await expect(back).toHaveClass(/text-sm/);
          const overflow = await uploadPage.reviewDialog.evaluate((dialog) => dialog.scrollWidth > dialog.clientWidth);
          expect(overflow).toBe(false);

          if (dismissal === 'back') {
            await uploadPage.dismissReview();
          } else if (dismissal === 'close') {
            await uploadPage.reviewDialog.getByRole('button', { name: locale === 'en' ? 'Close' : 'Fermer', exact: true }).click();
          } else {
            await page.keyboard.press('Escape');
          }

          await expect(uploadPage.reviewDialog).not.toBeVisible();
          await expect(uploadPage.submitButton).toBeFocused();
          expect(requests).toHaveLength(0);
          await expect(select).not.toHaveValue('');
          await uploadPage.chooseType(name, 2);
        }, Promise.resolve());

        await uploadPage.submit();
        await uploadPage.expectUploadCounts(1, 1);
        await expect.poll(async () => await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        await expect(summary).toBeFocused();
        await expect(summary.getByRole('heading')).toContainText(locale === 'fr' ? /erreur/i : /error/i);
        await expect(uploadPage.reviewDialog).not.toBeVisible();
        await summary.getByRole('link').filter({ hasText: copy.failure }).click();
        await expect(uploadPage.item(failureName)).toBeFocused();
        await expect(uploadPage.item(failureName).getByRole('alert')).toHaveText(copy.failure);
        await expect(uploadPage.item(failureName).getByRole('combobox')).not.toHaveValue('');
        expect(requests).toHaveLength(1);
        await uploadPage.openReview();
        await expect(uploadPage.reviewDialog.getByRole('listitem')).toHaveCount(1);
        await expect(uploadPage.reviewDialog).not.toContainText(name);
        await uploadPage.dismissReview();
        expect(requests).toHaveLength(1);
      });
    });
  }
}

test.describe('partial recovery and explicit completion', () => {
  test('groups interleaved results success-first with local positions and retries failures in original order', async ({ uploadPage }) => {
    const { page } = uploadPage;
    const selectedFiles = [file(failureName), file('first-success.txt'), file('scan-test.txt', 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*'), file('second-success.txt')];
    await selectedFiles.reduce(async (previous, payload) => {
      await previous;
      await uploadPage.addFile(payload);
      await uploadPage.chooseType(payload.name);
    }, Promise.resolve());

    const documentType = await uploadPage.item('first-success.txt').locator('option:checked').innerText();
    await expect(uploadPage.status).toHaveText('Files selected: 4');
    await uploadPage.submit();
    await uploadPage.expectUploadCounts(2, 2);
    await expect(uploadPage.item(failureName)).toContainText('An unexpected error occurred while uploading file');
    await expect(uploadPage.item('scan-test.txt')).toContainText('does not pass our security checks');

    const groups = [
      { list: uploadPage.uploadedFiles, id: 'uploaded-files-list', heading: 'Files uploaded successfully', names: ['first-success.txt', 'second-success.txt'], uploaded: true },
      { list: uploadPage.pendingFiles, id: 'pending-files-list', heading: 'Files not uploaded', names: [failureName, 'scan-test.txt'], uploaded: false },
    ];
    await Promise.all(
      groups.map(async ({ list, id, heading, names, uploaded }) => {
        const label = page.getByRole('heading', { name: heading, exact: true });
        await Promise.all([
          expect(label).toBeVisible(),
          expect(label).toHaveAttribute('id', /.+/),
          expect(list).toHaveAttribute('id', id),
          expect(list.getByRole('listitem')).toHaveCount(names.length),
          ...names.flatMap((name, index) => {
            const item = list.getByRole('listitem').nth(index);
            return [expect(item.getByText(name, { exact: true })).toBeVisible(), expect(item).toHaveAccessibleName(uploaded ? '' : name)];
          }),
        ]);
        await expect(list).toHaveAttribute('aria-labelledby', (await label.getAttribute('id')) ?? '');
      }),
    );

    // Assert DOM order across both lists, not only the order within each group.
    const items = page.locator('[data-slot="file-upload-item"]');
    const expectedOrder = ['first-success.txt', 'second-success.txt', failureName, 'scan-test.txt'];
    await expect(items).toHaveCount(expectedOrder.length);
    await Promise.all(expectedOrder.flatMap((name, index) => [expect(items.nth(index).getByText(name, { exact: true })).toBeVisible(), expect(items.nth(index)).toHaveAccessibleName(index < 2 ? '' : name)]));
    await Promise.all(['first-success.txt', 'second-success.txt'].flatMap((name) => [expect(uploadPage.item(name)).toContainText('Uploaded successfully'), expect(uploadPage.item(name)).toContainText(documentType)]));
    await expect(uploadPage.uploadedFiles.getByRole('combobox')).toHaveCount(0);
    await expect(uploadPage.uploadedFiles.getByRole('button')).toHaveCount(0);
    await expect(uploadPage.uploadedFiles.locator('time')).toHaveCount(2);
    const originalUploadDates = await uploadPage.uploadedFiles.locator('time').evaluateAll((times) => times.map((time) => time.getAttribute('datetime')));
    await expect(uploadPage.pendingFiles.locator('time')).toHaveCount(0);
    await expect(uploadPage.pendingFiles.getByRole('combobox')).toHaveCount(2);
    await expect(uploadPage.pendingFiles.getByRole('button', { name: 'Remove file', exact: true })).toHaveCount(2);

    const response = page.waitForResponse((value) => value.request().method() === 'POST' && value.url().includes('/documents/upload/'));
    await uploadPage.submit();
    expect((await response).status()).toBe(400);
    await expect(uploadPage.reviewDialog).not.toBeVisible();
    await uploadPage.expectUploadCounts(2, 2);
    expect(await uploadPage.uploadedFiles.locator('time').evaluateAll((times) => times.map((time) => time.getAttribute('datetime')))).toEqual(originalUploadDates);
    expect((await readUploadSubmissions(page)).map(({ fileNames }) => fileNames)).toEqual([selectedFiles.map(({ name }) => name), [failureName, 'scan-test.txt']]);
    await Promise.all(expectedOrder.flatMap((name, index) => [expect(items.nth(index).getByText(name, { exact: true })).toBeVisible(), expect(items.nth(index)).toHaveAccessibleName(index < 2 ? '' : name)]));
  });

  for (const viewport of [
    { width: 1280, height: 900 },
    { width: 375, height: 812 },
  ]) {
    test(`preserves successful files without editing or removal controls at ${viewport.width}px`, async ({ uploadPage }, testInfo) => {
      const { page } = uploadPage;
      await page.setViewportSize(viewport);
      await uploadPage.partialUpload();
      const item = uploadPage.item('evidence.txt');
      const time = item.locator('time');
      await expect(item.getByRole('combobox')).toHaveCount(0);
      await expect(item.getByRole('button')).toHaveCount(0);
      await expect(item).toContainText('Uploaded on:');
      await expect(time).toHaveAttribute('datetime', /^\d{4}-\d{2}-\d{2}T.+Z$/);
      const dateText = await time.innerText();
      await expect(time.locator('..')).toHaveAttribute('aria-label', dateText);
      await time.hover();
      await expect(page.getByRole('tooltip')).toHaveText(dateText);
      await page.mouse.move(0, 0);
      const overflowingText = await item.evaluate((row) => {
        const bounds = row.getBoundingClientRect();
        return [...row.querySelectorAll('dd')]
          .filter((definition) => getComputedStyle(definition.parentElement!).position !== 'absolute')
          .some((definition) => {
            const range = document.createRange();
            range.selectNodeContents(definition);
            return [...range.getClientRects()].some((rect) => rect.left < bounds.left || rect.right > bounds.right);
          });
      });
      expect(overflowingText).toBe(false);
      await page.screenshot({ path: testInfo.outputPath('uploaded-document-row.png'), fullPage: true });
      await uploadPage.expectUploadCounts(1, 1);
      await expect(item.or(uploadPage.item(failureName))).toHaveCount(2);
    });
  }

  test('retry submits pending files only and retains earlier success', async ({ uploadPage }) => {
    const { page } = uploadPage;
    await uploadPage.partialUpload();
    const response = page.waitForResponse((value) => value.request().method() === 'POST' && value.url().includes('/documents/upload/'));
    await uploadPage.submit();
    await response;
    expect((await readUploadSubmissions(uploadPage.page)).at(-1)?.fileNames).toEqual([failureName]);
    await expect(uploadPage.item(failureName)).toContainText('An unexpected error occurred while uploading file "mock-upload-failure.txt". Try to upload your file again.');
    await expect(uploadPage.item('evidence.txt')).toContainText('Uploaded successfully');
  });

  test('rejects duplicates of already-uploaded files', async ({ uploadPage }) => {
    const { page } = uploadPage;
    await uploadPage.partialUpload();
    const picker = page.waitForEvent('filechooser');
    await uploadPage.uploadButton.click();
    await (await picker).setFiles(file());
    await expect(page.getByText('The file "evidence.txt" is already selected or uploaded. You must choose a different file.').first()).toBeVisible();
    await uploadPage.expectUploadCounts(1, 1);
  });

  test('adds and uploads new files after removing a failed file', async ({ uploadPage, submittedPage }) => {
    const { page } = uploadPage;
    await uploadPage.partialUpload();
    await uploadPage.removeFile(failureName);
    await uploadPage.addFile(file('replacement.txt'));
    await uploadPage.expectUploadCounts(1, 1);
    await uploadPage.chooseType('replacement.txt', 2);
    await uploadPage.submit();
    await submittedPage.confirmation(['evidence.txt', 'replacement.txt']);
    await expect(page.getByRole('main').getByText(failureName, { exact: true })).toHaveCount(0);
  });

  test('new files increase only the pending counter after partial success', async ({ uploadPage }) => {
    await uploadPage.partialUpload();
    await uploadPage.addFile(file('additional.txt'));
    await uploadPage.expectUploadCounts(1, 2);
    await expect(uploadPage.uploadedFiles.getByRole('listitem')).toHaveCount(1);
    const pending = uploadPage.pendingFiles.getByRole('listitem');
    await expect(pending).toHaveCount(2);
    await expect(pending.nth(0)).toHaveAccessibleName(failureName);
    await expect(pending.nth(1)).toHaveAccessibleName('additional.txt');
    await uploadPage.removeFile(failureName);
    await uploadPage.expectUploadCounts(1, 1);
    await expect(pending).toHaveCount(1);
    await expect(pending.nth(0)).toHaveAccessibleName('additional.txt');
  });

  test('removing failures requires explicit metadata-only completion', async ({ uploadPage, submittedPage }) => {
    const { page } = uploadPage;
    await uploadPage.partialUpload();
    await uploadPage.removeFile(failureName);
    const region = page.getByRole('region', { name: 'Files uploaded: 1', exact: true });
    await expect(region).toBeFocused();
    await expect(region).toContainText('No files awaiting upload.');
    await expect(page).toHaveURL(flowUrl);
    await uploadPage.finishButton.click();
    await submittedPage.confirmation(['evidence.txt']);
    const submission = (await readUploadSubmissions(uploadPage.page)).at(-1);
    expect(submission?.action).toBe('finish');
    expect(submission?.fieldNames).not.toContain('file_id');
    expect(submission?.fieldNames).not.toContain('file_object');
  });

  test('uploaded files count toward the selection limit', async ({ uploadPage }) => {
    const { page } = uploadPage;
    await uploadPage.partialUpload();
    await uploadPage.addFiles(Array.from({ length: 8 }, (_, index) => file(`extra-${index}.txt`)));
    const picker = page.waitForEvent('filechooser');
    await uploadPage.uploadButton.click();
    await (await picker).setFiles(file('eleventh.txt'));
    await expect(page.getByText('You can upload up to 10 files at a time. Submit before uploading more.').first()).toBeVisible();
    await uploadPage.expectUploadCounts(1, 9);
  });
});

test.describe('navigation and refresh', () => {
  test('query changes are not blocked and revalidate open flow metadata', async ({ uploadPage, uploadApi }) => {
    await uploadPage.partialUpload();
    await uploadPage.removeFile(failureName);
    const response = uploadPage.page.waitForResponse((value) => value.request().method() === 'GET' && value.url().includes('query-test=1'));
    await navigateUploadRouter(uploadPage.page, `${new URL(uploadPage.page.url()).pathname}?query-test=1`);
    await response;
    await expect(uploadPage.page).toHaveURL(/\?query-test=1$/);
    await expect(uploadPage.page.getByRole('dialog')).toHaveCount(0);
    const finish = await uploadApi.post([['_action', 'finish']]);
    expect(finish.status()).toBe(409);
  });

  for (const dismiss of ['Stay on this page', 'Escape', 'Close']) {
    test(`${dismiss} cancels pathname navigation and restores focus`, async ({ uploadPage }) => {
      const { page } = uploadPage;
      await uploadPage.addFile();
      await uploadPage.uploadButton.focus();
      await navigateUploadRouter(uploadPage.page, '/en/protected/documents');
      const dialog = uploadPage.unsavedChangesDialog;
      await expect(dialog).toBeVisible();

      if (dismiss === 'Escape') {
        await dialog.press('Escape');
      } else {
        await dialog.getByRole('button', { name: dismiss, exact: true }).click();
      }

      await expect(dialog).not.toBeVisible();
      await expect(page).toHaveURL(flowUrl);
      await expect(uploadPage.item('evidence.txt')).toBeVisible();
      await expect(uploadPage.uploadButton).toBeFocused();
    });
  }

  test('explicit Leave allows pathname navigation', async ({ uploadPage }) => {
    await uploadPage.addFile();
    await navigateUploadRouter(uploadPage.page, '/en/protected/documents');
    await uploadPage.unsavedChangesDialog.getByRole('button', { name: 'Leave page', exact: true }).click();
    await expect(uploadPage.page).toHaveURL('/en/protected/documents');
    await expect(uploadPage.page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('uploaded-only selection navigates without a client-side warning', async ({ uploadPage }) => {
    await uploadPage.partialUpload();
    await uploadPage.removeFile(failureName);
    await navigateUploadRouter(uploadPage.page, '/en/protected/documents');
    await expect(uploadPage.page).toHaveURL('/en/protected/documents');
    await expect(uploadPage.page.getByRole('dialog')).toHaveCount(0);
  });

  test('refresh resets pending selection to an empty form', async ({ uploadPage }) => {
    const { page } = uploadPage;
    await uploadPage.addFile();
    page.on('dialog', async (dialog) => await dialog.accept());
    await page.reload();
    await uploadPage.isLoaded(flowUrl, 'Submit documents');
    await expect(page.getByRole('status')).toHaveText('Files selected: 0');
    await expect(page.getByRole('combobox')).toHaveCount(0);
  });

  test('refresh clears partial-upload metadata and does not allow confirmation', async ({ uploadPage }) => {
    const { page } = uploadPage;
    await uploadPage.partialUpload();
    page.on('dialog', async (dialog) => await dialog.accept());
    await page.reload();
    await uploadPage.isLoaded(flowUrl, 'Submit documents');
    await expect(page.getByRole('status')).toHaveText('Files selected: 0');
    await page.goto(`${page.url()}/submitted`);
    await expect(page).toHaveURL('/en/protected/documents');
  });

  test('pending files request a native unload warning', async ({ uploadPage }) => {
    const { page } = uploadPage;
    await uploadPage.addFile();
    const dialog = page.waitForEvent('dialog');
    const reload = page.reload();
    const warning = await dialog;
    expect(warning.type()).toBe('beforeunload');
    await warning.accept();
    await reload;
    await uploadPage.isLoaded(flowUrl, 'Submit documents');
  });

  test('empty and uploaded-only forms leave without unload warnings', async ({ uploadPage }) => {
    const { page } = uploadPage;
    const dialogs: string[] = [];
    page.on('dialog', async (dialog) => {
      dialogs.push(dialog.type());
      await dialog.dismiss();
    });
    await page.reload();
    await uploadPage.isLoaded(flowUrl, 'Submit documents');
    await waitForUploadRouter(page);
    await uploadPage.partialUpload();
    await uploadPage.removeFile(failureName);
    await page.goto('/en/protected/documents');
    await expect(page).toHaveURL('/en/protected/documents');
    expect(dialogs).toHaveLength(0);
  });

  test('fragment changes are not blocked and retain pending selection', async ({ uploadPage }) => {
    const { page } = uploadPage;
    await uploadPage.addFile();
    await page.evaluate(() => {
      location.hash = 'wb-cont';
    });
    await expect(page).toHaveURL(/#wb-cont$/);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(uploadPage.item('evidence.txt')).toBeVisible();
  });
});
