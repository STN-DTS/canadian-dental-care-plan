/**
 * Describes whether a CDCP client accessing MSCA may upload evidentiary
 * documentation.
 *
 * Eligibility requires the client's profile to have at least one application
 * paused due to a T4 mismatch.
 */
export type AppealUploadEligibilityDto = Readonly<{
  /** Client GUID used by downstream document-upload operations. */
  clientId: string;

  /** Client number used to perform the eligibility lookup. */
  clientNumber: string;

  /** Whether the client may upload evidentiary documentation. */
  canUploadAppealDocuments: boolean;
}>;
