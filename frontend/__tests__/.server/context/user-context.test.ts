import { RouterContextProvider } from 'react-router';

import { Option } from 'effect';
import { describe, expect, it } from 'vitest';

import type { UserContext } from '~/.server/context/user-context';
import { findUser, getUser, userContext } from '~/.server/context/user-context';
import { ErrorCodes } from '~/errors/error-codes';
import { contextStorageMiddleware } from '~/middlewares/context-storage.server';

const user: UserContext = { id: 'user-123', mocked: false, sin: '000000000' };

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

describe('findUser', () => {
  it('returns the user from an explicit context', () => {
    const context = new RouterContextProvider();
    context.set(userContext, user);

    expect(findUser(context)).toEqual(Option.some(user));
  });

  it('returns the user from the ambient request context', async () => {
    const context = new RouterContextProvider();
    context.set(userContext, user);

    await expect(runInRequestScope(context, () => findUser())).resolves.toEqual(Option.some(user));
  });

  it('returns none when the request context has no user', async () => {
    await expect(runInRequestScope(new RouterContextProvider(), () => findUser())).resolves.toEqual(Option.none());
  });

  it('returns none outside a request scope', () => {
    expect(findUser()).toEqual(Option.none());
  });
});

describe('getUser', () => {
  it('throws PLT_CTX_USER_UNAVAILABLE when the context has no user', () => {
    expect(() => getUser(new RouterContextProvider())).toThrow(expect.objectContaining({ errorCode: ErrorCodes.PLT_CTX_USER_UNAVAILABLE }));
  });

  it('throws PLT_CTX_REQUEST_STORE_UNAVAILABLE outside a request scope', () => {
    expect(() => getUser()).toThrow(expect.objectContaining({ errorCode: ErrorCodes.PLT_CTX_REQUEST_STORE_UNAVAILABLE }));
  });
});
