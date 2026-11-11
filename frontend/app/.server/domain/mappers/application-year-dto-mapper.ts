import { injectable } from 'inversify';

import type { ApplicationYearResultDto } from '~/.server/domain/dtos';
import type { ApplicationYearResultEntity } from '~/.server/domain/entities';
import { Traced } from '~/.server/observability/decorator';

export interface ApplicationYearDtoMapper {
  mapApplicationYearResultEntityToApplicationYearResultDto(applicationYearResultEntity: ApplicationYearResultEntity): ApplicationYearResultDto;
}

@injectable()
export class DefaultApplicationYearDtoMapper implements ApplicationYearDtoMapper {
  @Traced()
  mapApplicationYearResultEntityToApplicationYearResultDto(applicationYearResultEntity: ApplicationYearResultEntity): ApplicationYearResultDto {
    // Application year is always the year after the tax year
    const taxYear = applicationYearResultEntity.BenefitApplicationYear.BenefitApplicationYearTaxYear.YearDate;
    const applicationYear = (Number.parseInt(taxYear) + 1).toString();

    return {
      applicationYearId: applicationYearResultEntity.BenefitApplicationYear.BenefitApplicationYearIdentification.IdentificationID,
      applicationYear: applicationYear,
      taxYear: taxYear,
      dependentEligibilityEndDate: applicationYearResultEntity.BenefitApplicationYear.DependentEligibilityEndDate.date,
    };
  }
}
