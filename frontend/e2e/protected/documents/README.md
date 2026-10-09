# Document Upload E2E Coverage

The spec files are the source of truth for test scenarios. Feature behavior is
documented in [Document Upload Feature](../../../other/docs/document-upload-feature.md).

## Run

Build first. The root Playwright configuration starts the application with
`pnpm run start`; no separate server command is needed.

```sh
pnpm run build
pnpm exec playwright test e2e/protected/documents
```

List the current tests without running them:

```sh
pnpm exec playwright test e2e/protected/documents --list
```

Screenshots are off by default. The custom `E2E_SCREENSHOTS=true` setting enables
full-page screenshots for passes and failures in `test-results/`. Playwright Test
has no `--screenshot` flag. Use `--trace` to override the default first-retry traces.

```sh
E2E_SCREENSHOTS=true pnpm exec playwright test e2e/protected/documents
pnpm exec playwright test e2e/protected/documents --trace=retain-on-failure
```

The root configuration supplies reporters. After a run using the HTML reporter:

```sh
pnpm exec playwright show-report
```

## Suites

- [upload.spec.ts](./upload.spec.ts): form validation, selection, scanning,
  partial recovery, focus, confirmation, and navigation.
- [upload-contract.spec.ts](./upload-contract.spec.ts): crafted HTTP requests to
  the real server action, bypassing client checks but retaining session cookies
  and CSRF protection. Assertions check statuses, bodies, and redirects.
  Optional screenshots show browser state, not HTTP responses.
- [upload-submitted.spec.ts](./upload-submitted.spec.ts): receipt content,
  ordered filenames, next steps, delayed visibility, refresh, and access guards.
- [index.spec.ts](./index.spec.ts): populated table, metadata, refresh, and
  navigation to upload.

## Fixtures

Each test has a fresh browser context. [The fixture](../../fixtures/document-upload.ts)
provides `uploadPage` with a new UUID-keyed flow. [UploadPage](../../pages/upload-page.ts)
extends `BasePage`, checks URL and H1 with `isLoaded()`, and waits for router
initialization. Tests use accessible locators, web-first assertions, and no sleeps.
Page mutations run sequentially. Form locators belong to `UploadPage`;
confirmation locators and assertions belong to `UploadSubmittedPage`.

`uploadSubmittedPage` depends on `uploadPage`, submits two files, and returns an
`UploadSubmittedPage` extending `BasePage`. Guard and partial-completion tests
request `uploadPage` and, when needed, `submittedPage`. The latter only binds
confirmation locators; it does not submit files. No fixture adds another browser context.

`uploadApi` depends on `uploadPage` and provides `DocumentUploadApi` for direct
HTTP contracts. [Shared helpers](../../utils/document-upload.ts) own test files,
route constants, request collection, and `readUploadSubmissions()`.

The fixture captures action names, filenames, and multipart field names from
browser fetches, not file contents or CSRF values. This verifies retry and finish
payloads without relying on Chromium's `Request.postDataBuffer()` support.
Existing `Request` inputs are cloned before inspection so their bodies remain
available to the original fetch call.

SPA guard and query tests use `navigateUploadRouter()` because the upload page
has no same-language internal navigation link. Router initialization and
navigation hooks are isolated in the shared helpers, not page objects.
These hooks depend on React Router internals; native unload tests use real
reloads and document navigation.

## Limits

EWDU and Power Platform use application mocks. The required `evidentiary-document`
mock supplies eligibility and document-list data. These tests do not verify live
scanning, delivery, ingestion, or downstream retries. Mock submission success
does not mean Power Platform ingestion completed; HTTP responses are not fabricated.

The fixed applicant and document types leave these E2E gaps:

- **Absent or denied eligibility:** mapper tests cover true/false decisions;
  configurable backend fixtures are needed to test both access outcomes.
- **Whole multi-file selection rejection:** the picker is single-file;
  selection-helper tests cover batch validation.
- **Stale selection responses:** local validation and disabled controls prevent
  arranging the race through normal UI; test at hook level.
- **Unavailable uploaded type labels:** mock active types never change mid-flow.
- **Content-check or scan-service exceptions:** server-helper tests inject scan
  failures; E2E covers rejection, not forced service exceptions.
- **No repeated downstream calls for successful files:** retry POSTs exclude
  successful filenames, but EWDU call counts require a controllable endpoint.
