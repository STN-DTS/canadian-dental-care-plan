import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

import { documentFile, uploadFailureName, uploadFlowUrl, waitForUploadRouter } from '../utils/document-upload';
import { BasePage } from './base-page';

export const uploadCopy = {
  en: {
    entry: '/en/protected/documents/upload',
    title: 'Submit documents',
    picker: 'Upload file',
    type: 'Document Type',
    submit: 'Submit',
    retry: 'Submit remaining files',
    review: 'Confirm submission',
    back: 'Back',
    remove: 'Remove file',
    removeTitle: 'Remove this file?',
    leaveTitle: 'Leave this page?',
    finish: 'View submission confirmation',
    uploaded: 'Files uploaded successfully',
    pending: 'Files not uploaded',
    success: 'Uploaded successfully',
    uploadedOn: 'Uploaded on:',
    selected: 'Files selected:',
    uploadedCount: 'Files uploaded:',
    pendingCount: 'Files not uploaded:',
    failure: 'An unexpected error occurred while uploading file "mock-upload-failure.txt". Try to upload your file again.',
  },
  fr: {
    entry: '/fr/protege/documents/televerser',
    title: 'Soumettre des documents',
    picker: 'Ajouter un fichier',
    type: 'Type de document',
    submit: 'Soumettre',
    retry: 'Soumettre les fichiers restants',
    review: 'Confirmer la soumission',
    back: 'Retour',
    remove: 'Supprimer le fichier',
    removeTitle: 'Supprimer ce fichier?',
    leaveTitle: 'Quitter cette page?',
    finish: 'Consulter la confirmation de soumission',
    uploaded: 'Fichiers téléversés avec succès',
    pending: 'Fichiers non téléversés',
    success: 'Téléversé avec succès',
    uploadedOn: 'Téléversé le\u00A0:',
    selected: 'Fichiers sélectionnés\u00A0:',
    uploadedCount: 'Fichiers téléversés\u00A0:',
    pendingCount: 'Fichiers non téléversés\u00A0:',
    failure: "Une erreur s'est produite lors du téléversement du fichier «\u00A0mock-upload-failure.txt\u00A0». Essayez de téléverser le fichier à nouveau.",
  },
} as const;

export class UploadPage extends BasePage {
  readonly locale;
  readonly copy;
  /** Opens the single-file native picker. */
  readonly uploadButton;
  /** Announces selection counts while pending files remain or the form is empty. */
  readonly status;
  readonly uploadedFiles;
  readonly pendingFiles;
  readonly submitButton;
  readonly reviewDialog;
  readonly removeDialog;
  readonly unsavedChangesDialog;
  readonly finishButton;

  /**
   * Binds upload locators to the isolated page supplied by the test fixture.
   * @param page - Playwright page owned and cleaned up by the built-in fixture.
   */
  constructor(page: Page, locale: keyof typeof uploadCopy = 'en') {
    super(page);
    this.locale = locale;
    this.copy = uploadCopy[locale];
    this.uploadButton = page.getByRole('button', { name: this.copy.picker, exact: true });
    this.status = page.getByRole('status');
    this.uploadedFiles = page.getByRole('list', { name: this.copy.uploaded, exact: true });
    this.pendingFiles = page.getByRole('list', { name: this.copy.pending, exact: true });
    this.submitButton = page.locator('#submit-button');
    this.reviewDialog = page.getByRole('dialog', { name: this.copy.review, exact: true });
    this.removeDialog = page.getByRole('dialog', { name: this.copy.removeTitle });
    this.unsavedChangesDialog = page.getByRole('dialog', { name: this.copy.leaveTitle });
    this.finishButton = page.getByRole('button', { name: this.copy.finish, exact: true });
  }

  /** Opens a fresh flow and waits for its URL, H1, and router initialization. */
  async goto() {
    await this.page.goto(this.copy.entry);
    await this.isLoaded(this.locale === 'en' ? uploadFlowUrl : /\/fr\/protege\/documents\/televerser\/[0-9a-f-]+$/, this.copy.title);
    await waitForUploadRouter(this.page);
  }

  /**
   * Locates a pending or uploaded item by its exact descendant filename text.
   * @param name - Filename identifying the item; duplicate names can match multiple items.
   * @returns A locator scoped to matching upload list items.
   */
  item(name: string) {
    return this.page.getByRole('listitem').filter({ has: this.page.getByText(name, { exact: true }) });
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
    await expect(this.item(payload.name)).toBeFocused();
    await expect(this.uploadButton).toBeEnabled();
  }

  /**
   * Changes the document type for a pending file.
   * @param name - Filename uniquely identifying the pending item.
   * @param type - Exact localized option label or zero-based index (first active type is 1).
   */
  async chooseType(name: string, type: string | number = 1) {
    await this.item(name)
      .getByRole('combobox', { name: this.copy.type })
      .selectOption(typeof type === 'string' ? { label: type } : { index: type });
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
    await this.item(name).getByRole('button', { name: this.copy.remove, exact: true }).click();
    await expect(this.removeDialog).toContainText(name);
    await this.removeDialog.getByRole('button', { name: this.copy.remove, exact: true }).click();
    await expect(this.item(name)).toHaveCount(0);
  }

  /** Opens the required upload review after clicking Submit or Submit remaining files. */
  async openReview() {
    await this.submitButton.click();
  }

  /** Dismisses an open upload review without changing the selected files. */
  async dismissReview() {
    await this.reviewDialog.getByRole('button', { name: this.copy.back, exact: true }).click();
  }

  /** Confirms an open upload review and sends the selected pending files. */
  async confirmReview() {
    await this.reviewDialog.getByRole('button', { name: this.copy.submit, exact: true }).click();
  }

  /** Completes review for a valid selection; callers still assert the resulting upload state. */
  async submit() {
    await this.openReview();
    await this.confirmReview();
  }

  /** Verifies the two visible outcome counters after a confirmed upload attempt. */
  async expectUploadCounts(uploaded: number, pending: number) {
    const counters = this.status.locator('p');
    await expect(counters).toHaveText([`${this.copy.uploadedCount} ${uploaded}`, `${this.copy.pendingCount} ${pending}`]);
    await expect(counters.nth(0)).toBeVisible();
    await expect(counters.nth(1)).toBeVisible();
  }

  /** Creates and verifies one successful upload and one mock-induced pending failure. */
  async partialUpload() {
    await this.addFile();
    await this.chooseType('evidence.txt');
    await this.addFile(documentFile(uploadFailureName));
    await this.chooseType(uploadFailureName);
    await this.submit();
    await expect(this.item('evidence.txt')).toContainText(this.copy.success);
    await expect(this.item(uploadFailureName)).toContainText(this.copy.failure);
    await this.expectUploadCounts(1, 1);
    await expect(this.submitButton).toHaveText(this.copy.retry);
    await expect(this.submitButton).toBeEnabled();
  }
}
