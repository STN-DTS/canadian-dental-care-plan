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

Run only accessibility tests, or exclude them from a functional-only run:

```sh
pnpm exec playwright test e2e/protected/documents --grep @a11y
pnpm exec playwright test e2e/protected/documents --grep-invert @a11y
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
- Accessibility scans follow the same route names:
  [index-accessibility.spec.ts](./index-accessibility.spec.ts),
  [upload-accessibility.spec.ts](./upload-accessibility.spec.ts), and
  [upload-submitted-accessibility.spec.ts](./upload-submitted-accessibility.spec.ts).

## Accessibility

[The accessibility fixture](../../fixtures/accessibility.ts) uses
`@axe-core/playwright` and supplies `makeAxeBuilder` and `checkAccessibility`.
It composes with document-upload fixtures through `mergeTests`, without adding
browser contexts or scanning every functional test automatically.

Tests wait for each visible state, then scan the full page with default axe
rules. No elements or rules are excluded. Each scan attaches complete JSON
results before asserting zero detected violations; failures show rule IDs,
impact, target selectors, and help links. Inconclusive results remain in reports
for manual review. Dialog tests also check Tab, Shift+Tab, Escape, and focus restoration.

These tests run with the normal E2E suite. Passing scans do not prove WCAG
conformance, correct screen-reader announcements, or usability. Manual assessments
and inclusive user testing remain necessary; a specific WCAG rule scope can be
configured centrally in the builder fixture when the project selects its target.

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
