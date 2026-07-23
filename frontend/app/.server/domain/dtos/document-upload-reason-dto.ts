/**
 * Represents a Data Transfer Object (DTO) for a document upload reason.
 */
export type DocumentUploadReasonDto = Readonly<{
  /** Unique identifier for the document upload reason. */
  id: string;

  /** Document upload reason in English. */
  nameEn: string;

  /** Document upload reason in French. */
  nameFr: string;
}>;

/**
 * Represents a localized version of a document upload reason DTO.
 */
export type DocumentUploadReasonLocalizedDto = Omit<DocumentUploadReasonDto, 'nameEn' | 'nameFr'> &
  Readonly<{
    /** Localized name of the document upload reason. */
    name: string;
  }>;
