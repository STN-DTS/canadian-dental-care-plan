import type { MiddlewareFunction, RouterContextProvider } from 'react-router';

import { AsyncLocalStorage } from 'node:async_hooks';

import { AppError } from '~/errors/app-error';

type ContextStorage = Readonly<{
  context: Readonly<RouterContextProvider>;
  request: Request;
  url: URL;
}>;

const contextStorage = new AsyncLocalStorage<ContextStorage>();

function getStore(getterName: string): ContextStorage {
  const store = contextStorage.getStore();

  if (!store) {
    throw new AppError(`${getterName}() is only available while handling a request. Register contextStorageMiddleware on a parent route and call ${getterName}() from route middleware, loaders, or actions.`);
  }

  return store;
}

/**
 * Stores the current RouterContextProvider, Request, and URL for the lifetime
 * of the current middleware chain.
 */
export const contextStorageMiddleware: MiddlewareFunction<Response> = async ({ context, request, url }, next) => {
  return await contextStorage.run({ context, request, url }, async () => await next());
};

export function getContext(): Readonly<RouterContextProvider> {
  return getStore('getContext').context;
}

export function getRequest(): Request {
  return getStore('getRequest').request;
}

export function getUrl(): URL {
  return getStore('getUrl').url;
}
