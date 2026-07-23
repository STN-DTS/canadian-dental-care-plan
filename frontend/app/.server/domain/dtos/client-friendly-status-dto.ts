/**
 * Represents a Data Transfer Object (DTO) for a client friendly status.
 */
export type ClientFriendlyStatusDto = Readonly<{
  /** Unique identifier for the client friendly status. */
  id: string;

  /** Client friendly status name in English. */
  nameEn: string;

  /** Client friendly status name in French. */
  nameFr: string;
}>;

/**
 * Represents a Data Transfer Object (DTO) for a client friendly status with localized names.
 */
export type ClientFriendlyStatusLocalizedDto = OmitStrict<ClientFriendlyStatusDto, 'nameEn' | 'nameFr'> &
  Readonly<{
    /** Client friendly status name. */
    name: string;
  }>;
