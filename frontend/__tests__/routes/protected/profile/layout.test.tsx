import { describe, expect, it, vi } from 'vitest';

const { clientApplicationMiddleware } = vi.hoisted(() => ({
  clientApplicationMiddleware: vi.fn(),
}));

vi.mock(import('~/middlewares/client-application.server'), () => ({
  clientApplicationMiddleware,
}));

import { middleware } from '~/routes/protected/profile/layout';

describe('profile layout middleware', () => {
  it('resolves the client application', () => {
    expect(middleware).toEqual([clientApplicationMiddleware]);
  });
});
