/**
 * Represents a Data Transfer Object (DTO) for a letter type.
 */
export type LetterTypeDto = Readonly<{
  /** Unique identifier for the letter type. */
  id: string;

  /** Letter type in English. */
  nameEn: string;

  /** Letter type in French. */
  nameFr: string;
}>;

/**
 * Represents a localized version of a letter type DTO.
 */
export type LetterTypeLocalizedDto = Omit<LetterTypeDto, 'nameEn' | 'nameFr'> &
  Readonly<{
    /** Localized name of the letter type. */
    name: string;
  }>;
