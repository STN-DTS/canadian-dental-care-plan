import { injectable } from 'inversify';

import type { RecordSourceDto, RecordSourceLocalizedDto } from '~/.server/domain/dtos';

/**
 * Interface defining methods for mapping between RecordSourceDto and RecordSourceLocalizedDto.
 */
export interface RecordSourceDtoMapper {
  /**
   * Maps an array of RecordSourceDto objects to an array of RecordSourceLocalizedDto objects,
   * applying localization based on the provided locale.
   */
  mapRecordSourceDtosToRecordSourceLocalizedDtos(recordSourceDtos: ReadonlyArray<RecordSourceDto>, locale: AppLocale): ReadonlyArray<RecordSourceLocalizedDto>;

  /**
   * Maps a single RecordSourceDto object to a RecordSourceLocalizedDto object,
   * applying localization based on the provided locale.
   */
  mapRecordSourceDtoToRecordSourceLocalizedDto(recordSourceDto: RecordSourceDto, locale: AppLocale): RecordSourceLocalizedDto;
}

@injectable()
export class DefaultRecordSourceDtoMapper implements RecordSourceDtoMapper {
  mapRecordSourceDtoToRecordSourceLocalizedDto(recordSourceDto: RecordSourceDto, locale: AppLocale): RecordSourceLocalizedDto {
    const { nameEn, nameFr, ...rest } = recordSourceDto;
    return {
      ...rest,
      name: locale === 'fr' ? nameFr : nameEn,
    };
  }

  mapRecordSourceDtosToRecordSourceLocalizedDtos(recordSourceDtos: ReadonlyArray<RecordSourceDto>, locale: AppLocale): ReadonlyArray<RecordSourceLocalizedDto> {
    return recordSourceDtos.map((dto) => this.mapRecordSourceDtoToRecordSourceLocalizedDto(dto, locale));
  }
}
