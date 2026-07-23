import type { ReadonlyDeep } from 'type-fest';

export type AddressCorrectionRequestEntity = Readonly<{
  address: string;
  city: string;
  postalCode: string;
  provinceCode: string;
}>;

export type AddressCorrectionResultEntity = ReadonlyDeep<{
  'wsaddr:CorrectionResults': {
    'nc:AddressFullText': string;
    'nc:AddressCityName': string;
    'can:ProvinceCode': string;
    'nc:AddressPostalCode': string;
    'wsaddr:Information': {
      'wsaddr:StatusCode': string;
    };
  };
}>;
