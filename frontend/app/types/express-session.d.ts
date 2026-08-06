/**
 * Extends express-session's session data through TypeScript module augmentation.
 *
 * Session data remains compatible with arbitrary application-scoped values.
 */
import 'express-session';

declare module 'express-session' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface SessionData extends Record<string, unknown> {}
}
