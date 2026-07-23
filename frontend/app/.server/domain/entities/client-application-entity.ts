import type { ReadonlyDeep } from 'type-fest';

export type ClientApplicationEntity = ReadonlyDeep<{
  BenefitApplication: {
    Applicant: {
      ApplicantDetail: {
        ApplicantEmailVerifiedIndicator: boolean;
        InsurancePlan?: Array<{
          InsurancePlanIdentification: Array<{
            IdentificationID: string;
            IdentificationCategoryText?: string;
          }>;
        }>;
        InvitationToApplyIndicator: boolean;
        LivingIndependentlyIndicator: boolean;
        PreviousApplicationIndicator: boolean;
        PreviousTaxesFiledIndicator: boolean;
        PrivateDentalInsuranceIndicator: boolean;
      };
      ApplicantEarning: Array<{
        BenefitEligibilityStatus: {
          StatusCode: {
            ReferenceDataID: string;
          };
        };
        Coverage: Array<{
          CoverageCategoryCode: {
            ReferenceDataName: string;
          };
          CoverageTierCode: {
            ReferenceDataID: string;
          };
        }>;
        PrivateDentalInsuranceIndicator: boolean;
      }>;
      ClientIdentification: Array<{
        IdentificationID: string;
        IdentificationCategoryText?: string;
      }>;
      PersonBirthDate: {
        date: string;
      };
      PersonContactInformation: Array<{
        Address: Array<{
          AddressCategoryCode: {
            ReferenceDataName: string;
          };
          AddressCityName?: string;
          AddressCountry: {
            CountryCode: {
              ReferenceDataID?: string;
            };
          };
          AddressPostalCode?: string;
          AddressProvince: {
            ProvinceCode: {
              ReferenceDataID?: string;
            };
          };
          AddressSecondaryUnitText?: string;
          AddressStreet: {
            StreetName?: string;
          };
        }>;
        EmailAddress?: Array<{
          EmailAddressID: string;
        }>;
        TelephoneNumber?: Array<{
          TelephoneNumberCategoryCode: {
            ReferenceDataID: string;
            ReferenceDataName: string;
          };
        }>;
      }>;
      PersonLanguage: Array<{
        CommunicationCategoryCode: {
          ReferenceDataID: string;
        };
        PreferredIndicator: boolean;
      }>;
      PersonMaritalStatus: {
        StatusCode?: {
          ReferenceDataID?: string;
        };
      };
      PersonName: Array<{
        PersonGivenName: Array<string>;
        PersonSurName: string;
      }>;
      PersonSINIdentification: {
        IdentificationID: string;
      };
      MailingSameAsHomeIndicator: boolean;
      PreferredMethodCommunicationCode: {
        ReferenceDataID: string;
      };
      PreferredMethodCommunicationGCCode: {
        ReferenceDataID: string;
      };
      RelatedPerson?: Array<{
        PersonBirthDate: {
          date?: string;
          YearDate?: string;
        };
        PersonName: Array<{
          PersonGivenName: Array<string | null>;
          PersonSurName?: string;
        }>;
        PersonRelationshipCode: {
          ReferenceDataName: 'Spouse' | 'Dependant';
        };
        PersonSINIdentification: {
          IdentificationID: string;
        };
        ApplicantDetail: {
          PrivateDentalInsuranceIndicator?: boolean;
          InsurancePlan?: Array<{
            InsurancePlanIdentification: Array<{
              IdentificationID: string;
              IdentificationCategoryText?: string;
            }>;
          }>;
          AttestParentOrGuardianIndicator?: boolean;
        };
        ClientIdentification: Array<{
          IdentificationID: string;
          IdentificationCategoryText?: string;
        }>;
      }>;
    };
    BenefitApplicationCategoryCode: {
      ReferenceDataID: string;
    };
    BenefitApplicationYear: {
      BenefitApplicationYearIdentification: Array<{
        IdentificationID: string;
      }>;
    };
  };
}>;

export type ClientApplicationBasicInfoRequestEntity = ReadonlyDeep<{
  Applicant: {
    PersonName: {
      PersonGivenName: Array<string>;
      PersonSurName: string;
    };
    PersonBirthDate: {
      date: string;
    };
    ClientIdentification: Array<{
      IdentificationID: string;
      IdentificationCategoryText: 'Client Number';
    }>;
  };
  BenefitApplicationYear?: {
    IdentificationID: string;
  };
}>;

export type ClientApplicationSinRequestEntity = ReadonlyDeep<{
  Applicant: {
    PersonSINIdentification: {
      IdentificationID: string;
    };
  };
  BenefitApplicationYear?: {
    IdentificationID: string;
  };
}>;
