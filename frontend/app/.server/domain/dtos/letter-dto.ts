/**
 * Represents a Data Transfer Object (DTO) for a letter.
 */
export type LetterDto = Readonly<{
  /** Unique identifier for the letter. */
  id: string;

  /** Date of the letter. */
  date: string;

  /** Identifier of the letter type. */
  letterTypeId: string;
}>;

/**
 * Represents a Data Transfer Object (DTO) for a letters request.
 */
export type LettersRequestDto = Readonly<{
  /** Unique identifier for the client associated with the request. */
  clientId: string;

  /** A unique identifier for the user making the request - used for auditing */
  userId: string;

  /** Specifies the order in which letters should be sorted. */
  sortOrder: 'asc' | 'desc';
}>;

/**
 * Represents a Data Transfer Object (DTO) for a PDF request.
 */
export type PdfRequestDto = Readonly<{
  /** Unique identifier for the letter whose PDF is requested. */
  letterId: string;

  /** A unique identifier for the user making the request - used for auditing */
  userId: string;
}>;
