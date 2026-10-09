import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

import { documentFile, uploadEntryUrl, uploadFailureName, uploadFlowUrl, waitForUploadRouter } from '../utils/document-upload';
import { BasePage } from './base-page';

/** Page object for the English document upload form. */
export class UploadPage extends BasePage {
  /** Opens the single-file native picker. */
  readonly uploadButton;
  /** Announces selection counts while pending files remain or the form is empty. */
  readonly status;
  readonly submitButton;
  readonly removeDialog;
  readonly unsavedChangesDialog;
  readonly finishButton;

  /**
   * Binds upload locators to the isolated page supplied by the test fixture.
   * @param page - Playwright page owned and cleaned up by the built-in fixture.
   */
  constructor(page: Page) {
    super(page);
    this.uploadButton = page.getByRole('button', { name: 'Upload file', exact: true });
    this.status = page.getByRole('status');
    this.submitButton = page.getByRole('button', { name: /^(Submit|Submit remaining files)$/ });
    this.removeDialog = page.getByRole('dialog', { name: 'Remove this file?' });
    this.unsavedChangesDialog = page.getByRole('dialog', { name: 'Leave this page?' });
    this.finishButton = page.getByRole('button', { name: 'View submission confirmation', exact: true });
  }

  /** Opens a fresh flow and waits for its URL, H1, and router initialization. */
  async goto() {
    await this.page.goto(uploadEntryUrl);
    await this.isLoaded(uploadFlowUrl, 'Submit documents');
    await waitForUploadRouter(this.page);
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
    await expect(this.removeDialog).toContainText(name);
    await this.removeDialog.getByRole('button', { name: 'Remove file', exact: true }).click();
    await expect(this.item(name)).toHaveCount(0);
  }

  /** Clicks Submit or Submit remaining files; callers must assert the outcome. */
  async submit() {
    await this.submitButton.click();
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
    await expect(this.submitButton).toHaveText('Submit remaining files');
    await expect(this.submitButton).toBeEnabled();
  }
}
