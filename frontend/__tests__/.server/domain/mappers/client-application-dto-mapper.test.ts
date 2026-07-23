import { describe, expect, it, vi } from 'vitest';

import type { ClientApplicationBasicInfoRequestDto, ClientApplicationDto, ClientApplicationSinRequestDto } from '~/.server/domain/dtos';
import type { ClientApplicationEntity, ClientApplicationSinRequestEntity } from '~/.server/domain/entities';
import { DefaultClientApplicationDtoMapper } from '~/.server/domain/mappers';
import type { DefaultClientApplicationDtoMapper_ServerConfig } from '~/.server/domain/mappers';

vi.mock('~/.server/utils/coverage-utils', () => ({
  isValidCoverageCopayTierCode: (code: string) => ['Tier 1', 'Tier 2', 'Tier 3'].includes(code),
}));

describe('DefaultClientApplicationDtoMapper', () => {
  const mockServerConfig: DefaultClientApplicationDtoMapper_ServerConfig = {
    APPLICANT_CATEGORY_CODE_INDIVIDUAL: '111111111',
    APPLICANT_CATEGORY_CODE_DEPENDENT_ONLY: '222222222',
    COVERAGE_CATEGORY_CODE_COPAY_TIER: 'Co-Pay Tier',
  };

  const mapper = new DefaultClientApplicationDtoMapper(mockServerConfig);

  describe('mapClientApplicationEntityToClientApplicationDto', () => {
    it('should map ClientApplicationEntity to ClientApplicationDto', () => {
      // Arrange
      const mockClientApplicationEntity: ClientApplicationEntity = {
        BenefitApplication: {
          Applicant: {
            PersonBirthDate: {
              date: '2000-01-01',
            },
            PersonContactInformation: [
              {
                Address: [
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
                    AddressSecondaryUnitText: 'Unit 101',
                    AddressStreet: {
                      StreetName: '123 Fake Street',
                    },
                  },
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
                    AddressSecondaryUnitText: 'Unit 102',
                    AddressStreet: {
                      StreetName: '456 Fake Street',
                    },
                  },
                ],
                EmailAddress: [
                  {
                    EmailAddressID: 'email@example.com',
                  },
                ],
                TelephoneNumber: [
                  {
                    TelephoneNumberCategoryCode: {
                      ReferenceDataName: 'Primary',
                      ReferenceDataID: '555-555-5555',
                    },
                  },
                  {
                    TelephoneNumberCategoryCode: {
                      ReferenceDataName: 'Alternate',
                      ReferenceDataID: '555-555-5556',
                    },
                  },
                ],
              },
            ],
            PersonLanguage: [
              {
                CommunicationCategoryCode: {
                  ReferenceDataID: '1',
                },
                PreferredIndicator: true,
              },
            ],
            PersonMaritalStatus: {
              StatusCode: {
                ReferenceDataID: '775170001',
              },
            },
            PersonName: [
              {
                PersonGivenName: ['John'],
                PersonSurName: 'Doe',
              },
            ],
            PersonSINIdentification: {
              IdentificationID: '80000002',
            },
            MailingSameAsHomeIndicator: true,
            PreferredMethodCommunicationCode: {
              ReferenceDataID: 'EMAIL',
            },
            PreferredMethodCommunicationGCCode: {
              ReferenceDataID: 'DIGITAL',
            },
            ApplicantDetail: {
              InsurancePlan: [
                {
                  InsurancePlanIdentification: [
                    {
                      IdentificationID: 'ID-123456',
                    },
                  ],
                },
              ],
              ApplicantEmailVerifiedIndicator: true,
              InvitationToApplyIndicator: false,
              LivingIndependentlyIndicator: true,
              PreviousApplicationIndicator: false,
              PreviousTaxesFiledIndicator: true,
              PrivateDentalInsuranceIndicator: true,
            },
            ApplicantEarning: [
              {
                BenefitEligibilityStatus: {
                  StatusCode: {
                    ReferenceDataID: '775170001',
                  },
                },
                Coverage: [
                  {
                    CoverageCategoryCode: {
                      ReferenceDataName: 'Co-Pay Tier',
                    },
                    CoverageTierCode: {
                      ReferenceDataID: 'Tier 1',
                    },
                  },
                ],
                PrivateDentalInsuranceIndicator: true,
              },
            ],
            ClientIdentification: [
              {
                IdentificationID: '00000000-0000-0000-0000-000000000000',
                IdentificationCategoryText: 'Client ID',
              },
              {
                IdentificationID: '00000000000',
                IdentificationCategoryText: 'Client Number',
              },
            ],
            RelatedPerson: [
              {
                PersonBirthDate: {
                  YearDate: '2000',
                },
                PersonName: [
                  {
                    PersonGivenName: ['Jane'],
                    PersonSurName: 'Doe',
                  },
                ],
                PersonRelationshipCode: {
                  ReferenceDataName: 'Spouse',
                },
                PersonSINIdentification: {
                  IdentificationID: '80000002',
                },
                ApplicantDetail: {
                  PrivateDentalInsuranceIndicator: false,
                  InsurancePlan: [],
                  AttestParentOrGuardianIndicator: false,
                },
                ClientIdentification: [
                  {
                    IdentificationID: '10000000003',
                    IdentificationCategoryText: 'Client ID',
                  },
                  {
                    IdentificationID: '10000000023',
                    IdentificationCategoryText: 'Client Number',
                  },
                ],
              },
            ],
          },
          BenefitApplicationCategoryCode: {
            ReferenceDataID: 'DENTAL',
          },
          BenefitApplicationYear: {
            BenefitApplicationYearIdentification: [
              {
                IdentificationID: '2024',
              },
            ],
          },
        },
      };

      const expectedClientApplicationDto: ClientApplicationDto = {
        applicationYearId: '2024',
        applicantInformation: {
          firstName: 'John',
          lastName: 'Doe',
          maritalStatus: '775170001',
          socialInsuranceNumber: '80000002',
          clientId: '00000000-0000-0000-0000-000000000000',
          clientNumber: '00000000000',
        },
        children: [],
        communicationPreferences: {
          preferredLanguage: '1',
          preferredMethodSunLife: 'EMAIL',
          preferredMethodGovernmentOfCanada: 'DIGITAL',
        },
        contactInformation: {
          copyMailingAddress: true,
          email: 'email@example.com',
          emailVerified: true,
          homeAddress: {
            address: '123 Fake Street',
            apartment: 'Unit 101',
            city: 'Home City',
            country: 'CAN',
            postalCode: 'H0H 0H0',
            province: 'ON',
          },
          mailingAddress: {
            address: '456 Fake Street',
            apartment: 'Unit 102',
            city: 'Mailing City',
            country: 'USA',
            postalCode: '90210',
            province: 'LA',
          },
          phoneNumber: '555-555-5555',
          phoneNumberAlt: '555-555-5556',
        },
        coverageCopayTierCode: 'Tier 1',
        dateOfBirth: '2000-01-01',
        dentalBenefits: ['ID-123456'],
        eligibilityStatusCode: '775170001',
        livingIndependently: true,
        partnerInformation: {
          clientId: '10000000003',
          clientNumber: '10000000023',
          yearOfBirth: '2000',
          firstName: 'Jane',
          lastName: 'Doe',
          socialInsuranceNumber: '80000002',
        },
        previousApplication: false,
        privateDentalInsurance: true,
        typeOfApplication: 'family',
      };

      // Act
      const result = mapper.mapClientApplicationEntityToClientApplicationDto(mockClientApplicationEntity);

      // Assert
      expect(result).toEqual(expectedClientApplicationDto);
    });
  });

  describe('mapClientApplicationBasicInfoRequestDtoToClientApplicationBasicInfoRequestEntity', () => {
    it('should map ClientApplicationBasicInfoRequestDto to ClientApplicationBasicInfoRequestEntity', () => {
      // Arrange
      const mockClientApplicationBasicInfoRequestDto: ClientApplicationBasicInfoRequestDto = {
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '2000-01-01',
        clientNumber: 'ABC123',
        applicationYearId: '00000000-0000-0000-0000-000000000000',
        userId: 'test-user',
      };

      const mockClientApplicationBasicInfoRequestEntity = {
        Applicant: {
          PersonName: { PersonGivenName: ['John'], PersonSurName: 'Doe' },
          PersonBirthDate: { date: '2000-01-01' },
          ClientIdentification: [{ IdentificationID: 'ABC123', IdentificationCategoryText: 'Client Number' }],
        },
        BenefitApplicationYear: { IdentificationID: '00000000-0000-0000-0000-000000000000' },
      };

      // Act
      const result = mapper.mapClientApplicationBasicInfoRequestDtoToClientApplicationBasicInfoRequestEntity(mockClientApplicationBasicInfoRequestDto);

      // Assert
      expect(result).toEqual(mockClientApplicationBasicInfoRequestEntity);
    });
  });

  describe('mapClientApplicationSinRequestDtoToClientApplicationSinRequestEntity', () => {
    it('should map ClientApplicationSinRequestDto to ClientApplicationSinRequestEntity', () => {
      // Arrange
      const mockClientApplicationSinRequestDto: ClientApplicationSinRequestDto = {
        sin: '123456789',
        applicationYearId: '00000000-0000-0000-0000-000000000000',
        userId: 'test-user',
      };

      const mockClientApplicationSinRequestEntity: ClientApplicationSinRequestEntity = {
        Applicant: { PersonSINIdentification: { IdentificationID: '123456789' } },
        BenefitApplicationYear: { IdentificationID: '00000000-0000-0000-0000-000000000000' },
      };

      // Act
      const result = mapper.mapClientApplicationSinRequestDtoToClientApplicationSinRequestEntity(mockClientApplicationSinRequestDto);

      // Assert
      expect(result).toEqual(mockClientApplicationSinRequestEntity);
    });
  });
});
