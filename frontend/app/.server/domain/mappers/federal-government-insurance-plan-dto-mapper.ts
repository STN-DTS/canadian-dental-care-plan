import { injectable } from 'inversify';

import type { FederalGovernmentInsurancePlanDto, FederalGovernmentInsurancePlanLocalizedDto } from '~/.server/domain/dtos';
import type { GovernmentInsurancePlanEntity } from '~/.server/domain/entities';
import { Traced } from '~/.server/observability/decorator';

export interface FederalGovernmentInsurancePlanDtoMapper {
  mapFederalGovernmentInsurancePlanDtoToFederalGovernmentInsurancePlanLocalizedDto(federalGovernmentInsuranceDto: FederalGovernmentInsurancePlanDto, locale: AppLocale): FederalGovernmentInsurancePlanLocalizedDto;
  mapFederalGovernmentInsurancePlanDtosToFederalGovernmentInsurancePlanLocalizedDtos(federalGovernmentInsurancePlanDtos: ReadonlyArray<FederalGovernmentInsurancePlanDto>, locale: AppLocale): ReadonlyArray<FederalGovernmentInsurancePlanLocalizedDto>;
  mapGovernmentInsurancePlanEntityToFederalGovernmentInsurancePlanDto(federalGovernmentInsurancePlanEntity: GovernmentInsurancePlanEntity): FederalGovernmentInsurancePlanDto;
  mapGovernmentInsurancePlanEntitiesToFederalGovernmentInsurancePlanDtos(federalGovernmentInsurancePlanEntities: ReadonlyArray<GovernmentInsurancePlanEntity>): ReadonlyArray<FederalGovernmentInsurancePlanDto>;
}

@injectable()
export class DefaultFederalGovernmentInsurancePlanDtoMapper implements FederalGovernmentInsurancePlanDtoMapper {
  @Traced()
  mapFederalGovernmentInsurancePlanDtoToFederalGovernmentInsurancePlanLocalizedDto(federalGovernmentInsuranceDto: FederalGovernmentInsurancePlanDto, locale: AppLocale): FederalGovernmentInsurancePlanLocalizedDto {
    const { nameEn, nameFr, ...rest } = federalGovernmentInsuranceDto;
    return {
      ...rest,
      name: locale === 'fr' ? nameFr : nameEn,
    };
  }

  @Traced()
  mapFederalGovernmentInsurancePlanDtosToFederalGovernmentInsurancePlanLocalizedDtos(federalGovernmentInsurancePlanDtos: ReadonlyArray<FederalGovernmentInsurancePlanDto>, locale: AppLocale): ReadonlyArray<FederalGovernmentInsurancePlanLocalizedDto> {
    return federalGovernmentInsurancePlanDtos.map((dto) => this.mapFederalGovernmentInsurancePlanDtoToFederalGovernmentInsurancePlanLocalizedDto(dto, locale));
  }

  @Traced()
  mapGovernmentInsurancePlanEntityToFederalGovernmentInsurancePlanDto(federalGovernmentInsurancePlanEntity: GovernmentInsurancePlanEntity): FederalGovernmentInsurancePlanDto {
    const id = federalGovernmentInsurancePlanEntity.esdc_governmentinsuranceplanid;
    const nameEn = federalGovernmentInsurancePlanEntity.esdc_nameenglish;
    const nameFr = federalGovernmentInsurancePlanEntity.esdc_namefrench;
    return { id, nameEn, nameFr };
  }

  @Traced()
  mapGovernmentInsurancePlanEntitiesToFederalGovernmentInsurancePlanDtos(federalGovernmentInsurancePlanEntities: GovernmentInsurancePlanEntity[]): FederalGovernmentInsurancePlanDto[] {
    return federalGovernmentInsurancePlanEntities.map((entity) => this.mapGovernmentInsurancePlanEntityToFederalGovernmentInsurancePlanDto(entity));
  }
}
