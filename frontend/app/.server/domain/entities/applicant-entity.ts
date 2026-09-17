import type { ReadonlyDeep } from 'type-fest';

export type FindApplicantByBasicInfoRequestEntity = ReadonlyDeep<{
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
}>;

export type FindApplicantBySinRequestEntity = ReadonlyDeep<{
  Applicant: {
    PersonSINIdentification: {
      IdentificationID: string;
    };
  };
}>;

export type ApplicantResponseEntity = ReadonlyDeep<{
  BenefitApplication: {
    Applicant: {
      /**
       * Interop maps the Power Platform `esdc_applicanttype` field to
       * `ApplicantCategoryCode.ReferenceDataID`. Power Platform assigns this
       * value only after the applicant successfully completes an application
       * for the first time. When the source field is null, Interop may return
       * an empty `ApplicantCategoryCode` object.
       */
      ApplicantCategoryCode: {
        ReferenceDataID?: string;
      };
      ClientIdentification: Array<{
        IdentificationID: string;
        IdentificationCategoryText: 'Client ID' | 'Client Number';
      }>;
      PersonBirthDate: {
        date: string;
      };
      PersonContactInformation: Array<{
        Address: Array<{
          AddressCategoryCode: {
            ReferenceDataName: 'Mailing' | 'Home';
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
        EmailAddress: Array<{
          EmailAddressID?: string;
        }>;
        TelephoneNumber: Array<{
          FullTelephoneNumber?: {
            TelephoneNumberFullID?: string;
          };
          TelephoneNumberCategoryCode: {
            ReferenceDataName: 'Primary' | 'Alternate';
          };
        }>;
      }>;
      PersonMaritalStatus?: {
        StatusCode?: {
          ReferenceDataID?: string;
        };
      };
      PersonName: Array<{
        PersonGivenName: Array<string>;
        PersonSurName: string;
      }>;
      PersonSINIdentification?: {
        IdentificationID?: string;
      };
      PersonLanguage: Array<{
        CommunicationCategoryCode?: {
          ReferenceDataID?: string;
        };
        PreferredIndicator?: boolean;
      }>;
      PreferredMethodCommunicationCode?: {
        ReferenceDataID?: string;
      };
      PreferredMethodCommunicationGCCode?: {
        ReferenceDataID?: string;
      };
    };
  };
}>;
