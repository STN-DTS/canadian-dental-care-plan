import type { ReadonlyDeep } from 'type-fest';

export type BenefitRenewalRequestEntity = ReadonlyDeep<{
  BenefitApplication: {
    Applicant: {
      ApplicantDetail: {
        PrivateDentalInsuranceIndicator?: boolean;
        LivingIndependentlyIndicator?: boolean;
        MaritalStatusChangedIndicator?: boolean;
        AddressChangedIndicator?: boolean;
        PhoneChangedIndicator?: boolean;
        EmailChangedIndicator?: boolean;
        ApplicantEmailVerifiedIndicator?: boolean;
        PublicInsuranceChangedIndicator?: boolean;
        TermsAndConditionsIndicator: boolean;
        PrivacyStatementIndicator: boolean;
        SharingConsentIndicator: boolean;
        EligibilityAttestationIndicator: boolean;
        AccuracyConfirmationIndicator: boolean;
        InsurancePlan?: {
          InsurancePlanIdentification?: {
            IdentificationID?: string;
          }[];
        }[];
      };
      BenefitApplicationDetail: {
        BenefitApplicationDetailID: string;
        BenefitApplicationDetailValue?: string;
        BenefitApplicationDetailValues?: string[];
        BenefitApplicationDetailIndicator?: boolean;
      }[];
      ClientIdentification: {
        IdentificationID: string;
        IdentificationCategoryText: string;
      }[];
      PersonBirthDate: {
        date: string;
      };
      PersonContactInformation: {
        Address: {
          AddressCategoryCode: {
            ReferenceDataName: string;
          };
          AddressCityName: string;
          AddressCountry: {
            CountryCode: {
              ReferenceDataID: string;
            };
          };
          AddressPostalCode: string;
          AddressProvince: {
            ProvinceCode: {
              ReferenceDataID: string;
            };
          };
          AddressSecondaryUnitText: string;
          AddressStreet: {
            StreetName: string;
          };
        }[];
        EmailAddress: {
          EmailAddressID: string;
        }[];
        TelephoneNumber: {
          TelephoneNumberCategoryCode: {
            ReferenceDataID: string;
            ReferenceDataName: string;
          };
        }[];
      }[];
      PersonLanguage: {
        CommunicationCategoryCode: {
          ReferenceDataID: string;
        };
        PreferredIndicator: boolean;
      }[];
      PersonMaritalStatus: {
        StatusCode: {
          ReferenceDataID: string;
        };
      };
      PersonName: {
        PersonGivenName: string[];
        PersonSurName: string;
      }[];
      PersonSINIdentification: {
        IdentificationID: string;
      };
      RelatedPerson: {
        ApplicantDetail: {
          PrivateDentalInsuranceIndicator?: boolean;
          InsurancePlan?: {
            InsurancePlanIdentification?: {
              IdentificationID?: string;
            }[];
          }[];
          ConsentToSharePersonalInformationIndicator?: true;
          AttestParentOrGuardianIndicator?: boolean;
        };
        BenefitApplicationDetail?: {
          BenefitApplicationDetailID: string;
          BenefitApplicationDetailValue?: string;
          BenefitApplicationDetailValues?: string[];
          BenefitApplicationDetailIndicator?: boolean;
        }[];
        ClientIdentification?: {
          IdentificationID: string;
          IdentificationCategoryText: string;
        }[];
        PersonBirthDate: {
          date?: string;
          YearDate?: string;
        };
        PersonName?: {
          PersonGivenName: string[];
          PersonSurName: string;
        }[];
        PersonRelationshipCode: {
          ReferenceDataName: 'Spouse' | 'Dependant';
        };
        PersonSINIdentification: {
          IdentificationID: string;
        };
      }[];
      MailingSameAsHomeIndicator: boolean;
      PreferredMethodCommunicationCode: {
        ReferenceDataID: string;
      };
      PreferredMethodCommunicationGCCode: {
        ReferenceDataID: string;
      };
    };
    BenefitApplicationCategoryCode: {
      ReferenceDataID: string;
      ReferenceDataName: 'New' | 'Renewal';
    };
    BenefitApplicationChannelCode: {
      ReferenceDataID: string;
    };
    BenefitApplicationYear: {
      BenefitApplicationYearIdentification: {
        IdentificationID: string;
      }[];
    };
  };
}>;

export type BenefitRenewalResponseEntity = ReadonlyDeep<{
  BenefitApplication: {
    BenefitApplicationIdentification: {
      IdentificationID: string;
      IdentificationCategoryText: string;
    }[];
  };
}>;
