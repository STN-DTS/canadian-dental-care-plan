import { injectable } from 'inversify';

import type { LetterTypeDto, LetterTypeLocalizedDto } from '~/.server/domain/dtos';
import type { LetterTypeEntity } from '~/.server/domain/entities';
import { Traced } from '~/.server/observability/decorator';

export interface LetterTypeDtoMapper {
  mapLetterTypeDtoToLetterTypeLocalizedDto(LetterTypeDto: LetterTypeDto, locale: AppLocale): LetterTypeLocalizedDto;
  mapLetterTypeDtosToLetterTypeLocalizedDtos(LetterTypeDtos: ReadonlyArray<LetterTypeDto>, locale: AppLocale): ReadonlyArray<LetterTypeLocalizedDto>;
  mapLetterTypeEntityToLetterTypeDto(LetterTypeEntity: LetterTypeEntity): LetterTypeDto;
  mapLetterTypeEntitiesToLetterTypeDtos(LetterTypeEntities: ReadonlyArray<LetterTypeEntity>): ReadonlyArray<LetterTypeDto>;
}

@injectable()
export class DefaultLetterTypeDtoMapper implements LetterTypeDtoMapper {
  @Traced()
  mapLetterTypeDtoToLetterTypeLocalizedDto(LetterTypeDto: LetterTypeDto, locale: AppLocale): LetterTypeLocalizedDto {
    const { nameEn, nameFr, ...rest } = LetterTypeDto;
    return {
      ...rest,
      name: locale === 'fr' ? nameFr : nameEn,
    };
  }

  @Traced()
  mapLetterTypeDtosToLetterTypeLocalizedDtos(LetterTypeDtos: ReadonlyArray<LetterTypeDto>, locale: AppLocale): ReadonlyArray<LetterTypeLocalizedDto> {
    return LetterTypeDtos.map((dto) => this.mapLetterTypeDtoToLetterTypeLocalizedDto(dto, locale));
  }

  @Traced()
  mapLetterTypeEntityToLetterTypeDto(LetterTypeEntity: LetterTypeEntity): LetterTypeDto {
    const id = LetterTypeEntity.esdc_value;
    const nameEn = LetterTypeEntity.esdc_ParentId ? `${LetterTypeEntity.esdc_ParentId.esdc_portalnameenglish} - ${LetterTypeEntity.esdc_portalnameenglish}` : LetterTypeEntity.esdc_portalnameenglish;
    const nameFr = LetterTypeEntity.esdc_ParentId ? `${LetterTypeEntity.esdc_ParentId.esdc_portalnamefrench} - ${LetterTypeEntity.esdc_portalnamefrench}` : LetterTypeEntity.esdc_portalnamefrench;
    return { id, nameEn, nameFr };
  }

  @Traced()
  mapLetterTypeEntitiesToLetterTypeDtos(LetterTypeEntities: ReadonlyArray<LetterTypeEntity>): ReadonlyArray<LetterTypeDto> {
    return LetterTypeEntities.map((entity) => this.mapLetterTypeEntityToLetterTypeDto(entity));
  }
}
