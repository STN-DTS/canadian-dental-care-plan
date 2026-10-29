import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

export function calculateDOB(age: number, date: Temporal.PlainDate = Temporal.Now.plainDateISO('UTC')): { year: string; month: string; day: string } {
  const birthdate = date.subtract({ years: age });
  const year = birthdate.year;
  const month = birthdate.month.toString().padStart(2, '0');
  const day = birthdate.day.toString().padStart(2, '0');

  return { year: year.toString(), month, day };
}

export async function clickContinue(page: Page) {
  const continueButton = page.getByRole('button', { name: 'Continue' });
  await expect(continueButton).toBeEnabled();
  await continueButton.click();
}
