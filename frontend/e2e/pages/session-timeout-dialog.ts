import type { Locator, Page, Request, Response } from '@playwright/test';

export type TimeoutLocale = 'en' | 'fr';

export class SessionTimeoutDialog {
  readonly page: Page;
  readonly dialog: Locator;
  readonly continueButton: Locator;
  readonly endButton: Locator;

  constructor(page: Page, locale: TimeoutLocale) {
    this.page = page;
    this.dialog = page.getByRole('dialog');
    this.continueButton = this.dialog.getByRole('button', { name: locale === 'en' ? 'Continue session' : 'Continuer la session' });
    this.endButton = this.dialog.getByRole('button', { name: locale === 'en' ? 'End session now' : 'Mettre fin à la session' });
  }

  async waitForPrompt() {
    await this.dialog.waitFor({ state: 'visible' });
  }

  async extend(): Promise<Response> {
    const responsePromise = this.page.waitForResponse((response) => this.isSessionRequest(response.request()) && response.request().method() === 'POST');
    await this.continueButton.click();
    return await responsePromise;
  }

  async endPublic(): Promise<Request> {
    const requestPromise = this.page.waitForRequest((request) => this.isSessionRequest(request) && request.method() === 'POST');
    await this.endButton.click();
    return await requestPromise;
  }

  async endProtected(): Promise<Request> {
    const requestPromise = this.page.waitForRequest((request) => /^\/auth\/logout(?:\.data)?$/.test(new URL(request.url()).pathname));
    await this.endButton.click();
    return await requestPromise;
  }

  async dismissWithEscape(): Promise<Response> {
    const responsePromise = this.page.waitForResponse((response) => this.isSessionRequest(response.request()) && response.request().method() === 'POST');
    await this.page.keyboard.press('Escape');
    return await responsePromise;
  }

  private isSessionRequest(request: Request) {
    return /\/api\/session(?:\.data)?$/.test(new URL(request.url()).pathname);
  }
}
