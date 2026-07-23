/**
 * Represents the details associated with an audit event.
 */
export type AuditDetails = Readonly<
  Record<string, unknown> & {
    /** Optional identifier for the user associated with the audit event. */
    userId?: string;
  }
>;
