import { keyFromSelector } from 'i18next';
import type { Namespace } from 'i18next';
import { vi } from 'vitest';

type SelectorFn = ($: Record<string, unknown>) => unknown;

function createMockT(ns?: Namespace) {
  /**
   * Mock translation function for testing purposes.
   * @returns The result of the keyFromSelector function.
   */
  return function mockT(selector: SelectorFn, options?: Record<string, unknown>) {
    const key = keyFromSelector(selector, Object.assign({}, options, ns ? { ns } : undefined));
    return options ? JSON.stringify({ key, options }) : key;
  };
}

/**
 * The vitest automock for react-i18next's useTranslation() hook.
 */
export const useTranslation = vi.fn((ns?: Namespace) => {
  const mockT = createMockT(ns);
  return {
    i18n: {
      getFixedT: () => mockT,
    },
    t: mockT,
  };
});

/**
 * The vitest automock for react-i18next's getI18n() function.
 */
export const getI18n = vi.fn(() => {
  const mockT = createMockT();
  return {
    i18n: {
      getFixedT: () => mockT,
    },
  };
});

/**
 * The vitest automock for react-i18next's Trans component.
 */
export const Trans = vi.fn(({ i18nKey, ns }: { i18nKey: SelectorFn; ns?: Namespace }) => {
  return keyFromSelector(i18nKey, ns ? { ns } : undefined);
});
