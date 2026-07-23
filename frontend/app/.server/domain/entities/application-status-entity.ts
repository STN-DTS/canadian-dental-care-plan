import type { ReadonlyDeep } from 'type-fest';

export type ApplicationStatusEntity = ReadonlyDeep<{
  BenefitApplication: {
    BenefitApplicationStatus: Array<{
      ReferenceDataID?: string;
      ReferenceDataName: string;
    }>;
  };
}>;

export type ApplicationStatusBasicInfoRequestEntity = ReadonlyDeep<{
  BenefitApplication: {
    Applicant: {
      PersonName: Array<{
        PersonGivenName: Array<string>;
        PersonSurName: string;
      }>;
      PersonBirthDate: {
        date: string;
      };
      ClientIdentification: Array<{
        IdentificationID: string;
      }>;
    };
  };
}>;

export type ApplicationStatusSinRequestEntity = ReadonlyDeep<{
  BenefitApplication: {
    Applicant: {
      PersonSINIdentification: {
        IdentificationID: string;
      };
      ClientIdentification: Array<{
        IdentificationID: string;
      }>;
    };
  };
}>;
