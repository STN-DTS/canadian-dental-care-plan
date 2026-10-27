# Document upload DEV testing and accessibility assessment guide

Use this guide to test the document upload form in DEV with mock services.
It is for designers, product owners, business analysts, and the Accessibility
Office.

Use the [technical reference](./document-upload-feature.md) for implementation
details. The Accessibility Office decides how to assess the form and whether
it meets a standard.

## Shared setup

### What this DEV test can show

DEV mocks simulate service responses. These tests cover the form's display
and controls. They do not verify real security scanning, document storage,
downstream processing, or external-service accessibility.

DEV uses one fixed mock user with access to document upload only. You do not
need to sign in or get a test account. Sign-in, account selection, and other
application features are outside this guide.

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

Start each independent test from the documents page and select the upload link.
This creates a new upload form with its own address. Do not reuse a saved form
address.

The form has no applicant or child selector. This DEV setup does not support
switching accounts or testing ineligible users.

### Prepare test files

Use harmless files with fictional content. Prepare:

| File                                                          | Use                                   |
| ------------------------------------------------------------- | ------------------------------------- |
| A small, genuine PDF                                          | Test one successful file              |
| A small, genuine image                                        | Test another supported format         |
| Several different valid files                                 | Test multiple selection               |
| A valid file larger than the displayed limit                  | Test size validation                  |
| A harmless file with an unsupported extension, such as `.csv` | Test format validation                |
| A plain-text file named exactly `mock-upload-failure.txt`     | Test a repeatable mock upload failure |
| An unchanged copy of a selected file                          | Test duplicate detection              |

For the failure test, ordinary text such as `Fictional upload test` is enough.
Check the full filename. It must be `mock-upload-failure.txt`, not
`mock-upload-failure.txt.txt`. Renaming a file extension does not make a genuine
file of that format.

The default limits are 5 MB per file and 10 files. The allowed extensions are:
`.pdf`, `.docx`, `.rtf`, `.xlsx`, `.pptx`, `.txt`, `.jpg`, `.jpeg`, `.png`,
`.gif`, `.bmp`, `.tif`, and `.tiff`. DEV settings can differ. Use the limits
shown on the page. The file count includes files already uploaded in the current
form. A file at the size limit passes size validation. Use a larger file to test
rejection.

### Control names

Use these labels to find the controls in either language:

| English                      | French                                  |
| ---------------------------- | --------------------------------------- |
| Upload file                  | Ajouter un fichier                      |
| Document Type                | Type de document                        |
| Submit                       | Soumettre                               |
| Submit remaining files       | Soumettre les fichiers restants         |
| View submission confirmation | Consulter la confirmation de soumission |
| Remove file                  | Supprimer le fichier                    |

## Functional scenarios

Record the scenario ID with each result. The expected results below describe
DEV mock responses, not real service processing.

### F-01. Upload one or more valid files

1. Open the upload form using the steps above.
2. Select a valid PDF.
3. Choose a document type for that file.
4. Select **Submit**.
5. Repeat with several distinct valid files. Choose a type for each file before
   submitting.

Before submission, check that each file shows its filename and type.
After a successful mock response, the confirmation should list the uploaded filenames
and explain the next steps. Refreshing the finished confirmation shows it
again while the session remains valid.

### F-02. Add, edit, and remove files

1. Select a valid file and choose its document type.
2. Select **Upload file** again and add another valid file.
3. Open the file picker again, then cancel it.
4. Change the type for one pending file.
5. Choose **Remove file** for a pending file. First cancel or dismiss the
   confirmation. Open it again and confirm removal.
6. Remove the remaining pending files.

Check that adding a file keeps earlier files and types. Cancelling the picker
should change nothing, and changing a type should affect only that file.
Cancelling removal should keep the file. Confirming removal should remove it.
After you remove all pending files, the form should show an empty selection.
Check where keyboard focus goes after each addition and removal.

### F-03. Check validation and correct errors

Try each case from a fresh form, or keep one valid file selected to check that
an error does not discard other work:

| Case                          | Do this                                                          | You should see                                               |
| ----------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------ |
| Empty selection               | Select **Submit** with no files.                                 | A message says a file is required.                           |
| Missing type                  | Add a valid file, leave its type unselected, then submit.        | An error identifies the file that needs a type.              |
| Unsupported extension         | Try the harmless unsupported file.                               | The selection is rejected and the format guidance appears.   |
| Oversized file                | Try a file larger than the displayed per-file limit.             | The selection is rejected and the size guidance appears.     |
| File count                    | Fill the displayed limit, then try to add another distinct file. | The additional selection is rejected. Existing files remain. |
| Exact duplicate               | Add the same unchanged file twice.                               | The second selection is rejected as a duplicate.             |
| Same contents, different name | Try the same contents under a different name.                    | Matching contents alone do not make it a duplicate.          |
| Same name, different contents | Try different contents with the same name.                       | Matching names alone do not make it a duplicate.             |

A duplicate requires the same filename, size, and contents. Correct the reported
problem and check that you can continue without redoing unrelated work.

### F-04. Repeat the mock upload failure

1. Select the exact file `mock-upload-failure.txt`.
2. Choose its document type and submit.
3. Submit again without changing the file.

The file should show an upload error and stay pending. The form should not show
confirmation. Retrying should fail again because this filename always triggers
the mock failure.

To recover, remove the failed file, select a valid file with a different
filename, choose its type, and submit.

### F-05. Check partial success and recovery

1. Start a new form.
2. Select a valid PDF and `mock-upload-failure.txt`.
3. Choose a type for each file and submit.
4. Select **Submit remaining files** to retry.

The form should mark the PDF as uploaded, with no edit or remove controls.
The text file should stay pending with an error. The form should not show
confirmation while a file is pending. Retrying should submit only the pending
file. The failure should repeat, and the PDF should stay uploaded.

Now remove the failed file and confirm removal. When only the successful PDF
remains, select **View submission confirmation**.

The confirmation should list the PDF, not the removed failed file.

To test replacement instead, repeat the partial-success steps, remove the
failed file, add a valid file with a different filename, choose its type, and
submit. The confirmation should list the original PDF and the replacement.
The form does not support renaming files.

Uploaded files remain in the selection and count toward the displayed file
limit.

### F-06. Leave, refresh, or close the form

1. Select a file but do not submit it.
2. Follow an in-app link to another page.
3. Choose to stay, then repeat and choose to leave.
4. Start again. Refresh the unfinished form and, if your browser asks, confirm
   the refresh.
5. Compare with an empty form and with an uploaded-only form.

With pending files, in-app navigation should open a warning. Staying or
dismissing the warning should keep the form and restore focus. Leaving should
open the other page. Empty forms and forms with only uploaded files should not
show this warning.

The browser may show its own warning on refresh or tab close. This depends on
the browser. Reloading an unfinished form should clear its displayed pending
and uploaded-file entries. With real services, this does not undo successful
uploads.

### F-07. Understand the mocked documents list

After a successful upload, open the documents list if it is part of your test.

The list should show the same fixed sample records after the upload. The mock
does not add uploaded files to the list, so their absence does not mean the
upload failed. Some French sample document-type labels include `[FR]`. Record
these separately from untranslated application text.

### Tests that need coordination

Ask development or QA to arrange outages, timeouts, unexpected failures, scan
rejections, or delays. Testers cannot trigger all of these conditions through
the form. Eligibility checks need a separate setup because DEV uses a fixed
user.

The upload mock detects EICAR antivirus-test content. Use it only through a
team-approved harmless fixture and procedure. Endpoint protection may block
the fixture. Do not create or use real malware or bypass security controls.

The expected result is a security-check message asking you to choose a different
file, not the generic retry message shown for `mock-upload-failure.txt`. Other
files successfully uploaded in the same submission remain uploaded.

## Accessibility Office assessment

Use these scenarios to support the Accessibility Office's assessment. They do
not establish compliance or provide a complete certification plan. The office
chooses the standard and version, scope, methods, and criteria, and decides
whether the form conforms.

### Record the test setup

Record the environment for each assessment. Identify the user as the fixed DEV
mock user and omit personal information.

| Setup item                                                            | Record |
| --------------------------------------------------------------------- | ------ |
| DEV build or version and test date                                    |        |
| DEV address or environment name                                       |        |
| Mock user, either the fixed DEV user or a separately arranged profile |        |
| Active mocks and any coordinated conditions                           |        |
| Browser and version                                                   |        |
| Operating system and version                                          |        |
| Assistive technology and version                                      |        |
| Language                                                              |        |
| Viewport size and zoom, when relevant                                 |        |

### Assessment scenarios

Record what happened in each scenario and compare it with the expected
accessible behaviour. These expectations are assessment criteria, not verified
results. Use the office's chosen criteria and standard.

| ID and journey                               | Repeatable steps                                                                                                       | Expected accessible behaviour                                                                                                                                                                                              | Actual result, evidence, and findings |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| A-01. Keyboard journey. F-01, F-02, F-05     | Use only the keyboard. Select files, choose types, submit, recover from an error, and reach confirmation.              | Users can reach every action in a sensible order. Focus stays visible. After a file is added or removed, focus moves to a control or status that helps the user continue.                                                  |                                       |
| A-02. Names and instructions. F-01, F-02     | Inspect the file picker button, each file, each type selector, and its instructions with a screen reader.              | Controls have accessible names that describe their actions. Each type selector identifies its file. Users can find the required fields, accepted formats, size limit, and count limit.                                     |                                       |
| A-03. Errors and recovery. F-03, F-04        | Try an empty submission, omit a type, and select an unsupported or oversized file. Correct each error.                 | Each error identifies the relevant field or file. The screen reader announces it, and the message explains how to correct it. Users can fix errors without losing other work.                                              |                                       |
| A-04. Dialogs. F-02, F-06                    | Open file removal and the leave-page warning. Test initial focus, keyboard movement, Escape, cancel, and confirm.      | Each dialog has an accessible name that describes its purpose. Focus starts on a relevant control and stays inside the open dialog. Escape and cancel dismiss it and restore focus. Confirming performs the stated action. |                                       |
| A-05. Status and partial success. F-04, F-05 | Submit a valid file with the failure file. Listen during processing, success, failure, retry, removal, and completion. | The screen reader announces processing, success, and failure as distinct states. Updates do not move focus unnecessarily. The form separates uploaded and pending files and explains how to retry, remove, or finish.      |                                       |
| A-06. Confirmation. F-01, F-05               | Complete a single-file and a partial-success journey. Inspect the confirmation with keyboard and assistive technology. | The confirmation identifies submitted filenames, explains next steps, and provides navigation with descriptive labels. Its heading describes the page.                                                                     |                                       |
| A-07. Visual and responsive use. F-01, F-03  | Check contrast and colour use. Try a long filename, narrow viewport, browser zoom, and increased text spacing.         | Users can read text and operate controls. Meaning does not depend on colour alone. Content reflows without loss, overlap, or unnecessary horizontal scrolling. Long filenames do not hide controls.                        |                                       |
| A-08. English and French. F-01, F-03, F-05   | Repeat key checks in both languages with the chosen assistive technology.                                              | Page language, control names, instructions, errors, and statuses match the selected language. The screen reader uses that language. Record `[FR]` mock sample labels separately from application translation issues.       |                                       |

If mock responses finish before you can assess processing announcements or
disabled controls, ask development or QA to add a delay. Ask them to arrange
other failure conditions as needed. This assessment does not test external
services or end-to-end integration. Findings apply only to the tested build and
configuration.

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

Mark a scenario as Blocked if the required test file or environment condition
is unavailable. Report observed defects, design suggestions, mock limitations,
and blocked scenarios separately.
