import { describe, expect, it } from 'vitest';

import type { UpdateAddressRequestDto, UpdateCommunicationPreferenceRequestDto, UpdateDentalBenefitsRequestDto, UpdateEmailAddressRequestDto, UpdatePhoneNumbersRequestDto } from '~/.server/domain/dtos';
import type { UpdateAddressRequestEntity, UpdateCommunicationPreferenceRequestEntity, UpdateDentalBenefitsRequestEntity, UpdateEmailAddressRequestEntity, UpdatePhoneNumbersRequestEntity } from '~/.server/domain/entities';
import { DefaultProfileDtoMapper } from '~/.server/domain/mappers';

const mapper = new DefaultProfileDtoMapper();

describe('mapUpdateDentalBenefitsRequestDtoToUpdateDentalBenefitsRequestEntity', () => {
  it('should map UpdateDentalBenefitsRequestDto to UpdateDentalBenefitsRequestEntity', () => {
    const mockDentalBenefitsEntity: UpdateDentalBenefitsRequestEntity = {
      BenefitApplication: {
        Applicant: {
          ApplicantDetail: {
            InsurancePlan: [
              {
                InsurancePlanFederalIdentification: { IdentificationID: 'FEDERAL-PLAN-001' },
                InsurancePlanProvincialIdentification: { IdentificationID: 'PROVINCIAL-PLAN-002' },
              },
            ],
          },
          ClientIdentification: [
            {
              IdentificationID: '123456789',
              IdentificationCategoryText: 'Guid Primary Key',
            },
          ],
        },
      },
    };
    const expectedDentalBenefitsDto: UpdateDentalBenefitsRequestDto = {
      clientId: '123456789',
      hasFederalBenefits: true,
      federalSocialProgram: 'FEDERAL-PLAN-001',
      hasProvincialTerritorialBenefits: true,
      provincialTerritorialSocialProgram: 'PROVINCIAL-PLAN-002',
      province: 'ON',
    };
    const result = mapper.mapUpdateDentalBenefitsRequestDtoToUpdateDentalBenefitsRequestEntity(expectedDentalBenefitsDto);
    expect(result).toEqual(mockDentalBenefitsEntity);
  });

  it('should default to zero UUIDs if no benefits are selected', () => {
    const expectedEntity: UpdateDentalBenefitsRequestEntity = {
      BenefitApplication: {
        Applicant: {
          ApplicantDetail: {
            InsurancePlan: [
              {
                InsurancePlanFederalIdentification: {
                  IdentificationID: '00000000-0000-0000-0000-000000000000',
                },
                InsurancePlanProvincialIdentification: {
                  IdentificationID: '00000000-0000-0000-0000-000000000000',
                },
              },
            ],
          },
          ClientIdentification: [
            {
              IdentificationID: '123456789',
              IdentificationCategoryText: 'Guid Primary Key',
            },
          ],
        },
      },
    };

    const dto: UpdateDentalBenefitsRequestDto = {
      clientId: '123456789',
      hasFederalBenefits: false,
      hasProvincialTerritorialBenefits: false,
      province: 'ON',
    };

    const result = mapper.mapUpdateDentalBenefitsRequestDtoToUpdateDentalBenefitsRequestEntity(dto);
    expect(result).toEqual(expectedEntity);
  });
});

describe('mapUpdateEmailAddressRequestDtoToUpdateEmailAddressRequestEntity', () => {
  it('should map UpdateEmailAddressRequestDto to UpdateEmailAddressRequestEntity', () => {
    const mockEmailAddressEntity: UpdateEmailAddressRequestEntity = {
      BenefitApplication: {
        Applicant: {
          ApplicantDetail: {
            ApplicantEmailVerifiedIndicator: true,
          },
          ClientIdentification: [
            {
              IdentificationID: '123456789',
              IdentificationCategoryText: 'Guid Primary Key',
            },
          ],
          PersonContactInformation: [
            {
              EmailAddress: [
                {
                  EmailAddressID: 'user@example.com',
                },
              ],
            },
          ],
        },
      },
    };
    const expectedEmailAddressDto: UpdateEmailAddressRequestDto = {
      clientId: '123456789',
      email: 'user@example.com',
    };
    const result = mapper.mapUpdateEmailAddressRequestDtoToUpdateEmailAddressRequestEntity(expectedEmailAddressDto);
    expect(result).toEqual(mockEmailAddressEntity);
  });
});

describe('mapUpdatePhoneNumbersRequestDtoToUpdatePhoneNumbersRequestEntity', () => {
  it('should map UpdatePhoneNumbersRequestDto to UpdatePhoneNumbersRequestEntity', () => {
    const mockPhoneNumbersEntity: UpdatePhoneNumbersRequestEntity = {
      BenefitApplication: {
        Applicant: {
          ClientIdentification: [
            {
              IdentificationID: '123456789',
              IdentificationCategoryText: 'Guid Primary Key',
            },
          ],
          PersonContactInformation: [
            {
              TelephoneNumber: [
                {
                  TelephoneNumberCategoryCode: {
                    ReferenceDataID: '555-555-1234',
                    ReferenceDataName: 'Primary',
                  },
                },
                {
                  TelephoneNumberCategoryCode: {
                    ReferenceDataID: '555-555-5678',
                    ReferenceDataName: 'Alternate',
                  },
                },
              ],
            },
          ],
        },
      },
    };
    const expectedPhoneNumbersDto: UpdatePhoneNumbersRequestDto = {
      clientId: '123456789',
      phoneNumber: '555-555-1234',
      phoneNumberAlt: '555-555-5678',
    };
    const result = mapper.mapUpdatePhoneNumbersRequestDtoToUpdatePhoneNumbersRequestEntity(expectedPhoneNumbersDto);
    expect(result).toEqual(mockPhoneNumbersEntity);
  });
});

describe('mapUpdateAddressRequestDtoToUpdateAddressRequestEntity', () => {
  it('should map UpdateAddressRequestDto to UpdateAddressRequestEntity', () => {
    const mockAddressEntity: UpdateAddressRequestEntity = {
      BenefitApplication: {
        Applicant: {
          ClientIdentification: [
            {
              IdentificationID: '123456789',
              IdentificationCategoryText: 'Guid Primary Key',
            },
          ],
          MailingSameAsHomeIndicator: false,
          PersonContactInformation: [
            {
              Address: [
                {
                  AddressCategoryCode: {
                    ReferenceDataName: 'Mailing',
                  },
                  AddressCityName: 'Mailing City',
                  AddressCountry: {
                    CountryCode: {
                      ReferenceDataID: 'USA',
                    },
                  },
                  AddressPostalCode: '90210',
                  AddressProvince: {
                    ProvinceCode: {
                      ReferenceDataID: 'LA',
                    },
                  },
                  AddressSecondaryUnitText: '',
                  AddressStreet: {
                    StreetName: '298 Fake Street',
                  },
                },
                {
                  AddressCategoryCode: {
                    ReferenceDataName: 'Home',
                  },
                  AddressCityName: 'Home City',
                  AddressCountry: {
                    CountryCode: {
                      ReferenceDataID: 'CAN',
                    },
                  },
                  AddressPostalCode: 'H0H 0H0',
                  AddressProvince: {
                    ProvinceCode: {
                      ReferenceDataID: 'ON',
                    },
                  },
                  AddressSecondaryUnitText: '',
                  AddressStreet: {
                    StreetName: '123 Fake Street',
                  },
                },
              ],
            },
          ],
        },
      },
    };
    const expectedAddressDto: UpdateAddressRequestDto = {
      clientId: '123456789',
      mailingAddress: {
        address: '298 Fake Street',
        city: 'Mailing City',
        countryId: 'USA',
        postalZipCode: '90210',
        provinceStateId: 'LA',
      },
      homeAddress: {
        address: '123 Fake Street',
        city: 'Home City',
        countryId: 'CAN',
        postalZipCode: 'H0H 0H0',
        provinceStateId: 'ON',
      },
    };
    const result = mapper.mapUpdateAddressRequestDtoToUpdateAddressRequestEntity(expectedAddressDto);
    expect(result).toEqual(mockAddressEntity);
  });

  it('should default AddressProvinces to zero UUIDs if no provinces are selected', () => {
    const mockAddressEntity: UpdateAddressRequestEntity = {
      BenefitApplication: {
        Applicant: {
          ClientIdentification: [
            {
              IdentificationID: '123456789',
              IdentificationCategoryText: 'Guid Primary Key',
            },
          ],
          MailingSameAsHomeIndicator: false,
          PersonContactInformation: [
            {
              Address: [
                {
                  AddressCategoryCode: {
                    ReferenceDataName: 'Mailing',
                  },
                  AddressCityName: 'Mailing City',
                  AddressCountry: {
                    CountryCode: {
                      ReferenceDataID: 'USA',
                    },
                  },
                  AddressPostalCode: '90210',
                  AddressProvince: {
                    ProvinceCode: {
                      ReferenceDataID: '00000000-0000-0000-0000-000000000000',
                    },
                  },
                  AddressSecondaryUnitText: '',
                  AddressStreet: {
                    StreetName: '298 Fake Street',
                  },
                },
                {
                  AddressCategoryCode: {
                    ReferenceDataName: 'Home',
                  },
                  AddressCityName: 'Home City',
                  AddressCountry: {
                    CountryCode: {
                      ReferenceDataID: 'CAN',
                    },
                  },
                  AddressPostalCode: 'H0H 0H0',
                  AddressProvince: {
                    ProvinceCode: {
                      ReferenceDataID: '00000000-0000-0000-0000-000000000000',
                    },
                  },
                  AddressSecondaryUnitText: '',
                  AddressStreet: {
                    StreetName: '123 Fake Street',
                  },
                },
              ],
            },
          ],
        },
      },
    };
    const expectedAddressDto: UpdateAddressRequestDto = {
      clientId: '123456789',
      mailingAddress: {
        address: '298 Fake Street',
        city: 'Mailing City',
        countryId: 'USA',
        postalZipCode: '90210',
        provinceStateId: undefined,
      },
      homeAddress: {
        address: '123 Fake Street',
        city: 'Home City',
        countryId: 'CAN',
        postalZipCode: 'H0H 0H0',
        provinceStateId: undefined,
      },
    };
    const result = mapper.mapUpdateAddressRequestDtoToUpdateAddressRequestEntity(expectedAddressDto);
    expect(result).toEqual(mockAddressEntity);
  });

  it('should set MailingSameAsHomeIndicator to true when mailing and home addresses are the same', () => {
    const expectedEntity: UpdateAddressRequestEntity = {
      BenefitApplication: {
        Applicant: {
          ClientIdentification: [
            {
              IdentificationID: '123456789',
              IdentificationCategoryText: 'Guid Primary Key',
            },
          ],
          MailingSameAsHomeIndicator: true,
          PersonContactInformation: [
            {
              Address: [
                {
                  AddressCategoryCode: {
                    ReferenceDataName: 'Mailing',
                  },
                  AddressCityName: 'Same City',
                  AddressCountry: {
                    CountryCode: {
                      ReferenceDataID: 'CAN',
                    },
                  },
                  AddressPostalCode: 'A1A 1A1',
                  AddressProvince: {
                    ProvinceCode: {
                      ReferenceDataID: 'ON',
                    },
                  },
                  AddressSecondaryUnitText: '',
                  AddressStreet: {
                    StreetName: '123 Same Street',
                  },
                },
                {
                  AddressCategoryCode: {
                    ReferenceDataName: 'Home',
                  },
                  AddressCityName: 'Same City',
                  AddressCountry: {
                    CountryCode: {
                      ReferenceDataID: 'CAN',
                    },
                  },
                  AddressPostalCode: 'A1A 1A1',
                  AddressProvince: {
                    ProvinceCode: {
                      ReferenceDataID: 'ON',
                    },
                  },
                  AddressSecondaryUnitText: '',
                  AddressStreet: {
                    StreetName: '123 Same Street',
                  },
                },
              ],
            },
          ],
        },
      },
    };

    const dto: UpdateAddressRequestDto = {
      clientId: '123456789',
      mailingAddress: {
        address: '123 Same Street',
        city: 'Same City',
        countryId: 'CAN',
        postalZipCode: 'A1A 1A1',
        provinceStateId: 'ON',
      },
      homeAddress: {
        address: '123 Same Street',
        city: 'Same City',
        countryId: 'CAN',
        postalZipCode: 'A1A 1A1',
        provinceStateId: 'ON',
      },
    };

    const result = mapper.mapUpdateAddressRequestDtoToUpdateAddressRequestEntity(dto);
    expect(result).toEqual(expectedEntity);
  });

  // add unit test where mailing and home addresses are the same except for address line case, to ensure MailingSameAsHomeIndicator is true (case-insensitive comparison)
  it('should set MailingSameAsHomeIndicator to true when mailing and home addresses differ only in case', () => {
    const expectedEntity: UpdateAddressRequestEntity = {
      BenefitApplication: {
        Applicant: {
          ClientIdentification: [
            {
              IdentificationID: '123456789',
              IdentificationCategoryText: 'Guid Primary Key',
            },
          ],
          MailingSameAsHomeIndicator: true,
          PersonContactInformation: [
            {
              Address: [
                {
                  AddressCategoryCode: {
                    ReferenceDataName: 'Mailing',
                  },
                  AddressCityName: 'Same City',
                  AddressCountry: {
                    CountryCode: {
                      ReferenceDataID: 'CAN',
                    },
                  },
                  AddressPostalCode: 'A1A 1A1',
                  AddressProvince: {
                    ProvinceCode: {
                      ReferenceDataID: 'ON',
                    },
                  },
                  AddressSecondaryUnitText: '',
                  AddressStreet: {
                    StreetName: '123 SAME Street',
                  },
                },
                {
                  AddressCategoryCode: {
                    ReferenceDataName: 'Home',
                  },
                  AddressCityName: 'Same City',
                  AddressCountry: {
                    CountryCode: {
                      ReferenceDataID: 'CAN',
                    },
                  },
                  AddressPostalCode: 'A1A 1A1',
                  AddressProvince: {
                    ProvinceCode: {
                      ReferenceDataID: 'ON',
                    },
                  },
                  AddressSecondaryUnitText: '',
                  AddressStreet: {
                    StreetName: '123 Same Street',
                  },
                },
              ],
            },
          ],
        },
      },
    };

    const dto: UpdateAddressRequestDto = {
      clientId: '123456789',
      mailingAddress: {
        address: '123 SAME Street',
        city: 'Same City',
        countryId: 'CAN',
        postalZipCode: 'A1A 1A1',
        provinceStateId: 'ON',
      },
      homeAddress: {
        address: '123 Same Street',
        city: 'Same City',
        countryId: 'CAN',
        postalZipCode: 'A1A 1A1',
        provinceStateId: 'ON',
      },
    };

    const result = mapper.mapUpdateAddressRequestDtoToUpdateAddressRequestEntity(dto);
    expect(result).toEqual(expectedEntity);
  });

  it('should set MailingSameAsHomeIndicator to false when mailing and home addresses differ in content', () => {
    const expectedEntity: UpdateAddressRequestEntity = {
      BenefitApplication: {
        Applicant: {
          ClientIdentification: [
            {
              IdentificationID: '123456789',
              IdentificationCategoryText: 'Guid Primary Key',
            },
          ],
          MailingSameAsHomeIndicator: false,
          PersonContactInformation: [
            {
              Address: [
                {
                  AddressCategoryCode: {
                    ReferenceDataName: 'Mailing',
                  },
                  AddressCityName: 'Different City',
                  AddressCountry: {
                    CountryCode: {
                      ReferenceDataID: 'USA',
                    },
                  },
                  AddressPostalCode: '90210',
                  AddressProvince: {
                    ProvinceCode: {
                      ReferenceDataID: 'CA',
                    },
                  },
                  AddressSecondaryUnitText: '',
                  AddressStreet: {
                    StreetName: '456 Different Street',
                  },
                },
                {
                  AddressCategoryCode: {
                    ReferenceDataName: 'Home',
                  },
                  AddressCityName: 'Home City',
                  AddressCountry: {
                    CountryCode: {
                      ReferenceDataID: 'CAN',
                    },
                  },
                  AddressPostalCode: 'H0H 0H0',
                  AddressProvince: {
                    ProvinceCode: {
                      ReferenceDataID: 'ON',
                    },
                  },
                  AddressSecondaryUnitText: '',
                  AddressStreet: {
                    StreetName: '123 Home Street',
                  },
                },
              ],
            },
          ],
        },
      },
    };

    const dto: UpdateAddressRequestDto = {
      clientId: '123456789',
      mailingAddress: {
        address: '456 Different Street',
        city: 'Different City',
        countryId: 'USA',
        postalZipCode: '90210',
        provinceStateId: 'CA',
      },
      homeAddress: {
        address: '123 Home Street',
        city: 'Home City',
        countryId: 'CAN',
        postalZipCode: 'H0H 0H0',
        provinceStateId: 'ON',
      },
    };

    const result = mapper.mapUpdateAddressRequestDtoToUpdateAddressRequestEntity(dto);
    expect(result).toEqual(expectedEntity);
  });
});

describe('mapUpdateAddressRequestDtoToMailingSameAsHomeIndicator', () => {
  it('should return true when addresses are identical', () => {
    const mailingAddress = {
      address: '123 Main Street',
      city: 'Toronto',
      countryId: 'CAN',
      postalZipCode: 'M5V 3A8',
      provinceStateId: 'ON',
    };

    const homeAddress = {
      address: '123 Main Street',
      city: 'Toronto',
      countryId: 'CAN',
      postalZipCode: 'M5V 3A8',
      provinceStateId: 'ON',
    };

    const result = mapper.mapUpdateAddressRequestDtoToMailingSameAsHomeIndicator({ mailingAddress, homeAddress });
    expect(result).toBe(true);
  });

  it('should return true when addresses differ only in case', () => {
    const mailingAddress = {
      address: '123 MAIN STREET',
      city: 'TORONTO',
      countryId: 'CAN',
      postalZipCode: 'M5V 3A8',
      provinceStateId: 'ON',
    };

    const homeAddress = {
      address: '123 main street',
      city: 'toronto',
      countryId: 'CAN',
      postalZipCode: 'm5v 3a8',
      provinceStateId: 'ON',
    };

    const result = mapper.mapUpdateAddressRequestDtoToMailingSameAsHomeIndicator({ mailingAddress, homeAddress });
    expect(result).toBe(true);
  });

  it('should return true when addresses have accented characters that normalize to same', () => {
    const mailingAddress = {
      address: '123 Rue Saint-André',
      city: 'Montréal',
      countryId: 'CAN',
      postalZipCode: 'H2X 1A1',
      provinceStateId: 'QC',
    };

    const homeAddress = {
      address: '123 Rue Saint-Andre',
      city: 'Montreal',
      countryId: 'CAN',
      postalZipCode: 'H2X 1A1',
      provinceStateId: 'QC',
    };

    const result = mapper.mapUpdateAddressRequestDtoToMailingSameAsHomeIndicator({ mailingAddress, homeAddress });
    expect(result).toBe(true);
  });

  it('should return false when addresses differ in street name', () => {
    const mailingAddress = {
      address: '123 Main Street',
      city: 'Toronto',
      countryId: 'CAN',
      postalZipCode: 'M5V 3A8',
      provinceStateId: 'ON',
    };

    const homeAddress = {
      address: '456 Main Street',
      city: 'Toronto',
      countryId: 'CAN',
      postalZipCode: 'M5V 3A8',
      provinceStateId: 'ON',
    };

    const result = mapper.mapUpdateAddressRequestDtoToMailingSameAsHomeIndicator({ mailingAddress, homeAddress });
    expect(result).toBe(false);
  });

  it('should return false when addresses differ in city', () => {
    const mailingAddress = {
      address: '123 Main Street',
      city: 'Toronto',
      countryId: 'CAN',
      postalZipCode: 'M5V 3A8',
      provinceStateId: 'ON',
    };

    const homeAddress = {
      address: '123 Main Street',
      city: 'Ottawa',
      countryId: 'CAN',
      postalZipCode: 'M5V 3A8',
      provinceStateId: 'ON',
    };

    const result = mapper.mapUpdateAddressRequestDtoToMailingSameAsHomeIndicator({ mailingAddress, homeAddress });
    expect(result).toBe(false);
  });

  it('should return false when addresses differ in country', () => {
    const mailingAddress = {
      address: '123 Main Street',
      city: 'Toronto',
      countryId: 'CAN',
      postalZipCode: 'M5V 3A8',
      provinceStateId: 'ON',
    };

    const homeAddress = {
      address: '123 Main Street',
      city: 'Toronto',
      countryId: 'USA',
      postalZipCode: 'M5V 3A8',
      provinceStateId: 'ON',
    };

    const result = mapper.mapUpdateAddressRequestDtoToMailingSameAsHomeIndicator({ mailingAddress, homeAddress });
    expect(result).toBe(false);
  });

  it('should return false when addresses differ in province/state', () => {
    const mailingAddress = {
      address: '123 Main Street',
      city: 'Toronto',
      countryId: 'CAN',
      postalZipCode: 'M5V 3A8',
      provinceStateId: 'ON',
    };

    const homeAddress = {
      address: '123 Main Street',
      city: 'Toronto',
      countryId: 'CAN',
      postalZipCode: 'M5V 3A8',
      provinceStateId: 'QC',
    };

    const result = mapper.mapUpdateAddressRequestDtoToMailingSameAsHomeIndicator({ mailingAddress, homeAddress });
    expect(result).toBe(false);
  });

  it('should return false when addresses differ in postal code', () => {
    const mailingAddress = {
      address: '123 Main Street',
      city: 'Toronto',
      countryId: 'CAN',
      postalZipCode: 'M5V 3A8',
      provinceStateId: 'ON',
    };

    const homeAddress = {
      address: '123 Main Street',
      city: 'Toronto',
      countryId: 'CAN',
      postalZipCode: 'K1A 0A6',
      provinceStateId: 'ON',
    };

    const result = mapper.mapUpdateAddressRequestDtoToMailingSameAsHomeIndicator({ mailingAddress, homeAddress });
    expect(result).toBe(false);
  });

  it('should return true when both addresses have undefined postal codes', () => {
    const mailingAddress = {
      address: '123 Main Street',
      city: 'Toronto',
      countryId: 'CAN',
      postalZipCode: undefined,
      provinceStateId: 'ON',
    };

    const homeAddress = {
      address: '123 Main Street',
      city: 'Toronto',
      countryId: 'CAN',
      postalZipCode: undefined,
      provinceStateId: 'ON',
    };

    const result = mapper.mapUpdateAddressRequestDtoToMailingSameAsHomeIndicator({ mailingAddress, homeAddress });
    expect(result).toBe(true);
  });

  it('should return false when one address has postal code and other is undefined', () => {
    const mailingAddress = {
      address: '123 Main Street',
      city: 'Toronto',
      countryId: 'CAN',
      postalZipCode: 'M5V 3A8',
      provinceStateId: 'ON',
    };

    const homeAddress = {
      address: '123 Main Street',
      city: 'Toronto',
      countryId: 'CAN',
      postalZipCode: undefined,
      provinceStateId: 'ON',
    };

    const result = mapper.mapUpdateAddressRequestDtoToMailingSameAsHomeIndicator({ mailingAddress, homeAddress });
    expect(result).toBe(false);
  });

  it('should return true when both addresses have undefined province/state', () => {
    const mailingAddress = {
      address: '123 Main Street',
      city: 'Toronto',
      countryId: 'CAN',
      postalZipCode: 'M5V 3A8',
      provinceStateId: undefined,
    };

    const homeAddress = {
      address: '123 Main Street',
      city: 'Toronto',
      countryId: 'CAN',
      postalZipCode: 'M5V 3A8',
      provinceStateId: undefined,
    };

    const result = mapper.mapUpdateAddressRequestDtoToMailingSameAsHomeIndicator({ mailingAddress, homeAddress });
    expect(result).toBe(true);
  });

  it('should return false when one address has province/state and other is undefined', () => {
    const mailingAddress = {
      address: '123 Main Street',
      city: 'Toronto',
      countryId: 'CAN',
      postalZipCode: 'M5V 3A8',
      provinceStateId: 'ON',
    };

    const homeAddress = {
      address: '123 Main Street',
      city: 'Toronto',
      countryId: 'CAN',
      postalZipCode: 'M5V 3A8',
      provinceStateId: undefined,
    };

    const result = mapper.mapUpdateAddressRequestDtoToMailingSameAsHomeIndicator({ mailingAddress, homeAddress });
    expect(result).toBe(false);
  });

  it('should handle complex mixed case and accents correctly', () => {
    const mailingAddress = {
      address: '123 Boul. René-Lévesque Est',
      city: 'Québec',
      countryId: 'CAN',
      postalZipCode: 'G1R 2B5',
      provinceStateId: 'QC',
    };

    const homeAddress = {
      address: '123 BOUL. RENE-LEVESQUE EST',
      city: 'QUEBEC',
      countryId: 'CAN',
      postalZipCode: 'g1r 2b5',
      provinceStateId: 'QC',
    };

    const result = mapper.mapUpdateAddressRequestDtoToMailingSameAsHomeIndicator({ mailingAddress, homeAddress });
    expect(result).toBe(true);
  });
});

describe('mapUpdateCommunicationPreferenceRequestDtoToUpdateCommunicationPreferenceRequestEntity', () => {
  it('should map UpdateCommunicationPreferenceRequestDto to UpdateCommunicationPreferenceRequestEntity', () => {
    const mockCommunicationPreferenceEntity: UpdateCommunicationPreferenceRequestEntity = {
      BenefitApplication: {
        Applicant: {
          ClientIdentification: [
            {
              IdentificationID: '123456789',
              IdentificationCategoryText: 'Guid Primary Key',
            },
          ],
          PersonLanguage: [
            {
              CommunicationCategoryCode: {
                ReferenceDataID: 'fr',
              },
              PreferredIndicator: true,
            },
          ],
          PreferredMethodCommunicationCode: {
            ReferenceDataID: 'mail',
          },
          PreferredMethodCommunicationGCCode: {
            ReferenceDataID: 'email',
          },
        },
      },
    };
    const expectedCommunicationPreferenceDto: UpdateCommunicationPreferenceRequestDto = {
      clientId: '123456789',
      preferredLanguage: 'fr',
      preferredMethodSunLife: 'mail',
      preferredMethodGovernmentOfCanada: 'email',
    };
    const result = mapper.mapUpdateCommunicationPreferenceRequestDtoToUpdateCommunicationPreferenceRequestEntity(expectedCommunicationPreferenceDto);
    expect(result).toEqual(mockCommunicationPreferenceEntity);
  });
});
