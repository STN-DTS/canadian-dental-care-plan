import type { APIResponse, Download, Page } from '@playwright/test';

import { BasePage } from './base-page';

export class LettersPage extends BasePage {
  readonly main;
  readonly sortOrder;
  readonly firstLetterLink;

  constructor(page: Page) {
    super(page);
    this.main = page.getByRole('main');
    this.sortOrder = page.getByRole('combobox', { name: 'filter by' });
    this.firstLetterLink = this.main.getByRole('listitem').first().getByRole('link');
  }

  async goto(locale: 'en' | 'fr' = 'en') {
    await this.page.goto(locale === 'en' ? '/en/protected/letters' : '/fr/protege/lettres');
  }

  async downloadFirstLetter(): Promise<Download> {
    const downloadPromise = this.page.waitForEvent('download');
    await this.firstLetterLink.click();
    return await downloadPromise;
  }

  async firstLetterHref(): Promise<string> {
    const href = await this.firstLetterLink.getAttribute('href');

    if (!href) {
      throw new Error('Expected a letter download link');
    }

    return href;
  }

  async downloadResponse(href: string): Promise<APIResponse> {
    return await this.page.request.get(href);
  }
}
