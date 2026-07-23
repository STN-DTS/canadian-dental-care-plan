/**
 * Represents a Data Transfer Object (DTO) for a language.
 */
export type LanguageDto = Readonly<{
  /** Unique identifier for the language. */
  id: string;

  /** Unique code for the language. */
  code: string;

  /** Language name in English. */
  nameEn: string;

  /** Language name in French. */
  nameFr: string;
}>;

/**
 * Represents a localized version of the Language DTO.
 * Inherits the language ID and provides a single localized name.
 */
export type LanguageLocalizedDto = OmitStrict<LanguageDto, 'nameEn' | 'nameFr'> &
  Readonly<{
    /** Localized name for the language. */
    name: string;
  }>;
