import { vi } from 'vitest';

export const getFixedT = vi.fn(async () => {
  return await Promise.resolve(vi.fn((i18nKey: string) => i18nKey));
});

export const getLocale = vi.fn(() => {
  return 'en';
});
