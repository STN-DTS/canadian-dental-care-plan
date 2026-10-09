import type { Page, Request } from '@playwright/test';

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

/** Direct server-contract requests using the isolated browser session. */
export class DocumentUploadApi {
  readonly page: Page;

  /** @param page - Browser page supplying session cookies and the current CSRF token. */
  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Sends a multipart request directly to the server, bypassing client validation.
   * Preserves repeated fields and supplies the current CSRF token, session cookies,
   * and same-origin headers. Explicit cookies accommodate secure cookies on localhost.
   * @param fields - String or file fields, including the desired `_action`.
   * @param url - Absolute target URL; defaults to the current form URL.
   * @param csrfToken - Saved token for requests made after leaving the form.
   * @returns The HTTP response without following redirects or navigating the page.
   */
  async post(fields: UploadField[], url = this.page.url(), csrfToken?: string) {
    const form = new FormData();
    form.set('_csrf', csrfToken ?? (await this.page.locator('input[name="_csrf"]').inputValue()));
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
}

/**
 * Starts collecting subsequent browser POSTs targeting English upload routes.
 * @param page - Isolated page to observe.
 * @returns A live array populated by request events until the page closes.
 */
export function collectUploadRequests(page: Page) {
  const requests: Request[] = [];
  page.on('request', (request) => {
    if (request.method() === 'POST' && new URL(request.url()).pathname.startsWith(uploadEntryUrl)) requests.push(request);
  });
  return requests;
}

/**
 * Reads multipart metadata recorded by the document-upload fixture's fetch wrapper.
 * @param page - Page whose current document contains the capture.
 * @returns A snapshot of captures for the current browser document, in request order.
 */
export async function readUploadSubmissions(page: Page): Promise<UploadSubmission[]> {
  return await page.evaluate(() => {
    const captureWindow = window as typeof window & { uploadSubmissions: UploadSubmission[] };
    return captureWindow.uploadSubmissions;
  });
}

/** Waits for the React Router test hook before interacting with the hydrated form. */
export async function waitForUploadRouter(page: Page) {
  await page.waitForFunction(() => {
    const routerWindow = window as typeof window & { __reactRouterDataRouter?: { state: { initialized: boolean } } };
    return routerWindow.__reactRouterDataRouter?.state.initialized === true;
  });
}

/**
 * Initiates SPA navigation through React Router's internal browser test hook.
 * This dependency stays here because the form has no same-language internal link.
 * Does not await navigation completion, allowing tests to interact with blockers.
 * @param page - Browser page with an initialized router.
 * @param url - Router destination; callers must assert the resulting dialog or URL.
 */
export async function navigateUploadRouter(page: Page, url: string) {
  await page.evaluate((target) => {
    const routerWindow = window as typeof window & { __reactRouterDataRouter?: { navigate: (url: string) => Promise<void> } };
    if (!routerWindow.__reactRouterDataRouter) throw new Error('React Router test hook is unavailable');
    void routerWindow.__reactRouterDataRouter.navigate(target);
  }, url);
}
