import { inject, injectable } from 'inversify';

import type { ServerConfig } from '~/.server/configs';
import { TYPES } from '~/.server/constants';
import type { GCCommunicationMethodDto, GCCommunicationMethodLocalizedDto } from '~/.server/domain/dtos';
import { GCCommunicationMethodNotFoundException } from '~/.server/domain/exceptions';
import type { GCCommunicationMethodDtoMapper } from '~/.server/domain/mappers';
import { createLogger } from '~/.server/logging';
import type { Logger } from '~/.server/logging';

/**
 * Service interface for managing GC communication method data.
 */
export interface GCCommunicationMethodService {
  /**
   * Retrieves a list of all GC communication methods.
   *
   * @returns An array of GC Communication Method DTOs.
   */
  listGCCommunicationMethods(): ReadonlyArray<GCCommunicationMethodDto>;

  /**
   * Retrieves a specific GC communication method by its ID.
   *
   * @param id - The ID of the GC communication method to retrieve.
   * @returns The GC Communication Method DTO corresponding to the specified ID.
   * @throws {GCCommunicationMethodNotFoundException} If no GC communication method is found with the specified ID.
   */
  getGCCommunicationMethodById(id: string): GCCommunicationMethodDto;

  /**
   * Retrieves a list of all GC communication methods in the specified locale.
   *
   * @param locale - The desired locale (e.g., 'en' or 'fr').
   * @returns An array of GC Communication Method DTOs in the specified locale.
   */
  listLocalizedGCCommunicationMethods(locale: AppLocale): ReadonlyArray<GCCommunicationMethodLocalizedDto>;

  /**
   * Retrieves a specific GC communication method by its ID in the specified locale.
   *
   * @param id - The ID of the GC communication method to retrieve.
   * @param locale - The desired locale (e.g., 'en' or 'fr').
   * @returns The GC Communication Method DTO corresponding to the specified ID in the given locale.
   * @throws {GCCommunicationMethodNotFoundException} If no GC communication method is found with the specified ID.
   */
  getLocalizedGCCommunicationMethodById(id: string, locale: AppLocale): GCCommunicationMethodLocalizedDto;
}

export type DefaultGCCommunicationMethodService_ServiceConfig = Pick<ServerConfig, 'COMMUNICATION_METHOD_GC_DIGITAL_ID' | 'COMMUNICATION_METHOD_GC_MAIL_ID'>;

@injectable()
export class DefaultGCCommunicationMethodService implements GCCommunicationMethodService {
  private readonly log: Logger;
  private readonly gcCommunicationMethodDtoMapper: GCCommunicationMethodDtoMapper;
  private readonly gcCommunicationMethodDtos: ReadonlyArray<GCCommunicationMethodDto>;

  constructor(
    @inject(TYPES.GCCommunicationMethodDtoMapper) gcCommunicationMethodDtoMapper: GCCommunicationMethodDtoMapper, //
    @inject(TYPES.ServerConfig) serverConfig: DefaultGCCommunicationMethodService_ServiceConfig,
  ) {
    this.log = createLogger('DefaultGCCommunicationMethodService');
    this.gcCommunicationMethodDtoMapper = gcCommunicationMethodDtoMapper;

    this.gcCommunicationMethodDtos = [
      { id: serverConfig.COMMUNICATION_METHOD_GC_DIGITAL_ID.toString(), code: 'digital', nameEn: 'Online through My Service Canada Account (MSCA)', nameFr: "En ligne, par l'entremise de Mon dossier Service Canada (MDSC)" },
      { id: serverConfig.COMMUNICATION_METHOD_GC_MAIL_ID.toString(), code: 'mail', nameEn: 'By mail', nameFr: 'Par la poste' },
    ];
  }

  listGCCommunicationMethods(): ReadonlyArray<GCCommunicationMethodDto> {
    this.log.debug('Get all GC communication methods');
    this.log.trace('Returning GC communication methods: [%j]', this.gcCommunicationMethodDtos);
    return this.gcCommunicationMethodDtos;
  }

  getGCCommunicationMethodById(id: string): GCCommunicationMethodDto {
    this.log.debug('Get GC communication method with id: [%s]', id);
    const gcCommunicationMethodDto = this.gcCommunicationMethodDtos.find((dto) => dto.id === id);

    if (!gcCommunicationMethodDto) {
      this.log.error('GC communication method with id: [%s] not found', id);
      throw new GCCommunicationMethodNotFoundException(`GC communication method with id: [${id}] not found`);
    }

    this.log.trace('Returning GC communication method: [%j]', gcCommunicationMethodDto);
    return gcCommunicationMethodDto;
  }

  listLocalizedGCCommunicationMethods(locale: AppLocale): ReadonlyArray<GCCommunicationMethodLocalizedDto> {
    this.log.debug('Get all localized GC communication methods with locale: [%s]', locale);
    const gcCommunicationMethodDtos = this.listGCCommunicationMethods();
    const localizedGCCommunicationMethodDtos = this.gcCommunicationMethodDtoMapper.mapGCCommunicationMethodDtosToGCCommunicationMethodLocalizedDtos(gcCommunicationMethodDtos, locale);
    this.log.trace('Returning localized GC communication methods: [%j]', localizedGCCommunicationMethodDtos);
    return localizedGCCommunicationMethodDtos;
  }

  getLocalizedGCCommunicationMethodById(id: string, locale: AppLocale): GCCommunicationMethodLocalizedDto {
    this.log.debug('Get localized GC communication method with id: [%s] and locale: [%s]', id, locale);
    const gcCommunicationMethodDto = this.getGCCommunicationMethodById(id);
    const localizedGCCommunicationMethodDto = this.gcCommunicationMethodDtoMapper.mapGCCommunicationMethodDtoToGCCommunicationMethodLocalizedDto(gcCommunicationMethodDto, locale);
    this.log.trace('Returning localized GC communication method: [%j]', localizedGCCommunicationMethodDto);
    return localizedGCCommunicationMethodDto;
  }
}
