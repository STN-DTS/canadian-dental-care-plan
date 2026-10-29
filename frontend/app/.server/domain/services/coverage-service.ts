import { injectable } from 'inversify';

import type { CoverageDto } from '~/.server/domain/dtos';
import { createLogger } from '~/.server/logging';
import type { Logger } from '~/.server/logging';

/**
 * Service interface for managing coverage information.
 * Provides methods to retrieve coverage details for specific dates or the current period.
 */
export interface CoverageService {
  /**
   * Retrieves coverage information for a specific date.
   * @param date - The date for which to retrieve coverage information
   * @returns Coverage details for the specified date
   */
  getCoverage(date: Temporal.PlainDate): CoverageDto;

  /**
   * Retrieves the current coverage information.
   * @returns Coverage details for the current period
   */
  getCurrentCoverage(): CoverageDto;
}

@injectable()
export class DefaultCoverageService implements CoverageService {
  private readonly log: Logger;

  constructor() {
    this.log = createLogger('DefaultCoverageService');
  }

  getCoverage(date: Temporal.PlainDate): CoverageDto {
    this.log.trace('Finding coverage with date: [%s]', date.toString());
    // Subtract one year if month is less than July
    const startYear = date.year - (date.month < 7 ? 1 : 0);
    const endYear = startYear + 1;
    return {
      endDate: `${endYear}-06-30T23:59:59.999Z`,
      endYear,
      startDate: `${startYear}-07-01T00:00:00.000Z`,
      startYear,
      taxationYear: startYear - 1,
    };
  }

  getCurrentCoverage(): CoverageDto {
    this.log.trace('Finding current coverage');
    return this.getCoverage(Temporal.Now.plainDateISO('UTC'));
  }
}
