import { test as base } from '@playwright/test';

import { UploadPage } from '../pages/upload-page';
import type { UploadSubmission } from '../pages/upload-page';

/**
 * Provides an isolated, ready-to-use upload page for each test.
 *
 * Captures multipart metadata in the browser because Chromium does not reliably
 * expose multipart bodies through Playwright's Request.postDataBuffer(). Tests
 * read this capture with UploadPage.submissions() to verify pending-only retries
 * and metadata-only completion. File contents and CSRF values are not recorded.
 *
 * The built-in page fixture owns browser-context isolation and teardown; this
 * fixture only installs the capture and opens a new upload flow.
 */
export const test = base.extend<{ uploadPage: UploadPage }>({
  uploadPage: async ({ page }, use) => {
    // Install before navigation and reset the capture for each new document.
    await page.addInitScript(() => {
      const captureWindow = window as typeof window & { uploadSubmissions: UploadSubmission[] };
      captureWindow.uploadSubmissions = [];
      const originalFetch = window.fetch.bind(window);
      window.fetch = async (input, init) => {
        const request = new Request(input, init);
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
});

export { expect } from '@playwright/test';
