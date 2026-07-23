import { inject, injectable } from 'inversify';

import type { ServerConfig } from '~/.server/configs';
import { TYPES } from '~/.server/constants';
import type { LetterTypeDto, LetterTypeLocalizedDto } from '~/.server/domain/dtos';
import type { LetterTypeEntity } from '~/.server/domain/entities';

export interface LetterTypeDtoMapper {
  mapLetterTypeDtoToLetterTypeLocalizedDto(LetterTypeDto: LetterTypeDto, locale: AppLocale): LetterTypeLocalizedDto;
  mapLetterTypeDtosToLetterTypeLocalizedDtos(LetterTypeDtos: ReadonlyArray<LetterTypeDto>, locale: AppLocale): ReadonlyArray<LetterTypeLocalizedDto>;
  mapLetterTypeEntityToLetterTypeDto(LetterTypeEntity: LetterTypeEntity): LetterTypeDto;
  mapLetterTypeEntitiesToLetterTypeDtos(LetterTypeEntities: ReadonlyArray<LetterTypeEntity>): ReadonlyArray<LetterTypeDto>;
}

type LetterTypeDtoMapperImpl_ServerConfig = Pick<ServerConfig, 'ENGLISH_LANGUAGE_CODE' | 'FRENCH_LANGUAGE_CODE'>;

@injectable()
export class DefaultLetterTypeDtoMapper implements LetterTypeDtoMapper {
  private readonly serverConfig: LetterTypeDtoMapperImpl_ServerConfig;

  constructor(@inject(TYPES.ServerConfig) serverConfig: LetterTypeDtoMapperImpl_ServerConfig) {
    this.serverConfig = serverConfig;
  }

  mapLetterTypeDtoToLetterTypeLocalizedDto(LetterTypeDto: LetterTypeDto, locale: AppLocale): LetterTypeLocalizedDto {
    const { nameEn, nameFr, ...rest } = LetterTypeDto;
    return {
      ...rest,
      name: locale === 'fr' ? nameFr : nameEn,
    };
  }

  mapLetterTypeDtosToLetterTypeLocalizedDtos(LetterTypeDtos: ReadonlyArray<LetterTypeDto>, locale: AppLocale): ReadonlyArray<LetterTypeLocalizedDto> {
    return LetterTypeDtos.map((dto) => this.mapLetterTypeDtoToLetterTypeLocalizedDto(dto, locale));
  }

  mapLetterTypeEntityToLetterTypeDto(LetterTypeEntity: LetterTypeEntity): LetterTypeDto {
    const id = LetterTypeEntity.esdc_value;
    const nameEn = LetterTypeEntity.esdc_ParentId ? `${LetterTypeEntity.esdc_ParentId.esdc_portalnameenglish} - ${LetterTypeEntity.esdc_portalnameenglish}` : LetterTypeEntity.esdc_portalnameenglish;
    const nameFr = LetterTypeEntity.esdc_ParentId ? `${LetterTypeEntity.esdc_ParentId.esdc_portalnamefrench} - ${LetterTypeEntity.esdc_portalnamefrench}` : LetterTypeEntity.esdc_portalnamefrench;
    return { id, nameEn, nameFr };
  }

  mapLetterTypeEntitiesToLetterTypeDtos(LetterTypeEntities: ReadonlyArray<LetterTypeEntity>): ReadonlyArray<LetterTypeDto> {
    return LetterTypeEntities.map((entity) => this.mapLetterTypeEntityToLetterTypeDto(entity));
  }
}
