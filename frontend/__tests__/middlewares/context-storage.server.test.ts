import { RouterContextProvider } from 'react-router';

import { describe, expect, it, vi } from 'vitest';

import { AppError } from '~/errors/app-error';
import { contextStorageMiddleware, getContext, getRequest, getUrl } from '~/middlewares/context-storage.server';

function createMiddlewareArgs(urlValue = 'https://localhost:3000/en/protected/profile?return=documents'): Parameters<typeof contextStorageMiddleware>[0] {
  const context = new RouterContextProvider();
  const url = new URL(urlValue);
  const request = new Request(url, { method: 'POST' });

  return {
    context,
    params: {},
    request,
    url,
    pattern: '',
  };
}

function getThrownError(fn: () => unknown) {
  try {
    fn();
  } catch (error) {
    return error;
  }

  throw new Error('Expected function to throw');
}

describe('contextStorageMiddleware', () => {
  it('makes the current context, request, and url available inside the middleware chain', async () => {
    const response = new Response(null, { status: 204 });
    const args = createMiddlewareArgs();
    const next = vi.fn(async () => {
      await Promise.resolve();
      expect(getContext()).toBe(args.context);
      expect(getRequest()).toBe(args.request);
      expect(getUrl()).toBe(args.url);
      return response;
    });

    const result = await contextStorageMiddleware(args, next);

    expect(next).toHaveBeenCalledOnce();
    expect(result).toBe(response);
  });

  it('isolates stored values between concurrent middleware chains', async () => {
    const firstArgs = createMiddlewareArgs('https://localhost:3000/en/protected/documents');
    const secondArgs = createMiddlewareArgs('https://localhost:3000/fr/protected/letters');
    let releaseFirstMiddleware!: () => void;
    const waitForSecondMiddleware = new Promise<void>((resolve) => {
      releaseFirstMiddleware = resolve;
    });

    const firstNext = vi.fn(async () => {
      expect(getContext()).toBe(firstArgs.context);
      expect(getRequest()).toBe(firstArgs.request);
      expect(getUrl()).toBe(firstArgs.url);
      await waitForSecondMiddleware;
      expect(getContext()).toBe(firstArgs.context);
      expect(getRequest()).toBe(firstArgs.request);
      expect(getUrl()).toBe(firstArgs.url);
      return new Response('first');
    });

    const secondNext = vi.fn(async () => {
      expect(getContext()).toBe(secondArgs.context);
      expect(getRequest()).toBe(secondArgs.request);
      expect(getUrl()).toBe(secondArgs.url);
      releaseFirstMiddleware();
      await Promise.resolve();
      expect(getContext()).toBe(secondArgs.context);
      expect(getRequest()).toBe(secondArgs.request);
      expect(getUrl()).toBe(secondArgs.url);
      return new Response('second');
    });

    const [firstResponse, secondResponse] = await Promise.all([contextStorageMiddleware(firstArgs, firstNext), contextStorageMiddleware(secondArgs, secondNext)]);

    expect(firstResponse).toBeInstanceOf(Response);
    expect(secondResponse).toBeInstanceOf(Response);

    if (!(firstResponse instanceof Response) || !(secondResponse instanceof Response)) {
      throw new Error('Expected both middleware chains to return a Response');
    }

    expect(await firstResponse.text()).toBe('first');
    expect(await secondResponse.text()).toBe('second');
  });
});

describe('context storage getters', () => {
  it.each([
    ['getContext', getContext],
    ['getRequest', getRequest],
    ['getUrl', getUrl],
  ])('%s fails fast outside middleware context', (getterName, getter) => {
    const error = getThrownError(() => getter());

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({
      msg: `${getterName}() is only available while handling a request. Register contextStorageMiddleware on a parent route and call ${getterName}() from route middleware, loaders, or actions.`,
    });
  });
});
