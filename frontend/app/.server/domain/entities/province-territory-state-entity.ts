export type ProvinceTerritoryStateEntity = Readonly<{
  esdc_provinceterritorystateid: string;
  _esdc_countryid_value: string;
  esdc_nameenglish: string;
  esdc_namefrench: string;
  esdc_internationalalphacode: string;
}>;

export type CountriesWithProvinceTerritoryStates = Readonly<{
  value: ReadonlyArray<{
    esdc_ProvinceTerritoryState_Countryid_esd: Readonly<ProvinceTerritoryStateEntity>;
  }>;
}>;
