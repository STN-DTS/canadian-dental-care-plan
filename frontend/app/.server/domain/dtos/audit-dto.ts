/**
 * Audit context. Logging admits only opaque `userId` and, for `pdf.get`, `letterId`;
 * other metadata is omitted rather than serialized.
 */
export type AuditDetails = Readonly<
  Record<string, unknown> & {
    /** Optional identifier for the user associated with the audit event. */
    userId?: string;
  }
>;
