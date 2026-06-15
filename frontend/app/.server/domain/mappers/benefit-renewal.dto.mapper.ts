import { formatISO } from 'date-fns';
import { inject, injectable } from 'inversify';
import validator from 'validator';

import type { ServerConfig } from '~/.server/configs';
import { TYPES } from '~/.server/constants';
import type {
  BenefitRenewalDto,
  ChangeIndicatorsDto,
  DentalInsuranceDto,
  RenewalApplicantInformationDto,
  RenewalChildDto,
  RenewalCommunicationPreferencesDto,
  RenewalContactInformationDto,
  RenewalEmailDto,
  RenewalPartnerInformationDto,
  RenewalTypeOfApplicationDto,
} from '~/.server/domain/dtos';
import type { BenefitRenewalRequestEntity, BenefitRenewalResponseEntity } from '~/.server/domain/entities';
import { expectDefined } from '~/utils/assert-utils';
import { parseDateString } from '~/utils/date-utils';
import { sanitizeSin } from '~/utils/sin-utils';

export interface BenefitRenewalDtoMapper {
  mapBenefitRenewalDtoToBenefitRenewalRequestEntity(benefitRenewalDto: BenefitRenewalDto, applicationChannelCode: 'protected' | 'public'): BenefitRenewalRequestEntity;
  mapBenefitRenewalResponseEntityToApplicationCode(benefitRenewalResponseEntity: BenefitRenewalResponseEntity): string;
}

interface ToBenefitRenewalRequestEntityArgs {
  /**
   * Indicates whether the renewal request is to create a new benefit application or renew an existing benefit
   * application.
   *
   * The current use case for "New" is when a primary dependent turning 18 years old renews their benefit as an
   * individual after being previously covered as a dependent under their parent's benefit. In this case, a new benefit
   * application needs to be created for the new adult. For all other renewal scenarios, the application category code
   * name will be "Renewal" since the benefit application will be renewed instead of a new application being created.
   */
  applicationCategoryCodeName: 'New' | 'Renewal';

  applicationChannelCode: string;
  applicantInformation: RenewalApplicantInformationDto;
  applicationYearId: string;
  changeIndicators?: ChangeIndicatorsDto;
  children: readonly RenewalChildDto[];
  communicationPreferences: RenewalCommunicationPreferencesDto;
  contactInformation: RenewalContactInformationDto;
  emailAddress: RenewalEmailDto;
  dateOfBirth: string;
  dentalBenefits: readonly string[];
  dentalInsurance?: DentalInsuranceDto;
  livingIndependently?: boolean;
  partnerInformation?: RenewalPartnerInformationDto;
  typeOfApplication: RenewalTypeOfApplicationDto;
}

interface ToAddressArgs {
  address: string;
  apartment?: string;
  category: 'Mailing' | 'Home';
  city: string;
  country: string;
  postalCode?: string;
  province?: string;
}

@injectable()
export class DefaultBenefitRenewalDtoMapper implements BenefitRenewalDtoMapper {
  private readonly serverConfig: Pick<
    ServerConfig,
    'APPLICANT_CATEGORY_CODE_INDIVIDUAL' | 'APPLICANT_CATEGORY_CODE_FAMILY' | 'APPLICANT_CATEGORY_CODE_DEPENDENT_ONLY' | 'BENEFIT_APPLICATION_CHANNEL_CODE_PROTECTED' | 'BENEFIT_APPLICATION_CHANNEL_CODE_PUBLIC' | 'MARITAL_STATUS_CODE_SINGLE'
  >;

  constructor(
    @inject(TYPES.ServerConfig)
    serverConfig: Pick<
      ServerConfig,
      'APPLICANT_CATEGORY_CODE_INDIVIDUAL' | 'APPLICANT_CATEGORY_CODE_FAMILY' | 'APPLICANT_CATEGORY_CODE_DEPENDENT_ONLY' | 'BENEFIT_APPLICATION_CHANNEL_CODE_PROTECTED' | 'BENEFIT_APPLICATION_CHANNEL_CODE_PUBLIC' | 'MARITAL_STATUS_CODE_SINGLE'
    >,
  ) {
    this.serverConfig = serverConfig;
  }

  mapBenefitRenewalDtoToBenefitRenewalRequestEntity(benefitRenewalDto: BenefitRenewalDto, applicationChannelCode: 'protected' | 'public'): BenefitRenewalRequestEntity {
    const { BENEFIT_APPLICATION_CHANNEL_CODE_PROTECTED, BENEFIT_APPLICATION_CHANNEL_CODE_PUBLIC } = this.serverConfig;
    return this.toBenefitRenewalRequestEntity({
      applicantInformation: benefitRenewalDto.applicantInformation,
      applicationCategoryCodeName: benefitRenewalDto.applicationCategoryCodeName,
      applicationChannelCode: applicationChannelCode === 'protected' ? BENEFIT_APPLICATION_CHANNEL_CODE_PROTECTED : BENEFIT_APPLICATION_CHANNEL_CODE_PUBLIC,
      applicationYearId: benefitRenewalDto.applicationYearId,
      changeIndicators: benefitRenewalDto.changeIndicators,
      children: benefitRenewalDto.children,
      communicationPreferences: benefitRenewalDto.communicationPreferences,
      contactInformation: benefitRenewalDto.contactInformation,
      emailAddress: benefitRenewalDto.emailAddress,
      dateOfBirth: benefitRenewalDto.dateOfBirth,
      dentalBenefits: benefitRenewalDto.dentalBenefits,
      dentalInsurance: benefitRenewalDto.dentalInsurance,
      livingIndependently: benefitRenewalDto.livingIndependently,
      partnerInformation: benefitRenewalDto.partnerInformation,
      typeOfApplication: benefitRenewalDto.typeOfApplication,
    });
  }

  private toBenefitRenewalRequestEntity({
    applicationCategoryCodeName,
    applicationChannelCode,
    applicantInformation,
    applicationYearId,
    changeIndicators,
    children,
    communicationPreferences,
    contactInformation,
    emailAddress,
    dateOfBirth,
    dentalBenefits,
    dentalInsurance,
    livingIndependently,
    partnerInformation,
    typeOfApplication,
  }: ToBenefitRenewalRequestEntityArgs): BenefitRenewalRequestEntity {
    const { MARITAL_STATUS_CODE_SINGLE } = this.serverConfig;

    return {
      BenefitApplication: {
        Applicant: {
          ApplicantDetail: {
            PrivateDentalInsuranceIndicator: !!dentalInsurance?.hasDentalInsurance,
            LivingIndependentlyIndicator: livingIndependently,
            PrivacyStatementIndicator: true,
            TermsAndConditionsIndicator: true,
            SharingConsentIndicator: true,
            EligibilityAttestationIndicator: true,
            AccuracyConfirmationIndicator: true,
            ApplicantEmailVerifiedIndicator: emailAddress.verified,
            InsurancePlan: this.toInsurancePlan(dentalBenefits),
            ...this.toChangeIndicators(changeIndicators),
          },
          BenefitApplicationDetail: [],
          ClientIdentification: [
            { IdentificationID: applicantInformation.clientId, IdentificationCategoryText: 'Client ID' },
            { IdentificationID: applicantInformation.clientNumber, IdentificationCategoryText: 'Client Number' },
          ],
          PersonBirthDate: this.toDate(dateOfBirth),
          PersonContactInformation: [
            {
              Address: [this.toMailingAddress(contactInformation), this.toHomeAddress(contactInformation)],
              EmailAddress: emailAddress.value && !validator.isEmpty(emailAddress.value) ? [{ EmailAddressID: emailAddress.value }] : [],
              TelephoneNumber: this.toTelephoneNumber(contactInformation),
            },
          ],
          PersonLanguage: [
            {
              CommunicationCategoryCode: {
                ReferenceDataID: communicationPreferences.preferredLanguage,
              },
              PreferredIndicator: true,
            },
          ],
          PersonMaritalStatus: {
            StatusCode: {
              ReferenceDataID: applicantInformation.maritalStatus ?? MARITAL_STATUS_CODE_SINGLE,
            },
          },
          PersonName: [
            {
              PersonGivenName: [applicantInformation.firstName],
              PersonSurName: applicantInformation.lastName,
            },
          ],
          PersonSINIdentification: {
            IdentificationID: sanitizeSin(applicantInformation.socialInsuranceNumber),
          },
          RelatedPerson: this.toRelatedPersons(partnerInformation, children),
          MailingSameAsHomeIndicator: contactInformation.copyMailingAddress,
          PreferredMethodCommunicationCode: {
            ReferenceDataID: communicationPreferences.preferredMethod,
          },
          PreferredMethodCommunicationGCCode: {
            ReferenceDataID: communicationPreferences.preferredMethodGovernmentOfCanada,
          },
        },
        BenefitApplicationCategoryCode: {
          ReferenceDataID: this.toBenefitApplicationCategoryCode(typeOfApplication),
          ReferenceDataName: applicationCategoryCodeName,
        },
        BenefitApplicationChannelCode: {
          ReferenceDataID: applicationChannelCode,
        },
        BenefitApplicationYear: {
          BenefitApplicationYearIdentification: [
            {
              IdentificationID: applicationYearId,
            },
          ],
        },
      },
    };
  }

  private toInsurancePlan(dentalBenefits: readonly string[]) {
    return [
      {
        InsurancePlanIdentification: dentalBenefits.map((dentalBenefit) => ({
          IdentificationID: dentalBenefit,
        })),
      },
    ];
  }

  private toChangeIndicators(changeIndicators?: ChangeIndicatorsDto) {
    if (!changeIndicators) {
      return {};
    }

    const { hasAddressChanged, hasEmailChanged, hasMaritalStatusChanged, hasPhoneChanged } = changeIndicators;
    return {
      AddressChangedIndicator: hasAddressChanged,
      EmailChangedIndicator: hasEmailChanged,
      MaritalStatusChangedIndicator: hasMaritalStatusChanged,
      PhoneChangedIndicator: hasPhoneChanged,
    };
  }

  private toDate(date: string) {
    return {
      date: formatISO(parseDateString(date), { representation: 'date' }),
    };
  }

  private toMailingAddress({ mailingAddress, mailingApartment, mailingCity, mailingCountry, mailingPostalCode, mailingProvince }: RenewalContactInformationDto) {
    return this.toAddress({
      address: mailingAddress,
      apartment: mailingApartment,
      category: 'Mailing',
      city: mailingCity,
      country: mailingCountry,
      postalCode: mailingPostalCode,
      province: mailingProvince,
    });
  }

  private toHomeAddress({ homeAddress, homeApartment, homeCity, homeCountry, homePostalCode, homeProvince }: RenewalContactInformationDto) {
    return this.toAddress({
      address: homeAddress,
      apartment: homeApartment,
      category: 'Home',
      city: homeCity,
      country: homeCountry,
      postalCode: homePostalCode,
      province: homeProvince,
    });
  }

  private toAddress({ address, apartment, category, city, country, postalCode, province }: ToAddressArgs) {
    return {
      AddressCategoryCode: {
        ReferenceDataName: category,
      },
      AddressCityName: city,
      AddressCountry: {
        CountryCode: {
          ReferenceDataID: country,
        },
      },
      AddressPostalCode: postalCode ?? '',
      AddressProvince: {
        ProvinceCode: {
          ReferenceDataID: province ?? '',
        },
      },
      AddressSecondaryUnitText: apartment ?? '',
      AddressStreet: {
        StreetName: address,
      },
    };
  }

  private toTelephoneNumber({ phoneNumber, phoneNumberAlt }: RenewalContactInformationDto) {
    const telephoneNumber = [];

    if (phoneNumber && !validator.isEmpty(phoneNumber)) {
      telephoneNumber.push({
        TelephoneNumberCategoryCode: {
          ReferenceDataID: phoneNumber,
          ReferenceDataName: 'Primary',
        },
      });
    }

    if (phoneNumberAlt && !validator.isEmpty(phoneNumberAlt)) {
      telephoneNumber.push({
        TelephoneNumberCategoryCode: {
          ReferenceDataID: phoneNumberAlt,
          ReferenceDataName: 'Alternate',
        },
      });
    }

    return telephoneNumber;
  }

  private toRelatedPersons(partnerInformation: RenewalPartnerInformationDto | undefined, children: ReadonlyArray<RenewalChildDto>) {
    const relatedPersons = [];

    if (partnerInformation) {
      relatedPersons.push(this.toRelatedPersonSpouse(partnerInformation));
    }
    if (children.length > 0) {
      relatedPersons.push(...this.toRelatedPersonDependent(children));
    }

    return relatedPersons;
  }

  private toRelatedPersonSpouse(renewalPartnerInformation: RenewalPartnerInformationDto) {
    return {
      ApplicantDetail: { ConsentToSharePersonalInformationIndicator: renewalPartnerInformation.consentToSharePersonalInformation },
      ClientIdentification: renewalPartnerInformation.clientId ? [{ IdentificationID: renewalPartnerInformation.clientId, IdentificationCategoryText: 'Client ID' }] : undefined,
      PersonBirthDate: { YearDate: renewalPartnerInformation.yearOfBirth },
      PersonRelationshipCode: { ReferenceDataName: 'Spouse' as const },
      PersonSINIdentification: { IdentificationID: sanitizeSin(renewalPartnerInformation.socialInsuranceNumber) },
    };
  }

  private toRelatedPersonDependent(children: ReadonlyArray<RenewalChildDto>) {
    return children.map((child) => ({
      PersonBirthDate: this.toDate(child.information.dateOfBirth),
      PersonName: [
        {
          PersonGivenName: [child.information.firstName],
          PersonSurName: child.information.lastName,
        },
      ],
      PersonRelationshipCode: {
        ReferenceDataName: 'Dependant' as const,
      },
      PersonSINIdentification: {
        IdentificationID: child.information.socialInsuranceNumber ? sanitizeSin(child.information.socialInsuranceNumber) : '',
      },
      ApplicantDetail: {
        AttestParentOrGuardianIndicator: true,
        PrivateDentalInsuranceIndicator: !!child.dentalInsurance.hasDentalInsurance,
        InsurancePlan: this.toInsurancePlan(child.dentalBenefits),
      },
      BenefitApplicationDetail: [],
      ClientIdentification: [
        { IdentificationID: child.clientId, IdentificationCategoryText: 'Client ID' },
        { IdentificationID: child.clientNumber, IdentificationCategoryText: 'Client Number' },
      ],
    }));
  }

  private toBenefitApplicationCategoryCode(typeOfApplication: RenewalTypeOfApplicationDto) {
    const { APPLICANT_CATEGORY_CODE_INDIVIDUAL, APPLICANT_CATEGORY_CODE_FAMILY, APPLICANT_CATEGORY_CODE_DEPENDENT_ONLY } = this.serverConfig;
    if (typeOfApplication === 'adult') return APPLICANT_CATEGORY_CODE_INDIVIDUAL;
    if (typeOfApplication === 'adult-child') return APPLICANT_CATEGORY_CODE_FAMILY;
    return APPLICANT_CATEGORY_CODE_DEPENDENT_ONLY;
  }

  mapBenefitRenewalResponseEntityToApplicationCode(benefitRenewalResponseEntity: BenefitRenewalResponseEntity): string {
    const applicationCode = benefitRenewalResponseEntity.BenefitApplication.BenefitApplicationIdentification[0]?.IdentificationID;
    return expectDefined(applicationCode, 'Expected applicationCode to be defined');
  }
}
