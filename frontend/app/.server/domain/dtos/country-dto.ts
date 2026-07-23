/**
 * Represents a Data Transfer Object (DTO) for a country.
 */
export type CountryDto = Readonly<{
  /** Unique identifier for the country. */
  id: string;

  /** Country name in English. */
  nameEn: string;

  /** Country name in French. */
  nameFr: string;
}>;

/**
 * Represents a localized version of the Country DTO.
 * Inherits the country ID and provides a single localized name.
 */
export type CountryLocalizedDto = OmitStrict<CountryDto, 'nameEn' | 'nameFr'> &
  Readonly<{
    /** Localized name for the country. */
    name: string;
  }>;
