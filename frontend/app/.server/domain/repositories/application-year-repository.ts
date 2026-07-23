import { injectable } from 'inversify';

import type { ApplicationYearResultEntity } from '~/.server/domain/entities';
import type { Logger } from '~/.server/logging';
import { createLogger } from '~/.server/logging';

// TODO this repository will return static values until the Power Platform and Interop APIs are available for querying
// specific values related to application years.
export interface ApplicationYearRepository {
  /**
   * Returns all intake application year entities given a date
   *
   * @param date The date (in `YYYY-MM-DD` format) used to request the intake application years
   * @returns A promise that resolves to a `ApplicationYearResultEntity` object containing all intake application years.
   */
  getIntakeApplicationYear(date: string): ApplicationYearResultEntity;

  /**
   * Returns all renewal application year entities given a date
   *
   * @param date The date (in `YYYY-MM-DD` format) used to request the renewal application years
   * @returns A promise that resolves to a `ApplicationYearResultEntity` object containing all renewal application years.
   */
  getRenewalApplicationYear(date: string): ApplicationYearResultEntity;
}

@injectable()
export class DefaultApplicationYearRepository implements ApplicationYearRepository {
  private readonly log: Logger;

  constructor() {
    this.log = createLogger('DefaultApplicationYearRepository');
  }

  getIntakeApplicationYear(date: string): ApplicationYearResultEntity {
    this.log.trace('Retrieving intake application year entity for date: [%s]', date);

    const applicationYearResultEntity = {
      BenefitApplicationYear: {
        BenefitApplicationYearIdentification: {
          IdentificationID: '2c328e64-cec0-f011-8544-7ced8d05d4ca',
        },
        BenefitApplicationYearTaxYear: {
          YearDate: '2025',
        },
        DependentEligibilityEndDate: {
          date: '2026-06-01',
        },
      },
    };

    this.log.trace('Returning intake application year entity: [%j]', applicationYearResultEntity);
    return applicationYearResultEntity;
  }

  getRenewalApplicationYear(date: string): ApplicationYearResultEntity {
    this.log.trace('Retrieving renewal application year entity for date: [%s]', date);

    const applicationYearResultEntity = {
      BenefitApplicationYear: {
        BenefitApplicationYearIdentification: {
          IdentificationID: '2c328e64-cec0-f011-8544-7ced8d05d4ca',
        },
        BenefitApplicationYearTaxYear: {
          YearDate: '2025',
        },
        DependentEligibilityEndDate: {
          date: '2026-06-30',
        },
      },
    };

    this.log.trace('Returning renewal application year entity: [%j]', applicationYearResultEntity);
    return applicationYearResultEntity;
  }
}

@injectable()
export class MockApplicationYearRepository implements ApplicationYearRepository {
  private readonly log: Logger;

  constructor() {
    this.log = createLogger('MockApplicationYearRepository');
  }

  getIntakeApplicationYear(date: string): ApplicationYearResultEntity {
    this.log.trace('Retrieving intake application year entity for date: [%s]', date);

    const applicationYearResultEntity = {
      BenefitApplicationYear: {
        BenefitApplicationYearIdentification: {
          IdentificationID: '2c328e64-cec0-f011-8544-7ced8d05d4ca',
        },
        BenefitApplicationYearTaxYear: {
          YearDate: '2025',
        },
        DependentEligibilityEndDate: {
          date: '2026-06-01',
        },
      },
    };

    this.log.trace('Returning intake application year entity: [%j]', applicationYearResultEntity);
    return applicationYearResultEntity;
  }

  getRenewalApplicationYear(date: string): ApplicationYearResultEntity {
    this.log.trace('Retrieving renewal application year entity for date: [%s]', date);

    const applicationYearResultEntity = {
      BenefitApplicationYear: {
        BenefitApplicationYearIdentification: {
          IdentificationID: '2c328e64-cec0-f011-8544-7ced8d05d4ca',
        },
        BenefitApplicationYearTaxYear: {
          YearDate: '2025',
        },
        DependentEligibilityEndDate: {
          date: '2026-06-30',
        },
      },
    };

    this.log.trace('Returning renewal application year entity: [%j]', applicationYearResultEntity);
    return applicationYearResultEntity;
  }
}
