import type { Page } from '@playwright/test';

import { BasePage } from './base-page';

/** Readiness and accessible locators for the English upload confirmation page. */
export class UploadSubmittedPage extends BasePage {
  readonly main;
  readonly receiptHeading;
  readonly submittedFiles;
  readonly delayNotice;
  readonly nextStepsHeading;
  readonly nextSteps;
  readonly returnLink;

  /**
   * Binds confirmation locators without navigating or changing the upload flow.
   * @param page - Isolated browser page supplied by the upload fixture.
   */
  constructor(page: Page) {
    super(page);
    this.main = page.getByRole('main');
    this.receiptHeading = this.main.getByRole('heading', { name: 'We received your documents', exact: true });
    this.submittedFiles = this.main.getByRole('list').first().getByRole('listitem');
    this.delayNotice = this.main.getByText('There could be a short delay with your documents appearing in your account.', { exact: true });
    this.nextStepsHeading = this.main.getByRole('heading', { name: 'Next steps', exact: true });
    this.nextSteps = this.main.getByRole('list').nth(1).getByRole('listitem');
    this.returnLink = this.main.getByRole('link', { name: 'Return to dashboard', exact: true });
  }

  /** Waits for the finished-flow confirmation URL and H1 using BasePage. */
  async waitForConfirmation() {
    await this.isLoaded(/\/submitted$/, 'Documents submitted');
  }
}
