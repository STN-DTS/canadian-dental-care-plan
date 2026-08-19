/**
 * Represents a Data Transfer Object (DTO) describing whether a client is eligible
 * to upload appeal documents.
 */
export type AppealUploadEligibilityDto = Readonly<{
  /** Client GUID — needed downstream for the actual upload (esdc_clients(<id>)). */
  clientId: string;

  /** The client number the eligibility was looked up with. */
  clientNumber: string;

  /** Whether the client is permitted to upload appeal documents. */
  eligible: boolean;
}>;
