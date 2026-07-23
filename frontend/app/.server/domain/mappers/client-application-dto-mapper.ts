import { invariant } from '@dts-stn/invariant';
import { inject, injectable } from 'inversify';

import type { ServerConfig } from '~/.server/configs';
import { TYPES } from '~/.server/constants';
import type { ApplicantDto, ClientApplicationBasicInfoRequestDto, ClientApplicationDto, ClientApplicationSinRequestDto } from '~/.server/domain/dtos';
import type { ClientApplicationBasicInfoRequestEntity, ClientApplicationEntity, ClientApplicationSinRequestEntity } from '~/.server/domain/entities';
import { createLogger } from '~/.server/logging';
import type { Logger } from '~/.server/logging';
import { isValidCoverageCopayTierCode } from '~/.server/utils/coverage-utils';
import { expectDefined } from '~/utils/assert-utils';

interface MapApplicantDtoToClientApplicationDtoArgs {
  applicantDto: ApplicantDto;
  applicationYearId: string;
  typeOfApplication: 'adult' | 'children' | 'family';
}
export interface ClientApplicationDtoMapper {
  mapApplicantDtoToClientApplicationDto(args: MapApplicantDtoToClientApplicationDtoArgs): ClientApplicationDto;
  mapClientApplicationBasicInfoRequestDtoToClientApplicationBasicInfoRequestEntity(clientApplicationBasicInfoRequestDto: ClientApplicationBasicInfoRequestDto): ClientApplicationBasicInfoRequestEntity;
  mapClientApplicationSinRequestDtoToClientApplicationSinRequestEntity(clientApplicationSinRequestDto: ClientApplicationSinRequestDto): ClientApplicationSinRequestEntity;
  mapClientApplicationEntityToClientApplicationDto(clientApplicationEntity: ClientApplicationEntity): ClientApplicationDto;
}

export type DefaultClientApplicationDtoMapper_ServerConfig = Pick<
  ServerConfig,
  | 'APPLICANT_CATEGORY_CODE_DEPENDENT_ONLY' //
  | 'APPLICANT_CATEGORY_CODE_INDIVIDUAL'
  | 'COVERAGE_CATEGORY_CODE_COPAY_TIER'
>;

@injectable()
export class DefaultClientApplicationDtoMapper implements ClientApplicationDtoMapper {
  private readonly log: Logger;
  private readonly serverConfig: DefaultClientApplicationDtoMapper_ServerConfig;

  constructor(
    @inject(TYPES.ServerConfig)
    serverConfig: DefaultClientApplicationDtoMapper_ServerConfig,
  ) {
    this.log = createLogger('DefaultClientApplicationDtoMapper');
    this.serverConfig = serverConfig;
  }

  mapApplicantDtoToClientApplicationDto(args: MapApplicantDtoToClientApplicationDtoArgs): ClientApplicationDto {
    const { applicantDto, applicationYearId, typeOfApplication } = args;
    return {
      applicationYearId,
      applicantInformation: {
        firstName: applicantDto.firstName,
        lastName: applicantDto.lastName,
        maritalStatus: applicantDto.maritalStatus,
        clientId: applicantDto.clientId,
        clientNumber: applicantDto.clientNumber,
        // children may not have SIN provided, but the field is required in ClientApplicantInformationDto for mapping
        // to ClientApplicationEntity
        socialInsuranceNumber: applicantDto.socialInsuranceNumber ?? '',
      },
      communicationPreferences: {
        preferredLanguage: applicantDto.communicationPreferences.preferredLanguage,
        preferredMethodSunLife: applicantDto.communicationPreferences.preferredMethodSunLife,
        preferredMethodGovernmentOfCanada: applicantDto.communicationPreferences.preferredMethodGovernmentOfCanada,
      },
      contactInformation: {
        homeAddress: applicantDto.contactInformation.homeAddress,
        mailingAddress: applicantDto.contactInformation.mailingAddress,
        phoneNumber: applicantDto.contactInformation.phoneNumber,
        phoneNumberAlt: applicantDto.contactInformation.phoneNumberAlt,
        email: applicantDto.contactInformation.email,
      },
      dateOfBirth: applicantDto.dateOfBirth,
      typeOfApplication: typeOfApplication,
      children: [],
    };
  }

  mapClientApplicationBasicInfoRequestDtoToClientApplicationBasicInfoRequestEntity(clientApplicationBasicInfoRequestDto: ClientApplicationBasicInfoRequestDto): ClientApplicationBasicInfoRequestEntity {
    return {
      Applicant: {
        PersonName: {
          PersonGivenName: [clientApplicationBasicInfoRequestDto.firstName],
          PersonSurName: clientApplicationBasicInfoRequestDto.lastName,
        },
        PersonBirthDate: {
          date: clientApplicationBasicInfoRequestDto.dateOfBirth,
        },
        ClientIdentification: [
          {
            IdentificationID: clientApplicationBasicInfoRequestDto.clientNumber,
            IdentificationCategoryText: 'Client Number',
          },
        ],
      },
      BenefitApplicationYear: clientApplicationBasicInfoRequestDto.applicationYearId
        ? {
            IdentificationID: clientApplicationBasicInfoRequestDto.applicationYearId,
          }
        : undefined,
    };
  }

  mapClientApplicationSinRequestDtoToClientApplicationSinRequestEntity(clientApplicationSinRequestDto: ClientApplicationSinRequestDto): ClientApplicationSinRequestEntity {
    return {
      Applicant: {
        PersonSINIdentification: {
          IdentificationID: clientApplicationSinRequestDto.sin,
        },
      },
      BenefitApplicationYear: clientApplicationSinRequestDto.applicationYearId
        ? {
            IdentificationID: clientApplicationSinRequestDto.applicationYearId,
          }
        : undefined,
    };
  }

  mapClientApplicationEntityToClientApplicationDto(clientApplicationEntity: ClientApplicationEntity): ClientApplicationDto {
    const applicant = clientApplicationEntity.BenefitApplication.Applicant;
    const clientId = expectDefined(applicant.ClientIdentification.find((id) => id.IdentificationCategoryText === 'Client ID')?.IdentificationID, 'Expected applicant.ClientIdentification.IdentificationID with Client ID to be defined');

    const applicantInformation = {
      clientId,
      clientNumber: expectDefined(applicant.ClientIdentification.find((id) => id.IdentificationCategoryText === 'Client Number')?.IdentificationID, 'Expected applicant.ClientIdentification.IdentificationID with Client Number to be defined'),
      firstName: expectDefined(applicant.PersonName[0]?.PersonGivenName[0], 'Expected applicant.PersonName[0].PersonGivenName[0] to be defined'),
      lastName: expectDefined(applicant.PersonName[0]?.PersonSurName, 'Expected applicant.PersonName[0].PersonSurName to be defined'),
      maritalStatus: applicant.PersonMaritalStatus.StatusCode?.ReferenceDataID,
      socialInsuranceNumber: applicant.PersonSINIdentification.IdentificationID,
    };

    const children =
      applicant.RelatedPerson?.filter((person) => person.PersonRelationshipCode.ReferenceDataName === 'Dependant').map((child) => ({
        dentalBenefits: child.ApplicantDetail.InsurancePlan?.[0]?.InsurancePlanIdentification.map((insurancePlan) => insurancePlan.IdentificationID) ?? [],
        privateDentalInsurance: expectDefined(child.ApplicantDetail.PrivateDentalInsuranceIndicator, 'Expected child.ApplicantDetail.PrivateDentalInsuranceIndicator to be defined'),
        information: {
          firstName: expectDefined(child.PersonName[0]?.PersonGivenName[0], 'Expected child.PersonName[0].PersonGivenName[0] to be defined'),
          lastName: expectDefined(child.PersonName[0]?.PersonSurName, 'Expected child.PersonName[0].PersonSurName to be defined'),
          dateOfBirth: expectDefined(child.PersonBirthDate.date, 'Expected child.PersonBirthDate.date to be defined'),
          isParent: expectDefined(child.ApplicantDetail.AttestParentOrGuardianIndicator, 'Expected child.ApplicantDetail.AttestParentOrGuardianIndicator to be defined'),
          clientId: expectDefined(child.ClientIdentification.find((id) => id.IdentificationCategoryText === 'Client ID')?.IdentificationID, 'Expected child.ClientIdentification.IdentificationID with Client ID to be defined'),
          clientNumber: expectDefined(child.ClientIdentification.find((id) => id.IdentificationCategoryText === 'Client Number')?.IdentificationID, 'Expected child.ClientIdentification.IdentificationID with Client Number to be defined'),
          socialInsuranceNumber: child.PersonSINIdentification.IdentificationID,
        },
      })) ?? [];

    const communicationPreferences = {
      preferredLanguage: expectDefined(applicant.PersonLanguage[0]?.CommunicationCategoryCode.ReferenceDataID, 'Expected applicant.PersonLanguage[0].CommunicationCategoryCode.ReferenceDataID to be defined'),
      preferredMethodSunLife: applicant.PreferredMethodCommunicationCode.ReferenceDataID,
      preferredMethodGovernmentOfCanada: applicant.PreferredMethodCommunicationGCCode.ReferenceDataID,
    };

    const personContactInformation = applicant.PersonContactInformation[0];
    invariant(personContactInformation, 'Expected applicant.PersonContactInformation[0] to be defined');

    // Home address is not guaranteed to be present for all clients, so we need to check if it exists before trying to access its properties
    const homeAddress = personContactInformation.Address.find((address) => address.AddressCategoryCode.ReferenceDataName === 'Home');

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
    const mailingAddress = personContactInformation.Address.find((address) => address.AddressCategoryCode.ReferenceDataName === 'Mailing');

    const isMailingAddressDefined =
      mailingAddress !== undefined && // Mailing address must exist
      !!mailingAddress.AddressStreet.StreetName && // StreetName is required for mailing address
      !!mailingAddress.AddressCityName && // CityName is required for mailing address
      !!mailingAddress.AddressCountry.CountryCode.ReferenceDataID; // CountryCode is required for mailing address

    if (!isMailingAddressDefined) {
      this.log.error(`Mailing address for client ${clientId} is missing required fields and is required for this operation; mailingAddress: [%j]`, mailingAddress);
      throw new Error(`Mailing address for client ${clientId} is missing required fields`);
    }

    const contactInformation = {
      copyMailingAddress: applicant.MailingSameAsHomeIndicator,
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
      phoneNumber: personContactInformation.TelephoneNumber?.find((phone) => phone.TelephoneNumberCategoryCode.ReferenceDataName === 'Primary')?.TelephoneNumberCategoryCode.ReferenceDataID,
      phoneNumberAlt: personContactInformation.TelephoneNumber?.find((phone) => phone.TelephoneNumberCategoryCode.ReferenceDataName === 'Alternate')?.TelephoneNumberCategoryCode.ReferenceDataID,
      email: personContactInformation.EmailAddress?.[0]?.EmailAddressID,
      emailVerified: applicant.ApplicantDetail.ApplicantEmailVerifiedIndicator,
    };

    const partner = applicant.RelatedPerson?.find((person) => person.PersonRelationshipCode.ReferenceDataName === 'Spouse');
    const partnerInformation = partner
      ? {
          clientId: expectDefined(partner.ClientIdentification.find((id) => id.IdentificationCategoryText === 'Client ID')?.IdentificationID, 'Expected partner.ClientIdentification.IdentificationID with Client ID to be defined'),
          clientNumber: expectDefined(partner.ClientIdentification.find((id) => id.IdentificationCategoryText === 'Client Number')?.IdentificationID, 'Expected partner.ClientIdentification.IdentificationID with Client Number to be defined'),
          yearOfBirth: expectDefined(partner.PersonBirthDate.YearDate, 'Expected partner.PersonBirthDate.YearDate to be defined'),
          firstName: partner.PersonName[0]?.PersonGivenName[0] ?? undefined,
          lastName: partner.PersonName[0]?.PersonSurName ?? undefined,
          socialInsuranceNumber: partner.PersonSINIdentification.IdentificationID,
        }
      : undefined;

    const applicationYearId = clientApplicationEntity.BenefitApplication.BenefitApplicationYear.BenefitApplicationYearIdentification[0]?.IdentificationID;
    invariant(applicationYearId, 'Expected applicationYearId to be defined');

    const applicantEarning = applicant.ApplicantEarning[0];
    const coverageCategoryCode = applicantEarning?.Coverage.find((coverage) => coverage.CoverageCategoryCode.ReferenceDataName === this.serverConfig.COVERAGE_CATEGORY_CODE_COPAY_TIER);
    const coverageTierCode = coverageCategoryCode?.CoverageTierCode.ReferenceDataID;
    const coverageCopayTierCode =
      typeof coverageTierCode === 'string' && isValidCoverageCopayTierCode(coverageTierCode) //
        ? coverageTierCode
        : undefined;

    return {
      applicationYearId,
      applicantInformation,
      children,
      communicationPreferences,
      contactInformation,
      coverageCopayTierCode,
      dateOfBirth: applicant.PersonBirthDate.date,
      dentalBenefits: applicant.ApplicantDetail.InsurancePlan?.[0]?.InsurancePlanIdentification.map((insurancePlan) => insurancePlan.IdentificationID) ?? [],
      eligibilityStatusCode: applicantEarning?.BenefitEligibilityStatus.StatusCode.ReferenceDataID,
      livingIndependently: applicant.ApplicantDetail.LivingIndependentlyIndicator,
      partnerInformation,
      previousApplication: applicant.ApplicantDetail.PreviousApplicationIndicator,
      privateDentalInsurance: applicantEarning?.PrivateDentalInsuranceIndicator,
      typeOfApplication: this.toBenefitApplicationCategoryCode(clientApplicationEntity.BenefitApplication.BenefitApplicationCategoryCode.ReferenceDataID),
    };
  }

  private toBenefitApplicationCategoryCode(typeOfApplication: string): 'adult' | 'children' | 'family' {
    const { APPLICANT_CATEGORY_CODE_INDIVIDUAL, APPLICANT_CATEGORY_CODE_DEPENDENT_ONLY } = this.serverConfig;
    if (typeOfApplication === APPLICANT_CATEGORY_CODE_DEPENDENT_ONLY) return 'children';
    if (typeOfApplication === APPLICANT_CATEGORY_CODE_INDIVIDUAL) return 'adult';
    return 'family';
  }
}
