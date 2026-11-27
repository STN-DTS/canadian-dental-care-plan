import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

import { BasePage } from './base-page';

export class PublicApplicationPage extends BasePage {
  readonly eligibilityHeading;
  readonly completedSections;

  constructor(page: Page) {
    super(page);
    this.eligibilityHeading = page.getByRole('heading', { level: 1, name: 'Before you start your application' });
    this.completedSections = page.getByText('1 out of 2 sections completed');
  }

  async goto() {
    await this.page.goto('/en/application');
    await this.waitForHydration();
  }

  async waitForEligibilityPage() {
    await this.page.clock.fastForward(1100);
    await expect(this.page).toHaveURL(/\/en\/application\/[^/]+\/eligibility-requirements$/);
  }

  async start() {
    await this.goto();
    await this.waitForEligibilityPage();
  }

  async acceptTermsAndConditions() {
    await this.page
      .getByRole('main')
      .getByRole('link', { name: /agree to the terms and conditions/i })
      .click();
    await this.page.getByRole('checkbox', { name: 'I have read, understood and agree to the Terms and Conditions.' }).check();
    await this.page.getByRole('checkbox', { name: 'I have read, understood and agree with the Privacy Notice Statement.' }).check();
    await this.page.getByRole('checkbox', { name: 'I consent to the sharing of the personal information provided.' }).check();
    await this.page.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(this.eligibilityHeading).toBeVisible();
    await expect(this.completedSections).toBeVisible();
  }
}
