import { describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';

import type { UpdateAddressRequestDto, UpdateCommunicationPreferenceRequestDto, UpdateDentalBenefitsRequestDto, UpdateEmailAddressRequestDto, UpdatePhoneNumbersRequestDto } from '~/.server/domain/dtos';
import type { UpdateAddressRequestEntity, UpdateCommunicationPreferenceRequestEntity, UpdateDentalBenefitsRequestEntity, UpdateEmailAddressRequestEntity, UpdatePhoneNumbersRequestEntity } from '~/.server/domain/entities';
import type { ProfileDtoMapper } from '~/.server/domain/mappers';
import type { ProfileRepository } from '~/.server/domain/repositories';
import { DefaultProfileService } from '~/.server/domain/services';
import type { AuditService } from '~/.server/domain/services';

describe('DefaultProfileService', () => {
  const mockProfileDtoMapper = mock<ProfileDtoMapper>();
  const mockProfileRepository = mock<ProfileRepository>();
  const mockAuditService = mock<AuditService>();

  const service = new DefaultProfileService(mockAuditService, mockProfileDtoMapper, mockProfileRepository);

  it('should update communication preferences', async () => {
    const mockCommunicationPreferenceDto: UpdateCommunicationPreferenceRequestDto = {
      clientId: '123456789',
      preferredLanguage: 'en',
      preferredMethodSunLife: 'mail',
      preferredMethodGovernmentOfCanada: 'mail',
    };

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

    mockProfileDtoMapper.mapUpdateCommunicationPreferenceRequestDtoToUpdateCommunicationPreferenceRequestEntity.mockReturnValue(mockCommunicationPreferenceEntity);

    await service.updateCommunicationPreferences(mockCommunicationPreferenceDto);

    expect(mockAuditService.createAudit).toHaveBeenCalledWith('profile-update.communication-preferences.post');
    expect(mockProfileDtoMapper.mapUpdateCommunicationPreferenceRequestDtoToUpdateCommunicationPreferenceRequestEntity).toHaveBeenCalledWith(mockCommunicationPreferenceDto);
    expect(mockProfileRepository.updateCommunicationPreferences).toHaveBeenCalledWith(mockCommunicationPreferenceEntity);
  });

  it('should update dental benefits', async () => {
    const mockDentalBenefitsDto: UpdateDentalBenefitsRequestDto = {
      clientId: '123456789',
      hasFederalBenefits: true,
      federalSocialProgram: 'FEDERAL-PLAN-001',
      hasProvincialTerritorialBenefits: true,
      provincialTerritorialSocialProgram: 'PROVINCIAL-PLAN-002',
      province: 'ON',
    };

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

    mockProfileDtoMapper.mapUpdateDentalBenefitsRequestDtoToUpdateDentalBenefitsRequestEntity.mockReturnValue(mockDentalBenefitsEntity);

    await service.updateDentalBenefits(mockDentalBenefitsDto);

    expect(mockProfileDtoMapper.mapUpdateDentalBenefitsRequestDtoToUpdateDentalBenefitsRequestEntity).toHaveBeenCalledWith(mockDentalBenefitsDto);
    expect(mockProfileRepository.updateDentalBenefits).toHaveBeenCalledWith(mockDentalBenefitsEntity);
  });

  it('should update email address', async () => {
    const mockEmailAddressDto: UpdateEmailAddressRequestDto = {
      clientId: '123456789',
      email: 'test@example.com',
    };

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

    mockProfileDtoMapper.mapUpdateEmailAddressRequestDtoToUpdateEmailAddressRequestEntity.mockReturnValue(mockEmailAddressEntity);

    await service.updateEmailAddress(mockEmailAddressDto);

    expect(mockProfileDtoMapper.mapUpdateEmailAddressRequestDtoToUpdateEmailAddressRequestEntity).toHaveBeenCalledWith(mockEmailAddressDto);
    expect(mockProfileRepository.updateEmailAddress).toHaveBeenCalledWith(mockEmailAddressEntity);
  });

  it('should update phone numbers', async () => {
    const mockPhoneNumbersDto: UpdatePhoneNumbersRequestDto = {
      clientId: '123456789',
      phoneNumber: '555-555-1234',
      phoneNumberAlt: '555-555-5678',
    };

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
                    ReferenceDataID: 'Primary',
                    ReferenceDataName: 'Primary',
                  },
                },
                {
                  TelephoneNumberCategoryCode: {
                    ReferenceDataID: 'Alternate',
                    ReferenceDataName: 'Alternate',
                  },
                },
              ],
            },
          ],
        },
      },
    };

    mockProfileDtoMapper.mapUpdatePhoneNumbersRequestDtoToUpdatePhoneNumbersRequestEntity.mockReturnValue(mockPhoneNumbersEntity);

    await service.updatePhoneNumbers(mockPhoneNumbersDto);

    expect(mockProfileDtoMapper.mapUpdatePhoneNumbersRequestDtoToUpdatePhoneNumbersRequestEntity).toHaveBeenCalledWith(mockPhoneNumbersDto);
    expect(mockProfileRepository.updatePhoneNumbers).toHaveBeenCalledWith(mockPhoneNumbersEntity);
  });

  it('should update address', async () => {
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
    const mockAddressDto: UpdateAddressRequestDto = {
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
    mockProfileDtoMapper.mapUpdateAddressRequestDtoToUpdateAddressRequestEntity.mockReturnValue(mockAddressEntity);

    await service.updateAddresses(mockAddressDto);

    expect(mockProfileDtoMapper.mapUpdateAddressRequestDtoToUpdateAddressRequestEntity).toHaveBeenCalledWith(mockAddressDto);
    expect(mockProfileRepository.updateAddresses).toHaveBeenCalledWith(mockAddressEntity);
  });
});
