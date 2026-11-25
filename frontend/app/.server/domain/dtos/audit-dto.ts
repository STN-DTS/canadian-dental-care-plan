/**
 * Audit metadata. Logging admits only an opaque `letterId` for `pdf.get`; other metadata is
 * omitted rather than serialized.
 */
export type AuditDetails = Readonly<{
  letterId?: string;
}>;

/**
 * Authentication audits may supply the opaque ID token subject as the actor.
 */
export type AuthenticationAuditDetails = Readonly<{
  userId?: string;
}>;
