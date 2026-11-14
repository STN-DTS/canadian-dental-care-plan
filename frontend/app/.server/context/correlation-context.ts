import type { RouterContextProvider } from 'react-router';
import { createContext } from 'react-router';

import { findContext } from '~/middlewares/context-storage.server';

export const correlationIdContext = createContext<string>('');

/**
 * Retrieves the current correlation ID from the context. If no context is provided, it falls back
 * to the current request's context, or an empty string outside a request scope.
 */
export function getCorrelationId(context?: Pick<Readonly<RouterContextProvider>, 'get'>): string {
  const ctx = context ?? findContext().valueOrUndefined;
  return ctx?.get(correlationIdContext) ?? '';
}
