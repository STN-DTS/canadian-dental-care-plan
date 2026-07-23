export type CountryResponseEntity = Readonly<{
  value: ReadonlyArray<CountryEntity>;
}>;

export type CountryEntity = Readonly<{
  esdc_countryid: string;
  esdc_nameenglish: string;
  esdc_namefrench: string;
  esdc_countrycodealpha3: string;
}>;
