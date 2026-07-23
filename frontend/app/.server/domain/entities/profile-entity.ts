import type { ReadonlyDeep } from 'type-fest';

export type UpdateDentalBenefitsRequestEntity = ReadonlyDeep<{
  BenefitApplication: {
    Applicant: {
      ApplicantDetail: {
        InsurancePlan: Array<{
          InsurancePlanFederalIdentification: {
            IdentificationID: string;
          };
          InsurancePlanProvincialIdentification: {
            IdentificationID: string;
          };
        }>;
      };
      ClientIdentification: Array<{
        IdentificationID: string;
        IdentificationCategoryText: 'Guid Primary Key';
      }>;
    };
  };
}>;

export type UpdateEmailAddressRequestEntity = ReadonlyDeep<{
  BenefitApplication: {
    Applicant: {
      ApplicantDetail: {
        ApplicantEmailVerifiedIndicator: boolean;
      };
      ClientIdentification: Array<{
        IdentificationID: string;
        IdentificationCategoryText: 'Guid Primary Key';
      }>;
      PersonContactInformation: Array<{
        EmailAddress: Array<{
          EmailAddressID: string;
        }>;
      }>;
    };
  };
}>;

export type UpdatePhoneNumbersRequestEntity = ReadonlyDeep<{
  BenefitApplication: {
    Applicant: {
      ClientIdentification: Array<{
        IdentificationID: string;
        IdentificationCategoryText: 'Guid Primary Key';
      }>;
      PersonContactInformation: Array<{
        TelephoneNumber: Array<{
          TelephoneNumberCategoryCode: {
            ReferenceDataID: string;
            ReferenceDataName: 'Primary' | 'Alternate';
          };
        }>;
      }>;
    };
  };
}>;

export type UpdateAddressRequestEntity = ReadonlyDeep<{
  BenefitApplication: {
    Applicant: {
      ClientIdentification: Array<{
        IdentificationID: string;
        IdentificationCategoryText: 'Guid Primary Key';
      }>;
      MailingSameAsHomeIndicator: boolean;
      PersonContactInformation: Array<{
        Address: Array<{
          AddressCategoryCode: {
            ReferenceDataName: 'Home' | 'Mailing';
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
        }>;
      }>;
    };
  };
}>;

export type UpdateCommunicationPreferenceRequestEntity = ReadonlyDeep<{
  BenefitApplication: {
    Applicant: {
      ClientIdentification: Array<{
        IdentificationID: string;
        IdentificationCategoryText: 'Guid Primary Key';
      }>;
      PersonLanguage: Array<{
        CommunicationCategoryCode: {
          ReferenceDataID: string;
        };
        PreferredIndicator: boolean;
      }>;
      PreferredMethodCommunicationCode: {
        ReferenceDataID: string;
      };
      PreferredMethodCommunicationGCCode: {
        ReferenceDataID: string;
      };
    };
  };
}>;
