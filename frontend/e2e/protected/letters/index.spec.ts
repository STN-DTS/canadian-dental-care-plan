import { expect, test } from '@playwright/test';

import { LettersPage } from '../../pages/letters-page';

test.describe('letters page', () => {
  test('should navigate to letters page', async ({ page }) => {
    await new LettersPage(page).goto();
    await expect(page).toHaveURL('/en/protected/letters');
  });

  test('it should sort letters oldest to newest', async ({ page }) => {
    const lettersPage = new LettersPage(page);
    await lettersPage.goto();
    await lettersPage.waitForHydration();

    await expect(lettersPage.sortOrder).toHaveValue('desc');
    await lettersPage.sortOrder.selectOption('asc');
    await expect(page).toHaveURL(/\/letters\?.*sort=asc/);
    await expect(lettersPage.sortOrder).toHaveValue('asc');
  });

  test('it should click on a pdf and successfully download', async ({ page }) => {
    // note: the default behaviour in the browser is to open the pdf in the tab
    // in chromium, however, this isn't the case. Instead, the pdf will fire a download event
    const lettersPage = new LettersPage(page);
    await lettersPage.goto();
    const download = await lettersPage.downloadFirstLetter();
    expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  });

  test('downloads the same letter when a new session has no cached list', async ({ page, browser, baseURL }) => {
    const lettersPage = new LettersPage(page);
    await lettersPage.goto();
    const href = await lettersPage.firstLetterHref();
    const cachedResponse = await lettersPage.downloadResponse(href);
    expect(cachedResponse.status()).toBe(200);
    expect(cachedResponse.headers()['content-type']).toContain('application/pdf');

    const freshContext = await browser.newContext({ baseURL });

    try {
      const uncachedResponse = await freshContext.request.get(href);
      expect(uncachedResponse.status()).toBe(200);
      expect(uncachedResponse.headers()['content-type']).toContain('application/pdf');
      expect(await uncachedResponse.body()).toEqual(await cachedResponse.body());
    } finally {
      await freshContext.close();
    }
  });
});
