import { expect } from '@playwright/test';
import type { Page, Request } from '@playwright/test';

import { BasePage } from './base-page';

/** English entry route that creates a new session-backed upload flow. */
export const uploadEntryUrl = '/en/protected/documents/upload';
/** Matches an English UUID-keyed form URL without query strings or fragments. */
export const uploadFlowUrl = /\/en\/protected\/documents\/upload\/[0-9a-f-]+$/;
/** Filename recognized by the upload repository mock to force an upload failure. */
export const uploadFailureName = 'mock-upload-failure.txt';

/**
 * Creates an in-memory file payload for Playwright's file chooser and HTTP tests.
 * @param name - Filename, including the extension used for upload validation.
 * @param contents - UTF-8 text used to construct the file bytes.
 * @param mimeType - Declared MIME type supplied with the file.
 * @returns A filename, MIME type, and buffer accepted by the upload helpers.
 */
export function documentFile(name = 'evidence.txt', contents = 'Eligibility evidence', mimeType = 'text/plain') {
  return { name, mimeType, buffer: Buffer.from(contents) };
}

/** Browser-captured upload metadata; excludes file contents and field values. */
export type UploadSubmission = { action: string; fileNames: string[]; fieldNames: string[] };
/** A multipart field tuple; repeated names support malformed-payload tests. */
export type UploadField = readonly [string, string | ReturnType<typeof documentFile>];

/** Page object for the English document upload flow and its server contracts. */
export class UploadPage extends BasePage {
  /** Opens the single-file native picker. */
  readonly uploadButton;
  /** Announces selection counts while pending files remain or the form is empty. */
  readonly status;

  /**
   * Binds upload locators to the isolated page supplied by the test fixture.
   * @param page - Playwright page owned and cleaned up by the built-in fixture.
   */
  constructor(page: Page) {
    super(page);
    this.uploadButton = page.getByRole('button', { name: 'Upload file', exact: true });
    this.status = page.getByRole('status');
  }

  /** Opens a fresh flow and waits for its URL, H1, and router initialization. */
  async goto() {
    await this.page.goto(uploadEntryUrl);
    await this.isLoaded(uploadFlowUrl, 'Submit documents');
    await this.page.waitForFunction(() => {
      const routerWindow = window as typeof window & { __reactRouterDataRouter?: { state: { initialized: boolean } } };
      return routerWindow.__reactRouterDataRouter?.state.initialized === true;
    });
  }

  /**
   * Locates a pending or uploaded item by its exact accessible filename.
   * @param name - Filename identifying the item; duplicate names can match multiple items.
   * @returns A locator scoped to matching upload list items.
   */
  item(name: string) {
    return this.page.getByRole('listitem', { name, exact: true });
  }

  /**
   * Starts collecting subsequent browser POSTs targeting English upload routes.
   * @returns A live array populated by request events until the page closes.
   */
  requests() {
    const requests: Request[] = [];
    this.page.on('request', (request) => {
      if (request.method() === 'POST' && new URL(request.url()).pathname.startsWith(uploadEntryUrl)) requests.push(request);
    });
    return requests;
  }

  /**
   * Selects one file through the native picker and waits for it to be accepted.
   * @param payload - File bytes and metadata; defaults to a valid plain-text document.
   */
  async addFile(payload = documentFile()) {
    const picker = this.page.waitForEvent('filechooser');
    await this.uploadButton.click();
    const chooser = await picker;
    expect(chooser.isMultiple()).toBe(false);
    await chooser.setFiles(payload);
    await expect(this.item(payload.name)).toBeVisible();
    await expect(this.uploadButton).toBeEnabled();
  }

  /**
   * Changes the document type for a pending file.
   * @param name - Filename uniquely identifying the pending item.
   * @param index - Zero-based option index; the first active type is index 1.
   */
  async chooseType(name: string, index = 1) {
    await this.item(name).getByRole('combobox', { name: 'Document Type' }).selectOption({ index });
  }

  /**
   * Adds files sequentially to avoid overlapping picker and selection mutations.
   * @param payloads - File payloads in their intended selection order.
   */
  async addFiles(payloads: ReturnType<typeof documentFile>[]) {
    await payloads.reduce(async (previous, payload) => {
      await previous;
      await this.addFile(payload);
    }, Promise.resolve());
  }

  /**
   * Confirms removal in the file dialog and waits for the item to disappear.
   * @param name - Filename uniquely identifying the pending item to remove.
   */
  async removeFile(name: string) {
    await this.item(name).getByRole('button', { name: 'Remove file', exact: true }).click();
    const dialog = this.page.getByRole('dialog', { name: 'Remove this file?' });
    await expect(dialog).toContainText(name);
    await dialog.getByRole('button', { name: 'Remove file', exact: true }).click();
    await expect(this.item(name)).toHaveCount(0);
  }

  /** Clicks Submit or Submit remaining files; callers must assert the outcome. */
  async submit() {
    await this.page.getByRole('button', { name: /^(Submit|Submit remaining files)$/ }).click();
  }

  /**
   * Waits for confirmation and verifies filenames, the delay notice, and next steps.
   * @param names - Successful filenames expected in the confirmation content.
   */
  async confirmation(names: string[]) {
    await this.isLoaded(/\/submitted$/, 'Documents submitted');
    await Promise.all(names.map(async (name) => await expect(this.page.getByRole('main').getByText(name, { exact: true })).toBeVisible()));
    await expect(this.page.getByText('There could be a short delay with your documents appearing in your account.')).toBeVisible();
    await expect(this.page.getByRole('heading', { name: 'Next steps', exact: true })).toBeVisible();
  }

  /** Creates and verifies one successful upload and one mock-induced pending failure. */
  async partialUpload() {
    await this.addFile();
    await this.chooseType('evidence.txt');
    await this.addFile(documentFile(uploadFailureName));
    await this.chooseType(uploadFailureName);
    await this.submit();
    await expect(this.item('evidence.txt')).toContainText('Uploaded successfully');
    await expect(this.item(uploadFailureName)).toContainText('There was a problem uploading');
    await expect(this.page.getByRole('button', { name: 'Submit remaining files', exact: true })).toBeEnabled();
  }

  /**
   * Reads multipart metadata recorded by the document-upload fixture's fetch wrapper.
   * @returns A snapshot of captures for the current browser document, in request order.
   */
  async submissions(): Promise<UploadSubmission[]> {
    return await this.page.evaluate(() => {
      const captureWindow = window as typeof window & { uploadSubmissions: UploadSubmission[] };
      return captureWindow.uploadSubmissions;
    });
  }

  /**
   * Sends a multipart request directly to the server, bypassing client validation.
   * Preserves repeated fields and supplies the current CSRF token, session cookies,
   * and same-origin headers. Explicit cookies accommodate secure cookies on localhost.
   * @param fields - String or file fields, including the desired `_action`.
   * @param url - Absolute target URL; defaults to the current form URL.
   * @returns The HTTP response without following redirects or navigating the page.
   */
  async post(fields: UploadField[], url = this.page.url()) {
    const form = new FormData();
    form.set('_csrf', await this.page.locator('input[name="_csrf"]').inputValue());
    for (const [name, value] of fields) {
      if (typeof value === 'string') form.append(name, value);
      else form.append(name, new Blob([Uint8Array.from(value.buffer)], { type: value.mimeType }), value.name);
    }
    const cookies = await this.page.context().cookies();
    return await this.page.request.post(url, {
      multipart: form,
      maxRedirects: 0,
      headers: {
        Origin: new URL(url).origin,
        'Sec-Fetch-Site': 'same-origin',
        Cookie: cookies.map(({ name, value }) => `${name}=${value}`).join('; '),
      },
    });
  }

  /**
   * Initiates SPA navigation through the browser router to exercise route guards.
   * Does not await navigation completion, allowing tests to interact with blockers.
   * @param url - Router destination; callers must assert the resulting dialog or URL.
   */
  async navigate(url: string) {
    await this.page.evaluate((target) => {
      const routerWindow = window as typeof window & { __reactRouterDataRouter: { navigate: (url: string) => Promise<void> } };
      void routerWindow.__reactRouterDataRouter.navigate(target);
    }, url);
  }
}
