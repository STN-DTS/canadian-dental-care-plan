import { vi } from 'vitest';

import type { Logger } from '~/.server/logging';

export const createLogger = vi.fn(() => {
  return {
    audit: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    trace: vi.fn(),
    warn: vi.fn(),
  } satisfies Logger;
});
