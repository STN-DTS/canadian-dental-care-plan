import { injectable } from 'inversify';

import type { ApplicantDto, FindApplicantByBasicInfoDto, FindApplicantBySinRequestDto } from '~/.server/domain/dtos';
import type { ApplicantResponseEntity, FindApplicantByBasicInfoRequestEntity, FindApplicantBySinRequestEntity } from '~/.server/domain/entities';
import type { Logger } from '~/.server/logging';
import { createLogger } from '~/.server/logging';
import { expectDefined } from '~/utils/assert-utils';
import { sanitizeSin } from '~/utils/sin-utils';

export interface ApplicantDtoMapper {
  mapFindApplicantByBasicInfoRequestDtoToFindApplicantByBasicInfoRequestEntity(request: OmitStrict<FindApplicantByBasicInfoDto, 'userId'>): FindApplicantByBasicInfoRequestEntity;
  mapFindApplicantBySinRequestDtoToFindApplicantBySinRequestEntity(request: OmitStrict<FindApplicantBySinRequestDto, 'userId'>): FindApplicantBySinRequestEntity;
  mapApplicantResponseEntityToApplicantDto(applicantResponseEntity: ApplicantResponseEntity): ApplicantDto;
}

@injectable()
export class DefaultApplicantDtoMapper implements ApplicantDtoMapper {
  private readonly log: Logger;

  constructor() {
    this.log = createLogger('DefaultApplicantDtoMapper');
  }

  mapFindApplicantByBasicInfoRequestDtoToFindApplicantByBasicInfoRequestEntity(request: OmitStrict<FindApplicantByBasicInfoDto, 'userId'>): FindApplicantByBasicInfoRequestEntity {
    return {
      Applicant: {
        PersonName: {
          PersonGivenName: [request.firstName],
          PersonSurName: request.lastName,
        },
        PersonBirthDate: {
          date: request.dateOfBirth,
        },
        ClientIdentification: [
          {
            IdentificationID: request.clientNumber,
            IdentificationCategoryText: 'Client Number',
          },
        ],
      },
    };
  }

  mapFindApplicantBySinRequestDtoToFindApplicantBySinRequestEntity(request: OmitStrict<FindApplicantBySinRequestDto, 'userId'>): FindApplicantBySinRequestEntity {
    return {
      Applicant: {
        PersonSINIdentification: {
          IdentificationID: sanitizeSin(request.sin),
        },
      },
    };
  }

  mapApplicantResponseEntityToApplicantDto(applicantResponseEntity: ApplicantResponseEntity): ApplicantDto {
    const applicant = applicantResponseEntity.BenefitApplication.Applicant;
    const clientId = expectDefined(applicant.ClientIdentification.find((id) => id.IdentificationCategoryText === 'Client ID')?.IdentificationID, 'Expected clientId to be defined');
    const personContactInformation = applicant.PersonContactInformation[0];
    const primaryPhone = personContactInformation?.TelephoneNumber.find((phone) => phone.TelephoneNumberCategoryCode.ReferenceDataName === 'Primary');
    const alternatePhone = personContactInformation?.TelephoneNumber.find((phone) => phone.TelephoneNumberCategoryCode.ReferenceDataName === 'Alternate');
    const emailAddress = personContactInformation?.EmailAddress[0];

    // Home address is not guaranteed to be present for all clients, so we need to check if it exists before trying to access its properties
    const homeAddress = personContactInformation?.Address.find((address) => address.AddressCategoryCode.ReferenceDataName === 'Home');

    // Check if all required home address fields are present before including the home address in the response
    const isHomeAddressDefined =
      homeAddress !== undefined && // Home address must exist
      !!homeAddress.AddressStreet.StreetName && // StreetName is required for home address
      !!homeAddress.AddressCityName && // CityName is required for home address
      !!homeAddress.AddressCountry.CountryCode.ReferenceDataID; // CountryCode is required for home address

    if (!isHomeAddressDefined) {
      this.log.warn(`Home address for client ${clientId} is missing required fields. Home address will be omitted from the response; homeAddress: [%j]`, homeAddress);
    }

    // Mailing address is not guaranteed to be present for all clients, so we need to check if it exists before trying to access its properties
    const mailingAddress = personContactInformation?.Address.find((address) => address.AddressCategoryCode.ReferenceDataName === 'Mailing');

    const isMailingAddressDefined =
      mailingAddress !== undefined && // Mailing address must exist
      !!mailingAddress.AddressStreet.StreetName && // StreetName is required for mailing address
      !!mailingAddress.AddressCityName && // CityName is required for mailing address
      !!mailingAddress.AddressCountry.CountryCode.ReferenceDataID; // CountryCode is required for mailing address

    if (!isMailingAddressDefined) {
      this.log.error(`Mailing address for client ${clientId} is missing required fields and is required for this operation; mailingAddress: [%j]`, mailingAddress);
      throw new Error(`Mailing address for client ${clientId} is missing required fields`);
    }

    return {
      clientId: expectDefined(applicant.ClientIdentification.find((id) => id.IdentificationCategoryText === 'Client ID')?.IdentificationID, 'Expected clientId to be defined'),
      clientNumber: expectDefined(applicant.ClientIdentification.find((id) => id.IdentificationCategoryText === 'Client Number')?.IdentificationID, 'Expected clientNumber to be defined'),
      dateOfBirth: applicant.PersonBirthDate.date,
      firstName: expectDefined(applicant.PersonName[0]?.PersonGivenName[0], 'Expected applicant.PersonName[0].PersonGivenName[0] to be defined'),
      lastName: expectDefined(applicant.PersonName[0]?.PersonSurName, 'Expected applicant.PersonName[0].PersonSurName to be defined'),
      socialInsuranceNumber: applicant.PersonSINIdentification?.IdentificationID,
      maritalStatus: applicant.PersonMaritalStatus?.StatusCode?.ReferenceDataID,
      contactInformation: {
        homeAddress: isHomeAddressDefined
          ? {
              address: homeAddress.AddressStreet.StreetName,
              apartment: homeAddress.AddressSecondaryUnitText,
              city: homeAddress.AddressCityName,
              country: homeAddress.AddressCountry.CountryCode.ReferenceDataID,
              postalCode: homeAddress.AddressPostalCode,
              province: homeAddress.AddressProvince.ProvinceCode.ReferenceDataID,
            }
          : undefined,
        mailingAddress: {
          address: expectDefined(mailingAddress.AddressStreet.StreetName, 'Expected mailingAddress.AddressStreet to be defined'),
          apartment: mailingAddress.AddressSecondaryUnitText,
          city: expectDefined(mailingAddress.AddressCityName, 'Expected mailingAddress.AddressCityName to be defined'),
          country: expectDefined(mailingAddress.AddressCountry.CountryCode.ReferenceDataID, 'Expected mailingAddress.AddressCountry to be defined'),
          postalCode: mailingAddress.AddressPostalCode,
          province: mailingAddress.AddressProvince.ProvinceCode.ReferenceDataID,
        },
        phoneNumber: primaryPhone?.FullTelephoneNumber?.TelephoneNumberFullID,
        phoneNumberAlt: alternatePhone?.FullTelephoneNumber?.TelephoneNumberFullID,
        email: emailAddress?.EmailAddressID,
      },
      communicationPreferences: {
        preferredLanguage: applicant.PersonLanguage.find((language) => language.PreferredIndicator)?.CommunicationCategoryCode?.ReferenceDataID,
        preferredMethodSunLife: applicant.PreferredMethodCommunicationCode?.ReferenceDataID,
        preferredMethodGovernmentOfCanada: applicant.PreferredMethodCommunicationGCCode?.ReferenceDataID,
      },
    };
  }
}
