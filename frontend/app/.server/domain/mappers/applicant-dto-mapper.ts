import { injectable } from 'inversify';

import type { ApplicantDto, FindApplicantByBasicInfoDto, FindApplicantBySinRequestDto } from '~/.server/domain/dtos';
import type { ApplicantResponseEntity, FindApplicantByBasicInfoRequestEntity, FindApplicantBySinRequestEntity } from '~/.server/domain/entities';
import type { Logger } from '~/.server/logging';
import { createLogger } from '~/.server/logging';
import { ATTR_CDCP_CLIENT_ID } from '~/.server/logging/log-attributes';
import { Traced } from '~/.server/observability/decorator';
import { expectDefined } from '~/utils/assert-utils';
import { sanitizeSin } from '~/utils/sin-utils';

/** Maps applicant lookup DTOs and repository responses between domain layers. */
export interface ApplicantDtoMapper {
  /** Maps basic identity details to an applicant repository request. */
  mapFindApplicantByBasicInfoRequestDtoToFindApplicantByBasicInfoRequestEntity(request: OmitStrict<FindApplicantByBasicInfoDto, 'userId'>): FindApplicantByBasicInfoRequestEntity;

  /** Maps and sanitizes a SIN lookup to an applicant repository request. */
  mapFindApplicantBySinRequestDtoToFindApplicantBySinRequestEntity(request: OmitStrict<FindApplicantBySinRequestDto, 'userId'>): FindApplicantBySinRequestEntity;

  /**
   * Maps an applicant response while omitting incomplete optional addresses.
   *
   * @throws When required client identifiers or name fields are missing.
   */
  mapApplicantResponseEntityToApplicantDto(applicantResponseEntity: ApplicantResponseEntity): ApplicantDto;
}

/** Default mapper for applicant lookup requests and responses. */
@injectable()
export class DefaultApplicantDtoMapper implements ApplicantDtoMapper {
  private readonly log: Logger;

  constructor() {
    this.log = createLogger('DefaultApplicantDtoMapper');
  }

  @Traced()
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

  @Traced()
  mapFindApplicantBySinRequestDtoToFindApplicantBySinRequestEntity(request: OmitStrict<FindApplicantBySinRequestDto, 'userId'>): FindApplicantBySinRequestEntity {
    return {
      Applicant: {
        PersonSINIdentification: {
          IdentificationID: sanitizeSin(request.sin),
        },
      },
    };
  }

  @Traced()
  mapApplicantResponseEntityToApplicantDto(applicantResponseEntity: ApplicantResponseEntity): ApplicantDto {
    const applicant = applicantResponseEntity.BenefitApplication.Applicant;
    const clientId = expectDefined(applicant.ClientIdentification.find((id) => id.IdentificationCategoryText === 'Client ID')?.IdentificationID, 'Expected clientId to be defined');
    const personContactInformation = applicant.PersonContactInformation[0];
    const primaryPhone = personContactInformation?.TelephoneNumber.find((phone) => phone.TelephoneNumberCategoryCode.ReferenceDataName === 'Primary');
    const alternatePhone = personContactInformation?.TelephoneNumber.find((phone) => phone.TelephoneNumberCategoryCode.ReferenceDataName === 'Alternate');
    const emailAddress = personContactInformation?.EmailAddress[0];

    // Include an address only when every required normalized field is available.
    const homeAddress = personContactInformation?.Address.find((address) => address.AddressCategoryCode.ReferenceDataName === 'Home');
    const isHomeAddressDefined = homeAddress !== undefined && !!homeAddress.AddressStreet.StreetName && !!homeAddress.AddressCityName && !!homeAddress.AddressCountry.CountryCode.ReferenceDataID;

    if (!isHomeAddressDefined) {
      this.log.debug('Home address is missing required fields; omitting home address from response', { [ATTR_CDCP_CLIENT_ID]: clientId });
    }

    const mailingAddress = personContactInformation?.Address.find((address) => address.AddressCategoryCode.ReferenceDataName === 'Mailing');

    const isMailingAddressDefined = mailingAddress !== undefined && !!mailingAddress.AddressStreet.StreetName && !!mailingAddress.AddressCityName && !!mailingAddress.AddressCountry.CountryCode.ReferenceDataID;

    if (!isMailingAddressDefined) {
      this.log.debug('Mailing address is missing required fields; omitting mailing address from response', { [ATTR_CDCP_CLIENT_ID]: clientId });
    }

    return {
      applicantType: applicant.ApplicantCategoryCode.ReferenceDataID,
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
        mailingAddress: isMailingAddressDefined
          ? {
              address: mailingAddress.AddressStreet.StreetName,
              apartment: mailingAddress.AddressSecondaryUnitText,
              city: mailingAddress.AddressCityName,
              country: mailingAddress.AddressCountry.CountryCode.ReferenceDataID,
              postalCode: mailingAddress.AddressPostalCode,
              province: mailingAddress.AddressProvince.ProvinceCode.ReferenceDataID,
            }
          : undefined,
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
