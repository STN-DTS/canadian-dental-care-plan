/**
 * HTTP contract coverage for document upload server actions and lifecycle guards.
 *
 * Sends crafted payloads directly to the running application, bypassing client
 * validation while retaining the UploadPage fixture's session and CSRF token.
 * Verifies malformed-payload rejection, repeated server validation, upload-state
 * conflicts, and redirects using HTTP statuses, response bodies, and headers.
 * Browser interactions establish or verify flow state where needed.
 *
 * Backend services use the configured mocks. Optional screenshots capture browser
 * state, not HTTP responses; rendered user journeys belong in upload.spec.ts.
 */
import { expect, test } from '../../fixtures/document-upload';
import { documentFile, uploadFailureName } from '../../pages/upload-page';
import type { UploadField } from '../../pages/upload-page';

const validFile = documentFile();
const validFields: UploadField[] = [
  ['_action', 'upload'],
  ['file_id', 'first'],
  ['file_object', validFile],
  ['file_document_type', 'invalid-type-id'],
];

for (const scenario of [
  {
    name: 'no file IDs',
    fields: [
      ['_action', 'upload'],
      ['file_object', validFile],
    ],
  },
  {
    name: 'no file objects',
    fields: [
      ['_action', 'upload'],
      ['file_id', 'first'],
    ],
  },
  { name: 'mismatched ID and file counts', fields: [...validFields, ['file_id', 'second']] },
  {
    name: 'blank file ID',
    fields: [
      ['_action', 'upload'],
      ['file_id', '  '],
      ['file_object', validFile],
    ],
  },
  {
    name: 'non-string file ID',
    fields: [
      ['_action', 'upload'],
      ['file_id', validFile],
      ['file_object', validFile],
    ],
  },
  {
    name: 'non-file object',
    fields: [
      ['_action', 'upload'],
      ['file_id', 'first'],
      ['file_object', 'not-a-file'],
    ],
  },
  { name: 'duplicate file IDs', fields: [...validFields, ['file_id', 'first'], ['file_object', documentFile('second.txt')]] },
] satisfies { name: string; fields: UploadField[] }[]) {
  test(`server rejects ${scenario.name} with HTTP 400`, async ({ uploadPage }) => {
    const response = await uploadPage.post(scenario.fields);
    expect(response.status()).toBe(400);
    await test.info().attach('server-response', { body: await response.text(), contentType: 'text/html' });
    await expect(uploadPage.page.getByRole('status')).toHaveText('0 of 10 files selected');
  });
}

for (const scenario of [
  { name: 'missing document type', file: validFile, type: '', error: 'Select a document type for file' },
  { name: 'unsupported extension', file: documentFile('evidence.exe'), type: 'invalid-type-id', error: 'not supported' },
  { name: 'oversized file', file: { ...documentFile('oversized.txt'), buffer: Buffer.alloc(5 * 1024 * 1024 + 1, 'a') }, type: 'invalid-type-id', error: 'too large' },
]) {
  test(`server repeats ${scenario.name} validation when client checks are bypassed`, async ({ uploadPage }) => {
    const response = await uploadPage.post([
      ['_action', 'upload'],
      ['file_id', 'first'],
      ['file_object', scenario.file],
      ['file_document_type', scenario.type],
    ]);
    expect(response.status()).toBe(400);
    expect(await response.text()).toContain(scenario.error);
  });
}

test('server rejects duplicate file contents with distinct IDs', async ({ uploadPage }) => {
  const response = await uploadPage.post([...validFields, ['file_id', 'second'], ['file_object', validFile], ['file_document_type', 'invalid-type-id']]);
  expect(response.status()).toBe(400);
  expect(await response.text()).toContain('matches a file');
});

test('server rejects an excessive pending batch', async ({ uploadPage }) => {
  const fields: UploadField[] = Array.from(
    { length: 11 },
    (_, index) =>
      [
        ['file_id', `file-${index}`],
        ['file_object', documentFile(`file-${index}.txt`)],
        ['file_document_type', 'invalid-type-id'],
      ] satisfies UploadField[],
  ).flat();
  const response = await uploadPage.post([['_action', 'upload'], ...fields]);
  expect(response.status()).toBe(400);
  expect(await response.text()).toContain('You can upload up to 10 documents');
});

test('unknown nonempty type reaches upload processing and returns an unexpected upload error', async ({ uploadPage }) => {
  const response = await uploadPage.post(validFields);
  expect(response.status()).toBe(400);
  expect(await response.text()).toContain('An unexpected error occurred while uploading');
});

for (const fields of [[['file_id', 'first']], [['file_object', validFile]], [['unexpected', validFile]]] satisfies UploadField[][]) {
  test(`finish rejects ${fields[0]?.[0]} fields with HTTP 400`, async ({ uploadPage }) => {
    const response = await uploadPage.post([['_action', 'finish'], ...fields]);
    expect(response.status()).toBe(400);
  });
}

test('finish without successful uploads returns HTTP 409', async ({ uploadPage }) => {
  const response = await uploadPage.post([['_action', 'finish']]);
  expect(response.status()).toBe(409);
});

test('server rejects resubmission of an already-uploaded file ID without changing success', async ({ uploadPage }) => {
  await uploadPage.partialUpload();
  const uploadedId = (await uploadPage.item('evidence.txt').getAttribute('id'))?.replace('file-upload-item-', '');
  expect(uploadedId).toBeTruthy();
  const response = await uploadPage.post([
    ['_action', 'upload'],
    ['file_id', uploadedId ?? ''],
    ['file_object', validFile],
  ]);
  expect(response.status()).toBe(409);
  await uploadPage.removeFile(uploadFailureName);
  await uploadPage.page.getByRole('button', { name: 'View submission confirmation' }).click();
  await uploadPage.confirmation(['evidence.txt']);
});

test('POST to a finished form redirects to confirmation before validating its payload', async ({ uploadPage }) => {
  await uploadPage.addFile();
  await uploadPage.chooseType('evidence.txt');
  const originalUrl = uploadPage.page.url();
  const token = await uploadPage.page.locator('input[name="_csrf"]').inputValue();
  await uploadPage.submit();
  await uploadPage.confirmation(['evidence.txt']);
  const cookies = await uploadPage.page.context().cookies();
  const response = await uploadPage.page.request.post(originalUrl, {
    form: { _csrf: token, _action: 'finish' },
    maxRedirects: 0,
    headers: { Origin: new URL(originalUrl).origin, 'Sec-Fetch-Site': 'same-origin', Cookie: cookies.map(({ name, value }) => `${name}=${value}`).join('; ') },
  });
  expect(response.status()).toBe(302);
  expect(response.headers().location).toBe(`${new URL(originalUrl).pathname}/submitted`);
});
