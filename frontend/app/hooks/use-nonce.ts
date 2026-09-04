import { use } from 'react';

import { NonceContext } from '~/components/nonce-context';

/**
 * Retrieves the current request's CSP nonce.
 *
 * @returns The server-provided nonce, or an empty string on the client.
 */
export function useNonce(): string {
  return use(NonceContext).nonce;
}
