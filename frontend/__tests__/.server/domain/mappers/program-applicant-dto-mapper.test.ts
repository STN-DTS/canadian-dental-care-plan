import { describe, expect, it } from 'vitest';

import type { ApplicantResponseEntity } from '~/.server/domain/entities';
import { DefaultProgramApplicantDtoMapper } from '~/.server/domain/mappers/program-applicant-dto-mapper';

describe('DefaultProgramApplicantDtoMapper', () => {
  const mapper = new DefaultProgramApplicantDtoMapper();
  const entity: ApplicantResponseEntity = {
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
                AddressCityName: 'Ottawa',
                AddressCountry: { CountryCode: { ReferenceDataID: 'CA' } },
                AddressProvince: { ProvinceCode: { ReferenceDataID: 'ON' } },
                AddressStreet: { StreetName: '123 Main St' },
              },
            ],
            EmailAddress: [],
            TelephoneNumber: [],
          },
        ],
        PersonName: [{ PersonGivenName: ['John'], PersonSurName: 'Doe' }],
        PersonLanguage: [],
      },
    },
  };

  it('maps a complete program applicant', () => {
    expect(mapper.mapApplicantResponseEntityToProgramApplicantDto(entity)).toMatchObject({
      applicantType: 'SomeCategory',
      clientId: '12345',
      clientNumber: '67890',
      contactInformation: {
        mailingAddress: {
          address: '123 Main St',
          city: 'Ottawa',
          country: 'CA',
        },
      },
    });
  });

  it('rejects an applicant without an applicant category', () => {
    const uncategorizedEntity: ApplicantResponseEntity = {
      BenefitApplication: {
        Applicant: { ...entity.BenefitApplication.Applicant, ApplicantCategoryCode: {} },
      },
    };

    expect(() => mapper.mapApplicantResponseEntityToProgramApplicantDto(uncategorizedEntity)).toThrow('Expected applicant.ApplicantCategoryCode.ReferenceDataID to be defined');
  });

  it('retains strict mailing address validation', () => {
    const missingMailingAddressEntity: ApplicantResponseEntity = {
      BenefitApplication: {
        Applicant: { ...entity.BenefitApplication.Applicant, PersonContactInformation: [] },
      },
    };

    expect(() => mapper.mapApplicantResponseEntityToProgramApplicantDto(missingMailingAddressEntity)).toThrow('Mailing address for client 12345 is missing required fields');
  });
});
