import { describe, expect, it } from 'vitest';

import type { ApplicantDto } from '~/.server/domain/dtos';
import type { ApplicantResponseEntity } from '~/.server/domain/entities';
import { DefaultApplicantDtoMapper } from '~/.server/domain/mappers/applicant-dto-mapper';

describe('DefaultApplicantDtoMapper', () => {
  describe('mapApplicantResponseEntityToApplicantDto', () => {
    const mapper = new DefaultApplicantDtoMapper();

    const mockBaseEntity: ApplicantResponseEntity = {
      BenefitApplication: {
        Applicant: {
          ApplicantCategoryCode: { ReferenceDataID: 'SomeCategory' },
          ClientIdentification: [
            { IdentificationCategoryText: 'Client ID', IdentificationID: '12345' },
            { IdentificationCategoryText: 'Client Number', IdentificationID: '67890' },
          ],
          PersonBirthDate: { date: '1990-01-01' },
          PersonContactInformation: [
            {
              Address: [
                {
                  AddressCategoryCode: { ReferenceDataName: 'Mailing' },
                  AddressCityName: 'Mailing City',
                  AddressCountry: { CountryCode: { ReferenceDataID: 'US' } },
                  AddressPostalCode: '12345',
                  AddressStreet: { StreetName: '456 Main St' },
                  AddressProvince: { ProvinceCode: { ReferenceDataID: 'NY' } },
                  AddressSecondaryUnitText: 'Unit 2',
                },
                {
                  AddressCategoryCode: { ReferenceDataName: 'Home' },
                  AddressCityName: 'Home City',
                  AddressCountry: { CountryCode: { ReferenceDataID: 'CA' } },
                  AddressPostalCode: 'A1A1A1',
                  AddressStreet: { StreetName: '123 Main St' },
                  AddressProvince: { ProvinceCode: { ReferenceDataID: 'ON' } },
                  AddressSecondaryUnitText: 'Unit 1',
                },
              ],
              EmailAddress: [{ EmailAddressID: 'john.doe@example.com' }],
              TelephoneNumber: [
                {
                  FullTelephoneNumber: { TelephoneNumberFullID: '123-456-7890' },
                  TelephoneNumberCategoryCode: { ReferenceDataName: 'Primary' },
                },
                {
                  FullTelephoneNumber: { TelephoneNumberFullID: '123-456-7891' },
                  TelephoneNumberCategoryCode: { ReferenceDataName: 'Alternate' },
                },
              ],
            },
          ],
          PersonMaritalStatus: {
            StatusCode: {
              ReferenceDataID: 'Single',
            },
          },
          PersonName: [
            {
              PersonGivenName: ['John'],
              PersonSurName: 'Doe',
            },
          ],
          PersonSINIdentification: { IdentificationID: '123456789' },
          PersonLanguage: [
            {
              CommunicationCategoryCode: {
                ReferenceDataID: 'EN',
              },
              PreferredIndicator: true,
            },
          ],
          PreferredMethodCommunicationCode: {
            ReferenceDataID: 'Email',
          },
          PreferredMethodCommunicationGCCode: {
            ReferenceDataID: 'Digital',
          },
        },
      },
    };

    it('should successfully map valid ApplicantResponseEntity to ApplicantDto', () => {
      const result = mapper.mapApplicantResponseEntityToApplicantDto(mockBaseEntity);
      expect(result).toEqual<ApplicantDto>({
        clientId: '12345',
        clientNumber: '67890',
        communicationPreferences: {
          preferredLanguage: 'EN',
          preferredMethodGovernmentOfCanada: 'Digital',
          preferredMethodSunLife: 'Email',
        },
        contactInformation: {
          email: 'john.doe@example.com',
          homeAddress: {
            address: '123 Main St',
            apartment: 'Unit 1',
            city: 'Home City',
            country: 'CA',
            postalCode: 'A1A1A1',
            province: 'ON',
          },
          mailingAddress: {
            address: '456 Main St',
            apartment: 'Unit 2',
            city: 'Mailing City',
            country: 'US',
            postalCode: '12345',
            province: 'NY',
          },
          phoneNumber: '123-456-7890',
          phoneNumberAlt: '123-456-7891',
        },
        dateOfBirth: '1990-01-01',
        firstName: 'John',
        lastName: 'Doe',
        maritalStatus: 'Single',
        socialInsuranceNumber: '123456789',
      });
    });

    it('should throw error when clientId is not found', () => {
      const mockEntity: ApplicantResponseEntity = {
        BenefitApplication: {
          Applicant: {
            ...mockBaseEntity.BenefitApplication.Applicant,
            ClientIdentification: [{ IdentificationCategoryText: 'Client Number', IdentificationID: '67890' }],
          },
        },
      };

      expect(() => mapper.mapApplicantResponseEntityToApplicantDto(mockEntity)).toThrow('Expected clientId to be defined');
    });

    it('should throw error when clientNumber is not found', () => {
      const mockEntity: ApplicantResponseEntity = {
        BenefitApplication: {
          Applicant: {
            ...mockBaseEntity.BenefitApplication.Applicant,
            ClientIdentification: [{ IdentificationCategoryText: 'Client ID', IdentificationID: '12345' }],
          },
        },
      };

      expect(() => mapper.mapApplicantResponseEntityToApplicantDto(mockEntity)).toThrow('Expected clientNumber to be defined');
    });

    it('should throw error when firstName is not defined', () => {
      const mockEntity: ApplicantResponseEntity = {
        BenefitApplication: {
          Applicant: {
            ...mockBaseEntity.BenefitApplication.Applicant,
            PersonName: [{ PersonGivenName: [], PersonSurName: 'Doe' }],
          },
        },
      };

      expect(() => mapper.mapApplicantResponseEntityToApplicantDto(mockEntity)).toThrow('Expected applicant.PersonName[0].PersonGivenName[0] to be defined');
    });

    it('should throw error when lastName is not defined', () => {
      const mockEntity: ApplicantResponseEntity = {
        BenefitApplication: {
          Applicant: {
            ...mockBaseEntity.BenefitApplication.Applicant,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            PersonName: [{ PersonGivenName: ['John'], PersonSurName: undefined as any }],
          },
        },
      };

      expect(() => mapper.mapApplicantResponseEntityToApplicantDto(mockEntity)).toThrow('Expected applicant.PersonName[0].PersonSurName to be defined');
    });

    it('should throw error when PersonName array is empty', () => {
      const mockEntity: ApplicantResponseEntity = {
        BenefitApplication: {
          Applicant: {
            ...mockBaseEntity.BenefitApplication.Applicant,
            PersonName: [],
          },
        },
      };

      expect(() => mapper.mapApplicantResponseEntityToApplicantDto(mockEntity)).toThrow();
    });
  });
});
