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
import { uploadEntryUrl as entryUrl, uploadFailureName as failureName, documentFile as file, uploadFlowUrl as flowUrl } from '../../pages/upload-page';

const maxBytes = 5 * 1024 * 1024;

test.describe('access and lifecycle', () => {
  test('eligible applicant starts a new empty UUID-keyed flow', async ({ uploadPage }) => {
    const { page } = uploadPage;
    await expect(page.getByRole('status')).toHaveText('0 of 10 files selected');
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

  test('finished confirmation persists on refresh and form revisit', async ({ uploadPage }) => {
    const { page } = uploadPage;
    const originalForm = page.url();
    await uploadPage.addFile();
    await uploadPage.chooseType('evidence.txt');
    await uploadPage.submit();
    await uploadPage.confirmation(['evidence.txt']);
    await page.reload();
    await uploadPage.confirmation(['evidence.txt']);
    await page.goto(originalForm);
    await uploadPage.confirmation(['evidence.txt']);
  });
});

test.describe('selection and editing', () => {
  test('adds a pending file with an empty type and focuses it', async ({ uploadPage }) => {
    const { page } = uploadPage;
    await uploadPage.addFile();
    await expect(uploadPage.item('evidence.txt')).toBeFocused();
    await expect(uploadPage.item('evidence.txt').getByRole('combobox')).toHaveValue('');
    await expect(page.getByRole('status')).toHaveText('1 of 10 files selected');
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
    await page.getByRole('button', { name: 'Upload file', exact: true }).click();
    await (await picker).setFiles([]);
    await expect(uploadPage.item('evidence.txt')).toBeVisible();
    await expect(page.getByRole('status')).toHaveText('1 of 10 files selected');
  });

  for (const scenario of [
    { name: 'unsupported extension', payload: file('evidence.exe'), error: /file type you're trying to upload is not supported/ },
    { name: 'oversized file', payload: { ...file('oversized.txt'), buffer: Buffer.alloc(maxBytes + 1, 'a') }, error: /file you are trying to upload is too large/ },
    { name: 'duplicate file', payload: file(), error: /matches a file you've already selected or uploaded/ },
  ]) {
    test(`rejects ${scenario.name} without changing existing selection`, async ({ uploadPage }) => {
      const { page } = uploadPage;
      await uploadPage.addFile();
      await uploadPage.chooseType('evidence.txt');
      const requests = uploadPage.requests();
      const picker = page.waitForEvent('filechooser');
      await page.getByRole('button', { name: 'Upload file', exact: true }).click();
      await (await picker).setFiles(scenario.payload);
      await expect(page.getByText(scenario.error).first()).toBeVisible();
      await expect(page.getByRole('status')).toHaveText('1 of 10 files selected');
      await expect(uploadPage.item('evidence.txt').getByRole('combobox')).not.toHaveValue('');
      expect(requests).toHaveLength(0);
    });
  }

  test('accepts a file exactly at the size limit', async ({ uploadPage }) => {
    const { page } = uploadPage;
    await uploadPage.addFile({ ...file('limit.txt'), buffer: Buffer.alloc(maxBytes, 'a') });
    await expect(page.getByRole('status')).toHaveText('1 of 10 files selected');
  });

  for (const scenario of [
    { name: 'same content under different filenames', second: file('other.txt') },
    { name: 'same filename with different same-sized contents', second: file('evidence.txt', 'Different evidence!!') },
  ]) {
    test(`does not treat ${scenario.name} as duplicates`, async ({ uploadPage }) => {
      const { page } = uploadPage;
      await uploadPage.addFile();
      const picker = page.waitForEvent('filechooser');
      await page.getByRole('button', { name: 'Upload file', exact: true }).click();
      await (await picker).setFiles(scenario.second);
      await expect(page.getByRole('combobox')).toHaveCount(2);
      await expect(page.getByRole('status')).toHaveText('2 of 10 files selected');
    });
  }

  test('rejects an eleventh file and keeps the ten selected files', async ({ uploadPage }) => {
    const { page } = uploadPage;
    await uploadPage.addFiles(Array.from({ length: 10 }, (_, index) => file(`evidence-${index}.txt`)));
    const picker = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Upload file', exact: true }).click();
    await (await picker).setFiles(file('eleventh.txt'));
    await expect(page.getByText(/You can upload up to 10 documents at a time/).first()).toBeVisible();
    await expect(page.getByRole('status')).toHaveText('10 of 10 files selected');
    await expect(uploadPage.item('eleventh.txt')).toHaveCount(0);
  });

  for (const dismiss of ['Keep file', 'Escape', 'Close']) {
    test(`${dismiss} cancels removal and restores focus`, async ({ uploadPage }) => {
      const { page } = uploadPage;
      await uploadPage.addFile();
      const trigger = uploadPage.item('evidence.txt').getByRole('button', { name: 'Remove file', exact: true });
      await trigger.click();
      const dialog = page.getByRole('dialog', { name: 'Remove this file?' });
      if (dismiss === 'Escape') await dialog.press('Escape');
      else await dialog.getByRole('button', { name: dismiss, exact: true }).click();
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
    await expect(page.getByRole('button', { name: 'Upload file', exact: true })).toBeFocused();
    await expect(page.getByRole('status')).toHaveText('0 of 10 files selected');
  });
});

test.describe('validation, scanning and uploading', () => {
  test('empty submission is blocked without a server POST', async ({ uploadPage }) => {
    const { page } = uploadPage;
    const requests = uploadPage.requests();
    await uploadPage.submit();
    await expect(page.getByText('You must upload a file before clicking', { exact: false }).first()).toBeVisible();
    expect(requests).toHaveLength(0);
  });

  test('missing type produces a file-specific error without a server POST', async ({ uploadPage }) => {
    await uploadPage.addFile();
    const requests = uploadPage.requests();
    await uploadPage.submit();
    await expect(uploadPage.item('evidence.txt')).toContainText('Select a document type for file');
    expect(requests).toHaveLength(0);
  });

  test('disables mutation controls while the upload response is pending', async ({ uploadPage }) => {
    await uploadPage.addFile();
    await uploadPage.chooseType('evidence.txt');
    let release!: () => void;
    const pendingResponse = new Promise<void>((resolve) => {
      release = resolve;
    });
    await uploadPage.page.route('**/documents/upload/**', async (route) => {
      if (route.request().method() !== 'POST') return await route.continue();
      await pendingResponse;
      await route.continue();
    });
    try {
      await uploadPage.submit();
      await expect(uploadPage.uploadButton).toBeDisabled();
      await expect(uploadPage.item('evidence.txt').getByRole('combobox')).toBeDisabled();
      await expect(uploadPage.item('evidence.txt').getByRole('button', { name: 'Remove file', exact: true })).toBeDisabled();
      await expect(uploadPage.page.locator('#submit-button')).toBeDisabled();
    } finally {
      release();
    }
    await uploadPage.confirmation(['evidence.txt']);
  });

  test('all successful files redirect to confirmation in selection order', async ({ uploadPage }) => {
    const { page } = uploadPage;
    await uploadPage.addFile(file('first.txt'));
    await uploadPage.chooseType('first.txt');
    await uploadPage.addFile(file('second.txt'));
    await uploadPage.chooseType('second.txt');
    await uploadPage.submit();
    await uploadPage.confirmation(['first.txt', 'second.txt']);
    await expect(page.getByRole('main').getByRole('list').first().getByRole('listitem')).toHaveText(['first.txt', 'second.txt']);
  });

  test('scan rejection prevents every file in the batch from uploading', async ({ uploadPage }) => {
    const { page } = uploadPage;
    await uploadPage.addFile();
    await uploadPage.chooseType('evidence.txt');
    await uploadPage.addFile(file('scan-test.txt', 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*'));
    await uploadPage.chooseType('scan-test.txt');
    await uploadPage.submit();
    await expect(uploadPage.item('scan-test.txt')).toContainText('does not meet security requirements');
    await expect(page).toHaveURL(flowUrl);
    await expect(page.getByRole('combobox')).toHaveCount(2);
    await expect(page.getByText('Uploaded successfully', { exact: true })).toHaveCount(0);
    await uploadPage.removeFile('scan-test.txt');
    await uploadPage.submit();
    await uploadPage.confirmation(['evidence.txt']);
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
      await expect(uploadPage.item(scenario.payload.name)).toContainText('not supported');
      await expect(page).toHaveURL(flowUrl);
    });
  }

  test('every failed upload remains pending and can be retried', async ({ uploadPage }) => {
    const { page } = uploadPage;
    await uploadPage.addFile(file(failureName));
    await uploadPage.chooseType(failureName);
    await uploadPage.submit();
    await expect(uploadPage.item(failureName)).toContainText('There was a problem uploading');
    await expect(page.getByRole('combobox')).toHaveCount(1);
    const response = page.waitForResponse((value) => value.request().method() === 'POST' && value.url().includes('/documents/upload/'));
    await uploadPage.submit();
    expect((await response).status()).toBe(400);
    await expect(uploadPage.item(failureName)).toContainText('There was a problem uploading');
  });

  test('truncated image content rejects every upload in the batch', async ({ uploadPage }) => {
    await uploadPage.addFile();
    await uploadPage.chooseType('evidence.txt');
    await uploadPage.addFile({ ...file('truncated.png', '', 'image/png'), buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]) });
    await uploadPage.chooseType('truncated.png');
    await uploadPage.submit();
    await expect(uploadPage.item('truncated.png')).toContainText('not supported');
    await expect(uploadPage.page.getByText('Uploaded successfully', { exact: true })).toHaveCount(0);
    await expect(uploadPage.page.getByRole('combobox')).toHaveCount(2);
  });
});

test.describe('partial recovery and explicit completion', () => {
  test('preserves successful files without editing or removal controls', async ({ uploadPage }) => {
    const { page } = uploadPage;
    await uploadPage.partialUpload();
    await expect(uploadPage.item('evidence.txt').getByRole('combobox')).toHaveCount(0);
    await expect(uploadPage.item('evidence.txt').getByRole('button')).toHaveCount(0);
    await expect(page.getByRole('status')).toContainText('1 file uploaded successfully. 1 file remaining to upload');
    await expect(page.getByRole('listitem', { name: /^(evidence.txt|mock-upload-failure.txt)$/ })).toHaveCount(2);
  });

  test('retry submits pending files only and retains earlier success', async ({ uploadPage }) => {
    const { page } = uploadPage;
    await uploadPage.partialUpload();
    const response = page.waitForResponse((value) => value.request().method() === 'POST' && value.url().includes('/documents/upload/'));
    await uploadPage.submit();
    await response;
    expect((await uploadPage.submissions()).at(-1)?.fileNames).toEqual([failureName]);
    await expect(uploadPage.item(failureName)).toContainText('There was a problem uploading');
    await expect(uploadPage.item('evidence.txt')).toContainText('Uploaded successfully');
  });

  test('rejects duplicates of already-uploaded files', async ({ uploadPage }) => {
    const { page } = uploadPage;
    await uploadPage.partialUpload();
    const picker = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Upload file', exact: true }).click();
    await (await picker).setFiles(file());
    await expect(page.getByText(/matches a file you've already selected or uploaded/).first()).toBeVisible();
    await expect(page.getByRole('status')).toContainText('2 of 10 files selected');
  });

  test('adds and uploads new files after removing a failed file', async ({ uploadPage }) => {
    const { page } = uploadPage;
    await uploadPage.partialUpload();
    await uploadPage.removeFile(failureName);
    await uploadPage.addFile(file('replacement.txt'));
    await uploadPage.chooseType('replacement.txt', 2);
    await uploadPage.submit();
    await uploadPage.confirmation(['evidence.txt', 'replacement.txt']);
    await expect(page.getByRole('main').getByText(failureName, { exact: true })).toHaveCount(0);
  });

  test('removing failures requires explicit metadata-only completion', async ({ uploadPage }) => {
    const { page } = uploadPage;
    await uploadPage.partialUpload();
    await uploadPage.removeFile(failureName);
    const region = page.getByRole('region', { name: '1 file uploaded successfully' });
    await expect(region).toBeFocused();
    await expect(region).toContainText('No files awaiting upload.');
    await expect(page).toHaveURL(flowUrl);
    await region.getByRole('button', { name: 'View submission confirmation' }).click();
    await uploadPage.confirmation(['evidence.txt']);
    const submission = (await uploadPage.submissions()).at(-1);
    expect(submission?.action).toBe('finish');
    expect(submission?.fieldNames).not.toContain('file_id');
    expect(submission?.fieldNames).not.toContain('file_object');
  });

  test('uploaded files count toward the selection limit', async ({ uploadPage }) => {
    const { page } = uploadPage;
    await uploadPage.partialUpload();
    await uploadPage.addFiles(Array.from({ length: 8 }, (_, index) => file(`extra-${index}.txt`)));
    const picker = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Upload file', exact: true }).click();
    await (await picker).setFiles(file('eleventh.txt'));
    await expect(page.getByText(/You can upload up to 10 documents at a time/).first()).toBeVisible();
    await expect(page.getByRole('status')).toContainText('10 of 10 files selected');
  });
});

test.describe('navigation and refresh', () => {
  test('query changes are not blocked and revalidate open flow metadata', async ({ uploadPage }) => {
    await uploadPage.partialUpload();
    await uploadPage.removeFile(failureName);
    const response = uploadPage.page.waitForResponse((value) => value.request().method() === 'GET' && value.url().includes('query-test=1'));
    await uploadPage.navigate(`${new URL(uploadPage.page.url()).pathname}?query-test=1`);
    await response;
    await expect(uploadPage.page).toHaveURL(/\?query-test=1$/);
    await expect(uploadPage.page.getByRole('dialog')).toHaveCount(0);
    const finish = await uploadPage.post([['_action', 'finish']]);
    expect(finish.status()).toBe(409);
  });

  for (const dismiss of ['Stay on this page', 'Escape', 'Close']) {
    test(`${dismiss} cancels pathname navigation and restores focus`, async ({ uploadPage }) => {
      const { page } = uploadPage;
      await uploadPage.addFile();
      await uploadPage.uploadButton.focus();
      await uploadPage.navigate('/en/protected/documents');
      const dialog = page.getByRole('dialog', { name: 'Leave this page?' });
      await expect(dialog).toBeVisible();
      if (dismiss === 'Escape') await dialog.press('Escape');
      else await dialog.getByRole('button', { name: dismiss, exact: true }).click();
      await expect(dialog).not.toBeVisible();
      await expect(page).toHaveURL(flowUrl);
      await expect(uploadPage.item('evidence.txt')).toBeVisible();
      await expect(uploadPage.uploadButton).toBeFocused();
    });
  }

  test('explicit Leave allows pathname navigation', async ({ uploadPage }) => {
    await uploadPage.addFile();
    await uploadPage.navigate('/en/protected/documents');
    await uploadPage.page.getByRole('dialog', { name: 'Leave this page?' }).getByRole('button', { name: 'Leave page', exact: true }).click();
    await expect(uploadPage.page).toHaveURL('/en/protected/documents');
    await expect(uploadPage.page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('uploaded-only selection navigates without a client-side warning', async ({ uploadPage }) => {
    await uploadPage.partialUpload();
    await uploadPage.removeFile(failureName);
    await uploadPage.navigate('/en/protected/documents');
    await expect(uploadPage.page).toHaveURL('/en/protected/documents');
    await expect(uploadPage.page.getByRole('dialog')).toHaveCount(0);
  });

  test('refresh resets pending selection to an empty form', async ({ uploadPage }) => {
    const { page } = uploadPage;
    await uploadPage.addFile();
    page.on('dialog', async (dialog) => await dialog.accept());
    await page.reload();
    await uploadPage.isLoaded(flowUrl, 'Submit documents');
    await expect(page.getByRole('status')).toHaveText('0 of 10 files selected');
    await expect(page.getByRole('combobox')).toHaveCount(0);
  });

  test('refresh clears partial-upload metadata and does not allow confirmation', async ({ uploadPage }) => {
    const { page } = uploadPage;
    await uploadPage.partialUpload();
    page.on('dialog', async (dialog) => await dialog.accept());
    await page.reload();
    await uploadPage.isLoaded(flowUrl, 'Submit documents');
    await expect(page.getByRole('status')).toHaveText('0 of 10 files selected');
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
