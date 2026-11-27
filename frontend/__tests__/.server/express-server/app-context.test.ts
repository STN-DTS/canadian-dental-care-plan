import type express from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { getAppContext } from '~/.server/express-server/app-context';

vi.mock('~/.server/app-container', () => ({ appContainer: vi.fn(() => ({ get: vi.fn() })) }));

describe('getAppContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not mutate the session for every request', () => {
    const request = mock<express.Request>();

    getAppContext(request);

    expect(request.session).not.toHaveProperty('lastAccessTime');
  });
});
