import { test as base } from '@playwright/test';

import { UploadPage } from '../pages/upload-page';
import { UploadSubmittedPage } from '../pages/upload-submitted-page';
import { DocumentUploadApi, documentFile } from '../utils/document-upload';
import type { UploadSubmission } from '../utils/document-upload';

/**
 * Provides an isolated, ready-to-use upload page for each test.
 *
 * Captures multipart metadata in the browser because Chromium does not reliably
 * expose multipart bodies through Playwright's Request.postDataBuffer(). Tests
 * read this capture with readUploadSubmissions() to verify pending-only retries
 * and metadata-only completion. File contents and CSRF values are not recorded.
 *
 * The built-in page fixture owns browser-context isolation and teardown; this
 * uploadPage installs the capture and opens a new upload flow. The optional
 * uploadSubmittedPage fixture completes two files through that flow and yields
 * a confirmation page object; it runs only when requested by a test. submittedPage
 * binds confirmation locators without completing a flow. uploadApi depends on
 * uploadPage and supplies direct HTTP requests without adding browser contexts.
 */
export const test = base.extend<{ uploadPage: UploadPage; submittedPage: UploadSubmittedPage; uploadSubmittedPage: UploadSubmittedPage; uploadApi: DocumentUploadApi }>({
  uploadPage: async ({ page }, use) => {
    // Install before navigation and reset the capture for each new document.
    await page.addInitScript(() => {
      const captureWindow = window as typeof window & { uploadSubmissions: UploadSubmission[] };
      captureWindow.uploadSubmissions = [];
      const originalFetch = window.fetch.bind(window);
      window.fetch = async (input, init) => {
        const request = new Request(input instanceof Request ? input.clone() : input, init);
        if (request.method === 'POST' && new URL(request.url).pathname.includes('/documents/upload/')) {
          // Inspect a clone so reading FormData does not consume the real request.
          const form = await request.clone().formData();
          captureWindow.uploadSubmissions.push({
            action: String(form.get('_action')),
            fileNames: form
              .getAll('file_object')
              .filter((value): value is File => value instanceof File)
              .map((value) => value.name),
            fieldNames: [...form.keys()],
          });
        }
        // Observe uploads without replacing the application's server responses.
        return await originalFetch(input, init);
      };
    });
    const uploadPage = new UploadPage(page);
    await uploadPage.goto();
    // Yield the initialized page object to the test; Playwright handles teardown.
    await use(uploadPage);
  },
  submittedPage: async ({ page }, use) => {
    await use(new UploadSubmittedPage(page));
  },
  uploadApi: async ({ uploadPage }, use) => {
    await use(new DocumentUploadApi(uploadPage.page));
  },
  uploadSubmittedPage: async ({ uploadPage, submittedPage }, use) => {
    await uploadPage.addFile(documentFile('eligibility-review.txt'));
    await uploadPage.chooseType('eligibility-review.txt');
    await uploadPage.addFile(documentFile('employer-letter.txt'));
    await uploadPage.chooseType('employer-letter.txt', 2);
    await uploadPage.submit();
    await submittedPage.waitForConfirmation();
    await use(submittedPage);
  },
});

export { expect } from '@playwright/test';
