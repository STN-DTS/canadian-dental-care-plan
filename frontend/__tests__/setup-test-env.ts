import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';

import { afterEach, vi } from 'vitest';

if (process.env.TEMPORAL_EXPECT_POLYFILL === 'true') {
  const { Temporal, Intl } = await import('temporal-polyfill/implementation');
  globalThis.Temporal = Temporal;
  Object.defineProperty(globalThis.Intl, 'DateTimeFormat', { configurable: true, writable: true, value: Intl.DateTimeFormat });
}

vi.mock(import('react-i18next'));
vi.mock(import('~/.server/logging'));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
