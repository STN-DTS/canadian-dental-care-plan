import { injectable } from 'inversify';

import type { FindProgramApplicantByBasicInfoDto, FindProgramApplicantBySinRequestDto, ProgramApplicantDto } from '~/.server/domain/dtos';
import type { ApplicantResponseEntity, FindApplicantByBasicInfoRequestEntity, FindApplicantBySinRequestEntity } from '~/.server/domain/entities';
import type { Logger } from '~/.server/logging';
import { createLogger } from '~/.server/logging';
import { expectDefined } from '~/utils/assert-utils';
import { sanitizeSin } from '~/utils/sin-utils';

/** Maps program applicant lookup DTOs and repository responses between domain layers. */
export interface ProgramApplicantDtoMapper {
  /** Maps basic identity details to an applicant repository request. */
  mapFindProgramApplicantByBasicInfoDtoToFindApplicantByBasicInfoRequestEntity(request: OmitStrict<FindProgramApplicantByBasicInfoDto, 'userId'>): FindApplicantByBasicInfoRequestEntity;

  /** Maps and sanitizes a SIN lookup to an applicant repository request. */
  mapFindProgramApplicantBySinRequestDtoToFindApplicantBySinRequestEntity(request: OmitStrict<FindProgramApplicantBySinRequestDto, 'userId'>): FindApplicantBySinRequestEntity;

  /**
   * Maps a repository response to the strict program applicant contract.
   *
   * @throws When the applicant type, mailing address, client identifiers, or name fields are missing.
   */
  mapApplicantResponseEntityToProgramApplicantDto(applicantResponseEntity: ApplicantResponseEntity): ProgramApplicantDto;
}

/** Default mapper for program applicant lookup requests and responses. */
@injectable()
export class DefaultProgramApplicantDtoMapper implements ProgramApplicantDtoMapper {
  private readonly log: Logger;

  constructor() {
    this.log = createLogger('DefaultProgramApplicantDtoMapper');
  }

  mapFindProgramApplicantByBasicInfoDtoToFindApplicantByBasicInfoRequestEntity(request: OmitStrict<FindProgramApplicantByBasicInfoDto, 'userId'>): FindApplicantByBasicInfoRequestEntity {
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

  mapFindProgramApplicantBySinRequestDtoToFindApplicantBySinRequestEntity(request: OmitStrict<FindProgramApplicantBySinRequestDto, 'userId'>): FindApplicantBySinRequestEntity {
    return {
      Applicant: {
        PersonSINIdentification: {
          IdentificationID: sanitizeSin(request.sin),
        },
      },
    };
  }

  mapApplicantResponseEntityToProgramApplicantDto(applicantResponseEntity: ApplicantResponseEntity): ProgramApplicantDto {
    const applicant = applicantResponseEntity.BenefitApplication.Applicant;
    const clientId = expectDefined(applicant.ClientIdentification.find((id) => id.IdentificationCategoryText === 'Client ID')?.IdentificationID, 'Expected clientId to be defined');
    const personContactInformation = applicant.PersonContactInformation[0];
    const primaryPhone = personContactInformation?.TelephoneNumber.find((phone) => phone.TelephoneNumberCategoryCode.ReferenceDataName === 'Primary');
    const alternatePhone = personContactInformation?.TelephoneNumber.find((phone) => phone.TelephoneNumberCategoryCode.ReferenceDataName === 'Alternate');
    const emailAddress = personContactInformation?.EmailAddress[0];
    const homeAddress = personContactInformation?.Address.find((address) => address.AddressCategoryCode.ReferenceDataName === 'Home');
    const isHomeAddressDefined = homeAddress !== undefined && !!homeAddress.AddressStreet.StreetName && !!homeAddress.AddressCityName && !!homeAddress.AddressCountry.CountryCode.ReferenceDataID;

    if (!isHomeAddressDefined) {
      this.log.warn('Home address for client %s is missing required fields. Home address will be omitted from the response.', clientId);
    }

    const mailingAddress = personContactInformation?.Address.find((address) => address.AddressCategoryCode.ReferenceDataName === 'Mailing');
    const isMailingAddressDefined = mailingAddress !== undefined && !!mailingAddress.AddressStreet.StreetName && !!mailingAddress.AddressCityName && !!mailingAddress.AddressCountry.CountryCode.ReferenceDataID;

    if (!isMailingAddressDefined) {
      this.log.error('Mailing address for client %s is missing required fields and is required for this operation.', clientId);
      throw new Error(`Mailing address for client ${clientId} is missing required fields`);
    }

    return {
      applicantType: expectDefined(applicant.ApplicantCategoryCode.ReferenceDataID, 'Expected applicant.ApplicantCategoryCode.ReferenceDataID to be defined'),
      clientId,
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
          address: mailingAddress.AddressStreet.StreetName,
          apartment: mailingAddress.AddressSecondaryUnitText,
          city: mailingAddress.AddressCityName,
          country: mailingAddress.AddressCountry.CountryCode.ReferenceDataID,
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
