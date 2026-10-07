/**
 * Represents a Data Transfer Object (DTO) for a record source.
 */
export type RecordSourceDto = Readonly<{
  /** Unique identifier for the record source. */
  id: string;

  /** Record source name in English. */
  nameEn: string;

  /** Record source name in French. */
  nameFr: string;
}>;

/**
 * Represents a localized version of the RecordSource DTO.
 * Inherits the record source ID and provides a single localized name.
 */
export type RecordSourceLocalizedDto = OmitStrict<RecordSourceDto, 'nameEn' | 'nameFr'> &
  Readonly<{
    /** Localized name for the record source. */
    name: string;
  }>;
