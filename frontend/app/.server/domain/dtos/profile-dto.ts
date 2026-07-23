export type UpdateCommunicationPreferenceRequestDto = Readonly<{
  clientId: string;
  preferredLanguage: string;
  preferredMethodSunLife: string;
  preferredMethodGovernmentOfCanada: string;
}>;

export type UpdateDentalBenefitsRequestDto = Readonly<{
  clientId: string;
  hasFederalBenefits: boolean;
  federalSocialProgram?: string;
  hasProvincialTerritorialBenefits: boolean;
  provincialTerritorialSocialProgram?: string;
  province?: string;
}>;

export type UpdateEmailAddressRequestDto = Readonly<{
  clientId: string;
  email: string;
}>;

export type UpdatePhoneNumbersRequestDto = Readonly<{
  clientId: string;
  phoneNumber?: string;
  phoneNumberAlt?: string;
}>;

export type UpdateAddressRequestDto = Readonly<{
  clientId: string;
  mailingAddress: {
    address: string;
    city: string;
    countryId: string;
    postalZipCode?: string;
    provinceStateId?: string;
  };
  homeAddress: {
    address: string;
    city: string;
    countryId: string;
    postalZipCode?: string;
    provinceStateId?: string;
  };
}>;
