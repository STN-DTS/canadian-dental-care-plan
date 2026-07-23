/**
 * Represents a Data Transfer Object (DTO) for a marital status.
 */
export type MaritalStatusDto = Readonly<{
  /** Unique identifier for the marital status. */
  id: string;

  /** Communication method name in English. */
  nameEn: string;

  /** Communication method name in French. */
  nameFr: string;
}>;

/**
 * Represents a localized version of the MaritalStatus DTO.
 * Inherits the marital status ID and provides a single localized name.
 */
export type MaritalStatusLocalizedDto = OmitStrict<MaritalStatusDto, 'nameEn' | 'nameFr'> &
  Readonly<{
    /** Localized name for the marital status. */
    name: string;
  }>;
