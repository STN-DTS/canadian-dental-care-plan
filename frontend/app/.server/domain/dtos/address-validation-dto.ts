/**
 * Represents a Data Transfer Object (DTO) for an address correction request.
 */
export type AddressCorrectionRequestDto = Readonly<{
  /** The full or partial address. */
  address: string;

  /** The name of the city. */
  city: string;

  /** The 6-character postal code. */
  postalCode: string;

  /** The 2-character Canadian province or territorial code. */
  provinceCode: string;

  /** A unique identifier for the user making the request - used for auditing */
  userId: string;
}>;

/**
 * Represents a Data Transfer Object (DTO) for an address correction result.
 */
export type AddressCorrectionResultDto = Readonly<{
  /** The status of the address correction. */
  status: 'corrected' | 'not-correct' | 'valid' | 'service-unavailable';

  /** The full or partial address. */
  address: string;

  /** The name of the city. */
  city: string;

  /** The 6-character postal code. */
  postalCode: string;

  /** The 2-character Canadian province or territorial code. */
  provinceCode: string;
}>;

/**
 * Represents the possible statuses for an address correction result.
 */
export type AddressCorrectionStatus = AddressCorrectionResultDto['status'];
