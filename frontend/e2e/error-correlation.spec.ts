/**
 * Production-build E2E coverage for AppError correlation details.
 *
 * The status-check mock fails like an interop API 429 for the reserved
 * application code, so the error passes through the real route, service,
 * correlation middleware, route-error adapter, and handleError. Users see only
 * the correlation ID and error code; the server log keeps the full error for that ID. Root,
 * plain Error, 404, and resource-route cases live in app-error-boundary.test.ts.
 */
import { expect, test } from './fixtures/error-correlation';
import { statusCheckerCopy } from './pages/status-checker-page';
import type { StatusCheckerLocale } from './pages/status-checker-page';
import { findHandleErrorRecord } from './utils/server-log';

const failingStatusCheck = { code: '999429', sin: '800000002' };
const errorCode = 'API-STATUS-0002';
const privateDetails = ['Too Many Requests', 'Status: 429', 'MockApplicationStatusRepository'];

function expectOnlyPublicErrorDetails(body: string, correlationId: string) {
  expect(correlationId).not.toBe('');
  expect(body).toContain(correlationId);
  expect(body).toContain(errorCode);

  for (const detail of privateDetails) {
    expect(body).not.toContain(detail);
  }
}

for (const locale of Object.keys(statusCheckerCopy) as StatusCheckerLocale[]) {
  test.describe(`failed status check (${locale})`, () => {
    test.use({ statusLocale: locale });

    test('shows the correlation ID that the server logged with the full error', async ({ statusCheckerPage }) => {
      await statusCheckerPage.checkStatus(failingStatusCheck);
      const correlationId = await statusCheckerPage.readCorrelationId();

      await expect(statusCheckerPage.correlationLabel).toHaveText(statusCheckerPage.copy.correlationIdLabel);
      await expect(statusCheckerPage.correlationId).toHaveText(correlationId);
      await expect(statusCheckerPage.main.getByText(errorCode, { exact: true })).toBeVisible();

      await Promise.all(privateDetails.map(async (detail) => await expect(statusCheckerPage.main).not.toContainText(detail)));

      await expect
        .poll(async () => await findHandleErrorRecord(correlationId))
        .toMatchObject({
          errorCode,
          message: expect.stringContaining('Status: 429'),
          stack: expect.stringContaining('MockApplicationStatusRepository.getApplicationStatusBySin'),
        });
    });

    test('has no detectable accessibility violations on the error page', async ({ statusCheckerPage, checkAccessibility }) => {
      await statusCheckerPage.checkStatus(failingStatusCheck);
      await statusCheckerPage.readCorrelationId();

      await checkAccessibility(`status-check-error-${locale}`);
    });
  });
}

test('the .data action response carries only public error details', async ({ statusCheckerPage }) => {
  const response = await statusCheckerPage.postToDataEndpoint(failingStatusCheck);

  expectOnlyPublicErrorDetails(response.body, response.correlationId);
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('the server-rendered error page includes the correlation ID but no private details', async ({ page, statusCheckerPage }) => {
    const documentResponse = page.waitForResponse((response) => response.request().method() === 'POST' && response.request().isNavigationRequest());
    await statusCheckerPage.checkStatus(failingStatusCheck);

    const response = await documentResponse;
    expect(response.status()).toBe(500);
    expectOnlyPublicErrorDetails(await response.text(), (await response.headerValue('x-correlation-id')) ?? '');
    await expect(statusCheckerPage.main.getByText(errorCode, { exact: true })).toBeVisible();
  });
});

test.describe('on a mobile viewport', () => {
  test.use({ viewport: { width: 320, height: 812 } });

  test('the correlation ID and error code remain selectable and the error page does not scroll horizontally', async ({ page, statusCheckerPage }) => {
    await statusCheckerPage.checkStatus(failingStatusCheck);
    const correlationId = await statusCheckerPage.readCorrelationId();

    await statusCheckerPage.correlationId.selectText();
    expect(await page.evaluate(() => window.getSelection()?.toString())).toBe(correlationId);
    const displayedErrorCode = statusCheckerPage.main.getByText(errorCode, { exact: true });
    await displayedErrorCode.selectText();
    expect(await page.evaluate(() => window.getSelection()?.toString())).toBe(errorCode);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
