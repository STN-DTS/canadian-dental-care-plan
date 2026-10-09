# Document Upload E2E Coverage

These specs use the root Playwright configuration and its `webServer` command.
Build the application before running them so `pnpm run start` serves current
source code. No separate application startup command is needed.

```sh
pnpm run build
pnpm exec playwright test e2e/protected/documents
```

The suite contains 65 isolated Chromium tests. Each test gets a new browser
context and a new UUID-keyed upload flow through the `uploadPage` fixture.
`UploadPage` extends `BasePage`; setup checks the URL and H1 with `isLoaded()`
and then waits for React Router initialization before interactive actions.
Tests use accessible roles, web-first assertions, and no fixed sleeps.

Screenshots are retained for every passing and failing test in `test-results/`.
The root configuration retains traces on the first retry and uses its existing
reporters. Open an HTML report after a default-reporter run with:

```sh
pnpm exec playwright show-report
```

## Test Boundaries

- [upload.spec.ts](./upload.spec.ts) exercises the rendered upload form,
  confirmation, validation, scanning, partial recovery, focus, and navigation.
- [upload-contract.spec.ts](./upload-contract.spec.ts) sends malformed and
  validation-bypassing HTTP requests to the real server action using the
  isolated browser's cookies and CSRF token. Screenshots show the browser state;
  HTTP status and response assertions verify the server result.
- [UploadPage](../../pages/upload-page.ts) keeps file-picker and form operations
  sequential because they mutate the same page. Independent confirmation
  assertions run with `Promise.all()`.
- [The fixture](../../fixtures/document-upload.ts) captures multipart field names
  and filenames from actual browser fetches. It does not store file contents or
  CSRF values in the capture. This verifies retry and finish payloads without
  depending on Chromium exposing multipart bytes to `Request.postDataBuffer()`.
- EWDU and Power Platform use existing application mocks. The suite does not
  verify live EWDU scanning, ingestion, delivery, or downstream retry policies.
- The upload page has no same-language internal navigation link. SPA guard and
  query tests therefore initiate navigation through React Router's browser
  router. Native unload tests use actual reload and document navigation.
- `evidentiary-document` is enabled in the root configuration because it owns
  the appeal eligibility and document-list mock bindings.

## Scenario Mapping

Source: [Document Upload Feature](../../../other/docs/document-upload-feature.md).

| Document scenario                                                          | E2E coverage                                                               |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Eligible entry creates a new initialized flow                              | Empty UUID flow and repeated-entry checks                                  |
| Invalid flow ID or unavailable session record                              | Invalid-ID and missing-session redirects                                   |
| Finished form access, including POST                                       | Confirmation refresh, form revisit, and finished-form POST                 |
| Initialized or partial confirmation access                                 | Both redirect to the documents list                                        |
| Finished confirmation shows filenames and delayed visibility               | Confirmation filenames, ordering, next steps, delay notice, and refresh    |
| Valid selection, empty type, and focus                                     | File-picker, pending-item, empty-type, count, and focus assertions         |
| Appending files preserves types and selection                              | Append and independent type-change checks                                  |
| Picker selects one file; cancellation changes nothing                      | Native picker `isMultiple()` and cancellation checks                       |
| Count limit, including uploaded files                                      | Ten-file limit and partial-upload combined-count checks                    |
| Unsupported extension or oversized selection                               | Selection rejected, previous file/type preserved, no server POST           |
| Exact maximum size                                                         | Accepted 5 MiB selection                                                   |
| Duplicate against pending or uploaded files                                | Both rejected without adding the file                                      |
| Same content under different names; same name with different content       | Both accepted as separate selections                                       |
| Pending type change affects only that file                                 | Independent selector values                                                |
| Removal cancellation, Escape, and dismissal                                | All retain the file and restore trigger focus                              |
| Confirmed removal focus destinations                                       | Next item, preceding item, upload trigger, and uploaded-only region        |
| Uploaded items cannot be edited or removed                                 | Successful status and absence of edit/removal controls                     |
| Empty submission or missing type                                           | Client errors and zero upload POSTs                                        |
| Server repeats extension, size, count, type, and duplicate validation      | Direct HTTP validation-bypass checks                                       |
| Missing, blank, non-string, duplicate, or mismatched IDs; non-file objects | HTTP 400 cases                                                             |
| Resubmitted uploaded ID                                                    | HTTP 409 and retained success                                              |
| Disallowed detected type or undetectable non-text content                  | File-specific rejection before uploading                                   |
| Undetectable declared text content                                         | Successful plain-text upload journeys                                      |
| Scan rejects a file; no pending file uploads                               | EICAR mixed-batch rejection, retained pending files, and recovery          |
| All pending uploads succeed                                                | Confirmation with ordered filenames                                        |
| Every upload fails                                                         | Pending state, upload error, and repeated retry                            |
| Partial upload succeeds                                                    | Successful and failed statuses, counts, retained order, and no redirect    |
| Upload error response or processing exception                              | Mock failure and unknown-type resolution error                             |
| Retry after scan failure                                                   | Corrected pending batch subsequently reaches confirmation                  |
| Retry after partial upload sends only pending files                        | Captured multipart filenames exclude earlier success                       |
| Add or remove files after partial success                                  | Duplicate/count checks and successful replacement upload                   |
| Removal alone does not finish partial flow                                 | Uploaded-only status and unchanged form URL                                |
| Explicit uploaded-only completion                                          | Metadata-only finish fields and success-only confirmation                  |
| Finish without success                                                     | HTTP 409                                                                   |
| Finish includes IDs, files, or another non-string field                    | HTTP 400 cases                                                             |
| Removing all files with no success                                         | Empty count and upload-trigger focus                                       |
| Pending pathname navigation                                                | Stay, Escape, Close, focus restoration, and explicit Leave                 |
| Pending browser unload                                                     | Native `beforeunload` warning on reload                                    |
| Empty or uploaded-only navigation                                          | No native warning; uploaded-only SPA navigation also unblocked             |
| Query or fragment changes                                                  | No pathname dialog; query revalidates metadata, fragment retains selection |
| Reload clears pending and uploaded metadata                                | Pending reset and partial reset with confirmation rejected                 |
| Same-form selection, upload, and finish preserve state                     | Append, partial recovery, retry, and finish journeys                       |
| In-flight submission disables mutations                                    | Held real browser request; picker, type, removal, and submit disabled      |

## Remaining E2E Gaps

The current application mocks return one fixed eligible applicant and fixed
document types. The following documented scenarios are not claimed as E2E
coverage; they need configurable backend fixtures or lower-level fault injection:

| Scenario                                                          | Current limitation or existing lower-level coverage                                                                        |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Eligibility absent or `canUploadAppealDocuments: false` redirects | Existing eligibility-mapper tests cover true/false decisions, but this mock cannot render both access outcomes             |
| Entire incoming multi-file selection rejected on first error      | Native picker is single-file; selection-helper tests cover batch validation                                                |
| Stale selection-validation response ignored                       | Local client action and disabled picker prevent arranging this race through normal UI; hook-level testing is appropriate   |
| Unavailable uploaded document-type label fallback                 | Fixed active mock types do not change during a flow                                                                        |
| Content checking or scan service throws                           | Existing server-helper tests inject rejected scan promises; E2E covers actual rejection, not a forced service exception    |
| Actual EWDU scans/uploads never repeat for successful files       | E2E verifies successful filenames are absent from retry POSTs; downstream call counts require a controllable EWDU endpoint |

The HTTP tests exercise the real upload action rather than fulfilling application
responses with fabricated success/error data. They do not equate mocked backend
success with completed Power Platform ingestion.
