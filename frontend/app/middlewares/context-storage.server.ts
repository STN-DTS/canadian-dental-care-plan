import type { MiddlewareFunction, RouterContextProvider } from 'react-router';

import { AsyncLocalStorage } from 'node:async_hooks';

import { AppError } from '~/errors/app-error';

/** Request-scoped routing values preserved for the current middleware chain. */
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
 * Establishes request-scoped `AsyncLocalStorage` for the current React Router
 * middleware chain.
 *
 * Register this middleware on a parent or root route so descendant middleware,
 * loaders, and actions can read the current router context, request, and URL.
 */
export const contextStorageMiddleware: MiddlewareFunction<Response> = async ({ context, request, url }, next) => {
  return await contextStorage.run({ context, request, url }, async () => await next());
};

/**
 * Returns the current request's `RouterContextProvider`.
 *
 * @throws {AppError} When called outside an active request scope established by
 * `contextStorageMiddleware`.
 */
export function getContext(): Readonly<RouterContextProvider> {
  return getStore('getContext').context;
}

/**
 * Returns the current request.
 *
 * @throws {AppError} When called outside an active request scope established by
 * `contextStorageMiddleware`.
 */
export function getRequest(): Request {
  return getStore('getRequest').request;
}

/**
 * Returns the current parsed request URL.
 *
 * @throws {AppError} When called outside an active request scope established by
 * `contextStorageMiddleware`.
 */
export function getUrl(): URL {
  return getStore('getUrl').url;
}
