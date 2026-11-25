/**
 * Audit metadata. The opaque `userId` is admitted only for authentication events, and
 * `letterId` only for `pdf.get`; other metadata is omitted rather than serialized.
 */
export type AuditDetails = Readonly<{
  letterId?: string;
  userId?: string;
}>;
