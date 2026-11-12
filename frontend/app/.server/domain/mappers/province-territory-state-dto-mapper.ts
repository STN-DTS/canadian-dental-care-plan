import { injectable } from 'inversify';

import type { ProvinceTerritoryStateDto, ProvinceTerritoryStateLocalizedDto } from '~/.server/domain/dtos';
import type { ProvinceTerritoryStateEntity } from '~/.server/domain/entities';

export interface ProvinceTerritoryStateDtoMapper {
  mapProvinceTerritoryStateDtoToProvinceTerritoryStateLocalizedDto(provinceTerritoryStateDto: ProvinceTerritoryStateDto, locale: AppLocale): ProvinceTerritoryStateLocalizedDto;
  mapProvinceTerritoryStateDtosToProvinceTerritoryStateLocalizedDtos(provinceTerritoryStateDtos: ReadonlyArray<ProvinceTerritoryStateDto>, locale: AppLocale): ReadonlyArray<ProvinceTerritoryStateLocalizedDto>;
  mapProvinceTerritoryStateEntityToProvinceTerritoryStateDto(provinceTerritoryStateEntity: ProvinceTerritoryStateEntity): ProvinceTerritoryStateDto;
  mapProvinceTerritoryStateEntitiesToProvinceTerritoryStateDtos(provinceTerritoryStateEntities: ReadonlyArray<ProvinceTerritoryStateEntity>): ReadonlyArray<ProvinceTerritoryStateDto>;
}

@injectable()
export class DefaultProvinceTerritoryStateDtoMapper implements ProvinceTerritoryStateDtoMapper {
  mapProvinceTerritoryStateDtoToProvinceTerritoryStateLocalizedDto(provinceTerritoryStateDto: ProvinceTerritoryStateDto, locale: AppLocale): ProvinceTerritoryStateLocalizedDto {
    const { nameEn, nameFr, ...rest } = provinceTerritoryStateDto;
    return {
      ...rest,
      name: locale === 'fr' ? nameFr : nameEn,
    };
  }

  mapProvinceTerritoryStateDtosToProvinceTerritoryStateLocalizedDtos(provinceTerritoryStateDtos: ReadonlyArray<ProvinceTerritoryStateDto>, locale: AppLocale): ReadonlyArray<ProvinceTerritoryStateLocalizedDto> {
    return provinceTerritoryStateDtos.map((dto) => this.mapProvinceTerritoryStateDtoToProvinceTerritoryStateLocalizedDto(dto, locale));
  }

  mapProvinceTerritoryStateEntityToProvinceTerritoryStateDto(provinceTerritoryStateEntity: ProvinceTerritoryStateEntity): ProvinceTerritoryStateDto {
    const id = provinceTerritoryStateEntity.esdc_provinceterritorystateid;
    const countryId = provinceTerritoryStateEntity._esdc_countryid_value;
    const nameEn = provinceTerritoryStateEntity.esdc_nameenglish;
    const nameFr = provinceTerritoryStateEntity.esdc_namefrench;
    const abbr = provinceTerritoryStateEntity.esdc_internationalalphacode;
    return { id, countryId, nameEn, nameFr, abbr };
  }

  mapProvinceTerritoryStateEntitiesToProvinceTerritoryStateDtos(provinceTerritoryStateEntities: ProvinceTerritoryStateEntity[]): ProvinceTerritoryStateDto[] {
    return provinceTerritoryStateEntities.map((entity) => this.mapProvinceTerritoryStateEntityToProvinceTerritoryStateDto(entity));
  }
}
