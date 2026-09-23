import { describe, expect, it } from 'vitest';

import { contextStorageMiddleware } from '~/middlewares/context-storage.server';
import { middleware } from '~/root';

describe('root route middleware', () => {
  it('registers context storage before descendant route middleware', () => {
    expect(middleware).toEqual([contextStorageMiddleware]);
  });
});
