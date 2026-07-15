import { createContext } from 'react';
import type { JSX, ReactNode } from 'react';

type NonceContextValue = {
  /**
   * The CSP nonce for this request.
   */
  nonce: string;
};

/**
 * Context for providing a CSP nonce value to components that render inline `<script>` or `<style>` elements.
 *
 * The nonce is generated once per request on the server and injected into the SSR HTML. After the browser
 * parses the page it immediately clears every nonce attribute to `""` (the HTML spec requires this to prevent
 * JavaScript from reading nonces via `getAttribute`). The context therefore defaults to `{ nonce: "" }` so
 * that React hydrates with the same empty-string value already present in the DOM, avoiding a hydration
 * attribute mismatch without needing `suppressHydrationWarning` on every nonce-bearing element.
 *
 * On the server the real nonce is supplied by `<NonceProvider>` (see `entry.server.tsx`).
 * On the client no provider is mounted, so the default empty string is used throughout.
 *
 * @see https://www.w3.org/TR/CSP3/#security-nonces (nonce hiding)
 */
export const NonceContext = createContext<NonceContextValue>({ nonce: '' });

type NonceProviderProps = {
  children?: ReactNode;

  /** The CSP nonce for this request. */
  nonce: string;
};

/**
 * Provides the per-request CSP nonce to the React tree during server-side rendering.
 * Should only be mounted in `entry.server.tsx` — the client relies on the context default (`""`).
 */
export function NonceProvider({ children, nonce }: NonceProviderProps): JSX.Element {
  return <NonceContext value={{ nonce }}>{children}</NonceContext>;
}
