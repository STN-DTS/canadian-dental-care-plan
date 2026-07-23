/**
 * DTO for a Province, Territory, or State.
 */
export type ProvinceTerritoryStateDto = Readonly<{
  /* The unique identifier for the Province, Territory, or State. */
  id: string;

  /* The ID of the country that the Province, Territory, or State belongs to. */
  countryId: string;

  /* The English name of the Province, Territory, or State. */
  nameEn: string;

  /* The French name of the Province, Territory, or State. */
  nameFr: string;

  /* The abbreviation of the Province, Territory, or State. */
  abbr: string;
}>;

/**
 * DTO for a Province, Territory, or State with a localized name.
 */
export type ProvinceTerritoryStateLocalizedDto = OmitStrict<ProvinceTerritoryStateDto, 'nameEn' | 'nameFr'> & {
  /* The localized name of the Province, Territory, or State. */
  name: string;
};
