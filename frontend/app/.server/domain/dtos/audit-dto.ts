/**
 * Audit metadata. Logging admits only an opaque `letterId` for `pdf.get`; other metadata is
 * omitted rather than serialized. The audit service resolves the actor from the request user,
 * so callers cannot supply it.
 */
export type AuditDetails = Readonly<{
  letterId?: string;
}>;
