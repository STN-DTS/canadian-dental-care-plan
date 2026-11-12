import { injectable } from 'inversify';

import type { ProvincialGovernmentInsurancePlanDto, ProvincialGovernmentInsurancePlanLocalizedDto } from '~/.server/domain/dtos';
import type { GovernmentInsurancePlanEntity } from '~/.server/domain/entities';

export interface ProvincialGovernmentInsurancePlanDtoMapper {
  mapProvincialGovernmentInsurancePlanDtoToProvincialGovernmentInsurancePlanLocalizedDto(provincialGovernmentInsurancePlanDto: ProvincialGovernmentInsurancePlanDto, locale: AppLocale): ProvincialGovernmentInsurancePlanLocalizedDto;
  mapProvincialGovernmentInsurancePlanDtosToProvincialGovernmentInsurancePlanLocalizedDtos(
    provincialGovernmentInsurancePlanDtos: ReadonlyArray<ProvincialGovernmentInsurancePlanDto>,
    locale: AppLocale,
  ): ReadonlyArray<ProvincialGovernmentInsurancePlanLocalizedDto>;
  mapGovernmentInsurancePlanEntityToProvincialGovernmentInsurancePlanDto(provincialGovernmentInsurancePlanEntity: GovernmentInsurancePlanEntity): ProvincialGovernmentInsurancePlanDto;
  mapGovernmentInsurancePlanEntitiesToProvincialGovernmentInsurancePlanDtos(provincialGovernmentInsurancePlanEntities: ReadonlyArray<GovernmentInsurancePlanEntity>): ReadonlyArray<ProvincialGovernmentInsurancePlanDto>;
}

@injectable()
export class DefaultProvincialGovernmentInsurancePlanDtoMapper implements ProvincialGovernmentInsurancePlanDtoMapper {
  mapProvincialGovernmentInsurancePlanDtoToProvincialGovernmentInsurancePlanLocalizedDto(provincialGovernmentInsurancePlanDto: ProvincialGovernmentInsurancePlanDto, locale: AppLocale): ProvincialGovernmentInsurancePlanLocalizedDto {
    const { nameEn, nameFr, ...rest } = provincialGovernmentInsurancePlanDto;
    return {
      ...rest,
      name: locale === 'fr' ? nameFr : nameEn,
    };
  }

  mapProvincialGovernmentInsurancePlanDtosToProvincialGovernmentInsurancePlanLocalizedDtos(
    provincialGovernmentInsurancePlanDtos: ReadonlyArray<ProvincialGovernmentInsurancePlanDto>,
    locale: AppLocale,
  ): ReadonlyArray<ProvincialGovernmentInsurancePlanLocalizedDto> {
    return provincialGovernmentInsurancePlanDtos.map((dto) => this.mapProvincialGovernmentInsurancePlanDtoToProvincialGovernmentInsurancePlanLocalizedDto(dto, locale));
  }

  mapGovernmentInsurancePlanEntityToProvincialGovernmentInsurancePlanDto(provincialGovernmentInsurancePlanEntity: GovernmentInsurancePlanEntity): ProvincialGovernmentInsurancePlanDto {
    const id = provincialGovernmentInsurancePlanEntity.esdc_governmentinsuranceplanid;
    const nameEn = provincialGovernmentInsurancePlanEntity.esdc_nameenglish;
    const nameFr = provincialGovernmentInsurancePlanEntity.esdc_namefrench;
    const provinceTerritoryStateId = provincialGovernmentInsurancePlanEntity._esdc_provinceterritorystateid_value ?? '';
    return { id, nameEn, nameFr, provinceTerritoryStateId };
  }

  mapGovernmentInsurancePlanEntitiesToProvincialGovernmentInsurancePlanDtos(provincialGovernmentInsurancePlanEntities: GovernmentInsurancePlanEntity[]): ProvincialGovernmentInsurancePlanDto[] {
    return provincialGovernmentInsurancePlanEntities.map((entity) => this.mapGovernmentInsurancePlanEntityToProvincialGovernmentInsurancePlanDto(entity));
  }
}
