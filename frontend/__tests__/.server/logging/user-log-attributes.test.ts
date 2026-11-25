import { RouterContextProvider } from 'react-router';

import { describe, expect, it } from 'vitest';

import { userContext } from '~/.server/context/user-context';
import { ATTR_CDCP_USER_ID } from '~/.server/logging/log-attributes';
import { userLogAttributes } from '~/.server/logging/user-log-attributes';
import { contextStorageMiddleware } from '~/middlewares/context-storage.server';

async function runInRequestScope<T>(context: RouterContextProvider, fn: () => T): Promise<T> {
  let result!: T;
  const url = new URL('https://localhost:3000/en/protected/profile');
  await contextStorageMiddleware({ context, params: {}, request: new Request(url), url, pattern: '' }, async () => {
    await Promise.resolve();
    result = fn();
    return new Response();
  });
  return result;
}

describe('userLogAttributes', () => {
  it('returns the request user ID', async () => {
    const context = new RouterContextProvider();
    context.set(userContext, { id: 'user-123', mocked: false, sin: '000000000' });

    await expect(runInRequestScope(context, () => userLogAttributes())).resolves.toEqual({ [ATTR_CDCP_USER_ID]: 'user-123' });
  });

  it('returns no attributes when the request has no user', async () => {
    await expect(runInRequestScope(new RouterContextProvider(), () => userLogAttributes())).resolves.toEqual({});
  });

  it('returns no attributes outside a request scope', () => {
    expect(userLogAttributes()).toEqual({});
  });
});
