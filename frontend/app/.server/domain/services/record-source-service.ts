import { inject, injectable } from 'inversify';

import { TYPES } from '~/.server/constants';
import type { RecordSourceDto, RecordSourceLocalizedDto } from '~/.server/domain/dtos';
import { RecordSourceNotFoundException } from '~/.server/domain/exceptions';
import type { RecordSourceDtoMapper } from '~/.server/domain/mappers';
import { createLogger } from '~/.server/logging';
import type { Logger } from '~/.server/logging';

/**
 * Service interface for managing record source data.
 */
export interface RecordSourceService {
  /**
   * Retrieves a list of all record sources.
   */
  listRecordSources(): ReadonlyArray<RecordSourceDto>;

  /**
   * Retrieves a specific record source by its ID.
   */
  getRecordSourceById(id: string): RecordSourceDto;

  /**
   * Retrieves a list of all record sources in the specified locale.
   */
  listLocalizedRecordSources(locale: AppLocale): ReadonlyArray<RecordSourceLocalizedDto>;

  /**
   * Retrieves a specific record source by its ID in the specified locale.
   */
  getLocalizedRecordSourceById(id: string, locale: AppLocale): RecordSourceLocalizedDto;
}

@injectable()
export class DefaultRecordSourceService implements RecordSourceService {
  private readonly log: Logger;
  private readonly recordSourceDtoMapper: RecordSourceDtoMapper;
  private readonly recordSourceDtos: ReadonlyArray<RecordSourceDto>;

  constructor(@inject(TYPES.RecordSourceDtoMapper) recordSourceDtoMapper: RecordSourceDtoMapper) {
    this.log = createLogger('DefaultRecordSourceService');
    this.recordSourceDtoMapper = recordSourceDtoMapper;

    this.recordSourceDtos = [
      { id: '775170000', nameEn: 'Officer', nameFr: 'Agent' },
      { id: '775170001', nameEn: 'Online', nameFr: 'En ligne' },
      { id: '775170002', nameEn: 'API', nameFr: 'API' },
      { id: '775170003', nameEn: 'IVR', nameFr: 'RVI' },
      { id: '775170004', nameEn: 'MSCA', nameFr: 'MDSC' },
    ];
  }

  listRecordSources(): ReadonlyArray<RecordSourceDto> {
    this.log.debug('Get all record sources');
    this.log.trace('Returning record sources: [%j]', this.recordSourceDtos);
    return this.recordSourceDtos;
  }

  getRecordSourceById(id: string): RecordSourceDto {
    this.log.debug('Get record source with id: [%s]', id);
    const recordSourceDto = this.recordSourceDtos.find((dto) => dto.id === id);

    if (!recordSourceDto) {
      this.log.error('record source with id: [%s] not found', id);
      throw new RecordSourceNotFoundException(`record source with id: [${id}] not found`);
    }

    this.log.trace('Returning record source: [%j]', recordSourceDto);
    return recordSourceDto;
  }

  listLocalizedRecordSources(locale: AppLocale): ReadonlyArray<RecordSourceLocalizedDto> {
    this.log.debug('Get all localized record sources with locale: [%s]', locale);
    const recordSourceDtos = this.listRecordSources();
    const localizedRecordSourceDtos = this.recordSourceDtoMapper.mapRecordSourceDtosToRecordSourceLocalizedDtos(recordSourceDtos, locale);
    this.log.trace('Returning localized record sources: [%j]', localizedRecordSourceDtos);
    return localizedRecordSourceDtos;
  }

  getLocalizedRecordSourceById(id: string, locale: AppLocale): RecordSourceLocalizedDto {
    this.log.debug('Get localized record source with id: [%s] and locale: [%s]', id, locale);
    const recordSourceDto = this.getRecordSourceById(id);
    const localizedRecordSourceDto = this.recordSourceDtoMapper.mapRecordSourceDtoToRecordSourceLocalizedDto(recordSourceDto, locale);
    this.log.trace('Returning localized record source: [%j]', localizedRecordSourceDto);
    return localizedRecordSourceDto;
  }
}
