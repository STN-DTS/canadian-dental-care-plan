import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

export class BasePage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async isLoaded(url: string | RegExp, heading: string | RegExp) {
    await expect(this.page).toHaveURL(url);
    await expect(this.page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
  }

  /** Waits for React Router hydration so client-side event handlers and fetchers are active. */
  async waitForHydration() {
    await this.page.waitForFunction(() => {
      const routerWindow = window as typeof window & { __reactRouterDataRouter?: { state: { initialized: boolean } } };
      return routerWindow.__reactRouterDataRouter?.state.initialized === true;
    });
  }
}
