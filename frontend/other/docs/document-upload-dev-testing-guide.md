# Document Upload — DEV Testing and Accessibility Assessment Guide

This guide is for designers, product owners (POs), business analysts (BAs), and
the Accessibility Office. It gives simple steps for testing the document upload
form in the mocked DEV environment.

Use the [technical reference](./document-upload-feature.md) for implementation
details. This guide does not replace the Accessibility Office’s assessment
method or determine whether the feature conforms to a standard.

## Shared setup

### What this DEV test can show

DEV mocks simulate service responses. You can assess what the interface displays
and how people use it. You cannot use these tests to prove real security
scanning, document storage, downstream processing, or external-service
accessibility.

DEV uses a hardcoded mock user with access to document upload only. You do not
need to sign in or obtain a test account. This guide is for testing the document
upload form, not sign-in, account selection, or other application features.

Ask the testing coordinator for:

- The deployed build or version.
- Confirmation that document upload and its mocks are active.
- Any controlled delays or failure conditions you need.

Do not put passwords, personal information, or applicant details in test notes.

### Open the upload page

1. Open [the DEV documents page](https://cdcp-dev.dev-dp.dts-stn.com/en/protected/documents).
   No sign-in is needed.
2. Select **Upload more documents** to open the upload form.
3. For French testing, switch the page language. The link is labelled
   **Téléverser plus de documents** in French.

Start each independent test from the documents page and select the upload link
again, rather than using a saved flow-specific page address. The application
creates a new form address.

The form uses the fixed mock user. It has no applicant or child selector.
Changing accounts or testing ineligible users is not part of this DEV setup.

### Prepare test files

Use harmless files with fictional content. Prepare:

| File | Use |
| --- | --- |
| A small, genuine PDF | Test one successful file |
| A small, genuine image | Test another supported format |
| Several different valid files | Test multiple selection |
| A valid file larger than the displayed limit | Test size validation |
| A harmless file with an unsupported extension, such as `.csv` | Test format validation |
| A plain-text file named exactly `mock-upload-failure.txt` | Test a repeatable mock upload failure |
| An unchanged copy of a selected file | Test duplicate detection |

For the failure test, ordinary text such as `Fictional upload test` is enough.
Check the full filename. It must be `mock-upload-failure.txt`, not
`mock-upload-failure.txt.txt`. Renaming a file extension does not make a genuine
file of that format.

The current defaults are **5 MB per file**, **10 files**, and these extensions:
`.pdf`, `.docx`, `.rtf`, `.xlsx`, `.pptx`, `.txt`, `.jpg`, `.jpeg`, `.png`,
`.gif`, `.bmp`, `.tif`, and `.tiff`. DEV settings can differ. Use the limits
shown on the page. The size limit applies to each file; the file count applies
to the selection, including files already uploaded in the current form. A file
at the configured size limit is accepted; use a larger file to test rejection.

### Control names

English labels below may help you find controls. French labels are shown in
parentheses:

- **Upload file** (**Ajouter un fichier**)
- **Document Type** (**Type de document**)
- **Submit** (**Soumettre**)
- **Submit remaining files** (**Soumettre les fichiers restants**)
- **View submission confirmation** (**Consulter la confirmation de soumission**)
- **Remove file** (**Supprimer le fichier**)

## Functional scenarios

Record the scenario ID when reporting a result. Expected results describe the
current mocked DEV experience, not real service processing.

### F-01 — Upload one or more valid files

1. Open the upload form using the steps above.
2. Select a valid PDF.
3. Choose a document type for that file.
4. Select **Submit**.
5. Repeat with several distinct valid files. Choose a type for each file before
   submitting.

**You should see:** Each selected filename and its type before submission.
After a successful mock response, the confirmation lists the uploaded filenames
and explains the next steps. Refreshing the finished confirmation shows it
again while the session remains valid.

### F-02 — Add, edit, and remove files

1. Select a valid file and choose its document type.
2. Select **Upload file** again and add another valid file.
3. Open the file picker again, then cancel it.
4. Change the type for one pending file.
5. Choose **Remove file** for a pending file. First cancel or dismiss the
   confirmation. Open it again and confirm removal.
6. Remove the remaining pending files.

**You should see:** Adding a file keeps earlier files and types. Cancelling the
picker changes nothing. Changing a type affects only that file. Cancelling
removal keeps the file; confirming removes it. Removing all pending files
returns the form to an empty selection. Check where keyboard focus goes after
each addition and removal.

### F-03 — Check validation and correct errors

Try each case from a fresh form, or keep one valid file selected to check that
an error does not discard other work:

| Case | Do this | You should see |
| --- | --- | --- |
| Empty selection | Select **Submit** with no files. | A message says a file is required. |
| Missing type | Add a valid file, leave its type unselected, then submit. | An error identifies the file that needs a type. |
| Unsupported extension | Try the harmless unsupported file. | The selection is rejected and the format guidance appears. |
| Oversized file | Try a file larger than the displayed per-file limit. | The selection is rejected and the size guidance appears. |
| File count | Fill the displayed limit, then try to add another distinct file. | The additional selection is rejected. Existing files remain. |
| Exact duplicate | Add the same unchanged file twice. | The second selection is rejected as a duplicate. |
| Same contents, different name | Try the same contents under a different name. | Matching contents alone do not make it a duplicate. |
| Same name, different contents | Try different contents with the same name. | Matching names alone do not make it a duplicate. |

A duplicate requires the same filename, size, and contents. Correct the reported
problem and check that you can continue without redoing unrelated work.

### F-04 — Repeat the mock upload failure

1. Select the exact file `mock-upload-failure.txt`.
2. Choose its document type and submit.
3. Submit again without changing the file.

**You should see:** The file has an upload error and remains pending. The
confirmation does not appear. The retry fails again. This exact filename always
triggers the mock failure; waiting or retrying will not make it succeed.

To recover, remove the failed file, select a valid file with a different
filename, choose its type, and submit.

### F-05 — Check partial success and recovery

1. Start a new form.
2. Select a valid PDF and `mock-upload-failure.txt`.
3. Choose a type for each file and submit.
4. Select **Submit remaining files** to retry.

**You should see:** The valid PDF is marked uploaded. The text file stays
pending with an error. The uploaded file has no edit or remove controls. There
is no final confirmation while a file is still pending. Retrying submits only
the pending file; the failure repeats and the PDF stays uploaded.

Now remove the failed file and confirm removal. When only the successful PDF
remains, select **View submission confirmation**.

**You should see:** The confirmation lists the PDF, not the removed failed file.

To test replacement instead, repeat the partial-success steps, remove the
failed file, add a valid file with a different filename, choose its type, and
submit. The confirmation lists the original PDF and the replacement. Do not
try to rename a file in the form; renaming there is not a supported action.

Uploaded files remain in the selection and count toward the displayed file
limit.

### F-06 — Leave, refresh, or close the form

1. Select a file but do not submit it.
2. Follow an in-app link to another page.
3. Choose to stay, then repeat and choose to leave.
4. Start again. Refresh the unfinished form and, if your browser asks, confirm
   the refresh.
5. Compare with an empty form and with an uploaded-only form.

**You should see:** With pending files, in-app navigation opens a warning.
Staying or dismissing it keeps the form and restores focus. Leaving continues
to the other page. Empty and uploaded-only forms do not show this in-app
warning.

The browser may show its own warning on refresh or tab close. This depends on
the browser. Reloading an unfinished form clears its displayed pending and
uploaded-file entries. In an integrated environment, this does not undo files
that were already submitted successfully.

### F-07 — Understand the mocked documents list

After a successful upload, open the documents list if it is part of your test.

**You should see:** The mock list keeps its fixed sample records. It does not
grow to include files uploaded in this test. This is a mock limitation, not
evidence that the upload failed. Some French sample document-type labels include
`[FR]`; record those as sample-data labels, separately from application text
that has not been translated.

### Tests that need coordination

Ask development or QA to arrange outages, timeouts, unexpected failures, scan
rejection, or controlled delays. Eligibility and ineligible-user checks require
a separately coordinated setup; they cannot be tested by switching accounts in
this fixed-user DEV environment. Do not assume these conditions have
tester-facing controls.

The upload mock detects EICAR antivirus-test content. Use it only through a
team-approved harmless fixture and procedure. Endpoint protection may block
the fixture. Do not create or use real malware or bypass security controls.

## Accessibility Office assessment

Use this section as an assessment aid, not as a compliance claim or a complete
certification plan. The Accessibility Office owns the applicable standard and
version, scope, methods, criteria mapping, and conformance decision.

### Record the test setup

Record the environment for each assessment. Identify the user as the fixed DEV
mock user and omit personal information.

| Setup item | Record |
| --- | --- |
| DEV build or version and test date | |
| DEV address or environment name | |
| Mock user (fixed DEV user, or a separately coordinated profile) | |
| Active mocks and any coordinated conditions | |
| Browser and version | |
| Operating system and version | |
| Assistive technology and version | |
| Language | |
| Viewport size and zoom, when relevant | |

### Assessment scenarios

For each scenario, record what happened. The expected accessible behaviour is
what to assess; it is not a claim that the current page already behaves this
way. Use the office’s chosen criteria and standard, if applicable.

| ID and journey | Repeatable steps | **EXPECTED ACCESSIBLE BEHAVIOUR TO ASSESS** | Actual result, evidence, and findings |
| --- | --- | --- | --- |
| A-01 — Keyboard journey (F-01, F-02, F-05) | Use only the keyboard. Select files, choose types, submit, recover from an error, and reach confirmation. | Every action is reachable in a sensible order. Focus is visible and does not get lost. Focus after adding or removing a file is useful. | |
| A-02 — Names and instructions (F-01, F-02) | Inspect the file picker trigger, each file, each type selector, and its instructions with a screen reader. | Controls have useful accessible names. Each type selector is tied to the right filename. Required status, accepted formats, size limit, and count limit can be found and understood. | |
| A-03 — Errors and recovery (F-03, F-04) | Try an empty submission, omit a type, and select an unsupported or oversized file. Correct each error. | Each error is identified, associated with the relevant field or file, announced, and explained in plain language. A person can find and correct it without losing unrelated work. | |
| A-04 — Dialogs (F-02, F-06) | Open file removal and the leave-page warning. Test initial focus, keyboard movement, Escape, cancel, and confirm. | Each dialog has a clear accessible name. Initial focus is useful; keyboard focus stays within an open dialog; Escape and cancel behave clearly; focus returns sensibly after dismissal. Confirming the action has a clear result. | |
| A-05 — Status and partial success (F-04, F-05) | Submit a valid file with the failure file. Listen during processing, success, failure, retry, removal, and completion. | Processing, success, and failure are announced and distinguishable. Status updates do not cause unnecessary focus movement. Uploaded and pending files are clearly grouped. Retry, remove, and finish actions are understandable. | |
| A-06 — Confirmation (F-01, F-05) | Complete a single-file and a partial-success journey. Inspect the confirmation with keyboard and assistive technology. | The confirmation has a clear heading, identifies submitted filenames, explains next steps, and offers understandable navigation. | |
| A-07 — Visual and responsive use (F-01, F-03) | Check contrast and colour use. Try a long filename, narrow viewport, browser zoom, and increased text spacing. | Text and controls remain readable and usable. Meaning does not depend on colour alone. Content reflows without loss, overlap, or unnecessary horizontal scrolling. Long filenames do not hide controls. | |
| A-08 — English and French (F-01, F-03, F-05) | Repeat key checks in both languages with the chosen assistive technology. | Page language, control names, instructions, errors, and status messages match the selected language and are pronounced meaningfully. Separate `[FR]` mock sample labels from application translation issues. | |

Mock responses can be too fast to assess processing announcements or disabled
controls reliably. Ask development or QA to arrange a controlled delay or
additional failure conditions. External-service behaviour and end-to-end
integration are outside this mocked assessment. Findings apply only to the
build and configuration tested.

### Result record

Copy this for each scenario:

```text
Scenario ID:
Result: Pass / Fail / Blocked / Not tested
Steps:
Expected result:
Actual result:
Environment, language, browser, operating system, and assistive technology:
Build/date, mock user, and mock conditions:
Evidence location (no personal information):
Can you repeat it? Steps to reproduce:
Applicable criterion, standard/version/level, and severity (as assessed by the office):
Finding type: Observed defect / Design suggestion / Mock limitation / Blocked
```

Mark a scenario **Blocked** if the fixture or environment behaviour
you need is unavailable. Keep observed defects, design suggestions, mock
limitations, and blocked scenarios separate in your report.
