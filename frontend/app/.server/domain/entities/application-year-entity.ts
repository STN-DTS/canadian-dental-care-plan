import type { ReadonlyDeep } from 'type-fest';

export type ApplicationYearResultEntity = ReadonlyDeep<{
  BenefitApplicationYear: {
    BenefitApplicationYearIdentification: {
      IdentificationID: string;
    };
    BenefitApplicationYearTaxYear: {
      YearDate: string;
    };
    DependentEligibilityEndDate: {
      date: string;
    };
  };
}>;
