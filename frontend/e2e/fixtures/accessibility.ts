import AxeBuilder from '@axe-core/playwright';
import { test as base, expect } from '@playwright/test';

type AccessibilityFixtures = {
  makeAxeBuilder: () => AxeBuilder;
  checkAccessibility: (state: string) => Promise<void>;
};

/**
 * Provides fresh, full-page axe scans without rule exclusions or suppressions.
 * Each scan attaches its complete results before asserting no detected violations.
 * Tests must establish the desired visible state before requesting a scan.
 * Automated scans supplement, but do not replace, keyboard and manual testing.
 */
export const test = base.extend<AccessibilityFixtures>({
  makeAxeBuilder: async ({ page }, use) => {
    await use(() => new AxeBuilder({ page }));
  },
  checkAccessibility: async ({ makeAxeBuilder }, use, testInfo) => {
    await use(async (state) => {
      const results = await makeAxeBuilder().analyze();
      await testInfo.attach(`accessibility-${state}`, {
        body: JSON.stringify(results, null, 2),
        contentType: 'application/json',
      });
      const violations = results.violations.map(({ id, impact, description, helpUrl, nodes }) => ({
        rule: id,
        impact,
        description,
        helpUrl,
        targets: nodes.map((node) => node.target),
      }));
      expect(violations, `Accessibility violations in ${state}`).toEqual([]);
    });
  },
});
