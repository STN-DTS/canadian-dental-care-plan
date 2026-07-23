/**
 * Represents a Data Transfer Object (DTO) for a GC communication method.
 */
export type GCCommunicationMethodDto = Readonly<{
  /** Unique identifier for the communication method. */
  id: string;

  /** Unique code for the communication method. */
  code: string;

  /** Communication method name in English. */
  nameEn: string;

  /** Communication method name in French. */
  nameFr: string;
}>;

/**
 * Represents a localized version of the GCCommunicationMethod DTO.
 * Inherits the communication method ID and provides a single localized name.
 */
export type GCCommunicationMethodLocalizedDto = OmitStrict<GCCommunicationMethodDto, 'nameEn' | 'nameFr'> &
  Readonly<{
    /** Localized name for the communication method. */
    name: string;
  }>;
