import { vi } from 'vitest';

export async function getFixedT() {
  return await Promise.resolve(vi.fn((i18nKey: string) => i18nKey));
}

export function getLocale() {
  return 'en';
}
