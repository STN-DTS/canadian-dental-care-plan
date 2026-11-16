import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

import { BasePage } from './base-page';

export const statusCheckerCopy = {
  en: {
    entry: '/en/status/myself',
    title: 'Status Checker',
    code: 'Application Code or Client Number',
    sin: 'Social Insurance Number (SIN)',
    submit: 'Check status',
    errorTitle: "We're having a problem with that page",
    correlationIdLabel: 'Correlation ID:',
  },
  fr: {
    entry: '/fr/etat/moi-meme',
    title: "Vérificateur de l'état",
    code: 'Code de demande ou numéro de client',
    sin: "Numéro d'assurance sociale (NAS)",
    submit: "Vérifier l'état",
    errorTitle: 'Nous éprouvons des difficultés avec cette page',
    correlationIdLabel: 'Identifiant de corrélation\u00A0:',
  },
} as const;

export type StatusCheckerLocale = keyof typeof statusCheckerCopy;

export interface StatusCheckFields {
  code: string;
  sin: string;
}

/** Localized status checker form for one applicant and the server error page it can lead to. */
export class StatusCheckerPage extends BasePage {
  readonly copy;
  readonly main;
  readonly codeInput;
  readonly sinInput;
  readonly submitButton;
  readonly errorHeading;
  /** The paragraph that announces the correlation ID; its `span` holds only the ID. */
  readonly correlationDetail;
  readonly correlationId;

  /**
   * Binds locators without navigating.
   * @param page - Isolated browser page supplied by the fixture.
   * @param locale - Language of the status checker route.
   */
  constructor(page: Page, locale: StatusCheckerLocale) {
    super(page);
    this.copy = statusCheckerCopy[locale];
    this.main = page.getByRole('main');
    this.codeInput = this.main.getByRole('textbox', { name: this.copy.code });
    this.sinInput = this.main.getByRole('textbox', { name: this.copy.sin });
    this.submitButton = this.main.getByRole('button', { name: this.copy.submit, exact: true });
    this.errorHeading = this.main.getByRole('heading', { level: 1, name: this.copy.errorTitle });
    this.correlationDetail = this.main.getByRole('paragraph').filter({ hasText: this.copy.correlationIdLabel });
    this.correlationId = this.correlationDetail.locator('span');
  }

  /**
   * Opens the form and, when JavaScript runs, waits for React Router so submissions go through the fetcher.
   * @param hydrate - False for no-JavaScript tests, where the form posts a document instead.
   */
  async goto({ hydrate }: { hydrate: boolean }) {
    await this.page.goto(this.copy.entry);
    await this.isLoaded(this.copy.entry, this.copy.title);

    if (hydrate) {
      await this.page.waitForFunction(() => {
        const routerWindow = window as typeof window & { __reactRouterDataRouter?: { state: { initialized: boolean } } };
        return routerWindow.__reactRouterDataRouter?.state.initialized === true;
      });
    }
  }

  async checkStatus({ code, sin }: StatusCheckFields) {
    await this.codeInput.fill(code);
    await this.sinInput.fill(sin);
    await this.submitButton.click();
  }

  /** Waits for the server error page and returns the correlation ID it shows. */
  async readCorrelationId() {
    await expect(this.errorHeading).toBeVisible();
    await expect(this.correlationId).toHaveText(/\S+/);
    return (await this.correlationId.textContent()) ?? '';
  }

  /**
   * Posts the form to the route's `.data` endpoint from the page, as the fetcher does,
   * so the browser sends the session cookie, CSRF token, and Sec-Fetch-Site header.
   */
  async postToDataEndpoint(fields: StatusCheckFields) {
    return await this.page.evaluate(
      async ({ entry, fields }) => {
        const csrfToken = document.querySelector<HTMLInputElement>('input[name="_csrf"]')?.value ?? '';
        const response = await fetch(`${entry}.data`, { method: 'POST', body: new URLSearchParams({ _csrf: csrfToken, ...fields }) });
        return { correlationId: response.headers.get('x-correlation-id') ?? '', body: await response.text() };
      },
      { entry: this.copy.entry, fields },
    );
  }
}
