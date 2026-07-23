import { inject, injectable } from 'inversify';

import type { ServerConfig } from '~/.server/configs';
import { TYPES } from '~/.server/constants';
import type { SunLifeCommunicationMethodDto, SunLifeCommunicationMethodLocalizedDto } from '~/.server/domain/dtos';
import { SunLifeCommunicationMethodNotFoundException } from '~/.server/domain/exceptions';
import type { SunLifeCommunicationMethodDtoMapper } from '~/.server/domain/mappers';
import { createLogger } from '~/.server/logging';
import type { Logger } from '~/.server/logging';

/**
 * Service interface for managing SunLife communication method data.
 */
export interface SunLifeCommunicationMethodService {
  /**
   * Retrieves a list of all SunLife communication methods.
   *
   * @returns An array of SunLife Communication Method DTOs.
   */
  listSunLifeCommunicationMethods(): ReadonlyArray<SunLifeCommunicationMethodDto>;

  /**
   * Retrieves a specific SunLife communication method by its ID.
   *
   * @param id - The ID of the SunLife communication method to retrieve.
   * @returns The SunLife Communication Method DTO corresponding to the specified ID.
   * @throws {SunLifeCommunicationMethodNotFoundException} If no SunLife communication method is found with the specified ID.
   */
  getSunLifeCommunicationMethodById(id: string): SunLifeCommunicationMethodDto;

  /**
   * Retrieves a list of all SunLife communication methods in the specified locale.
   *
   * @param locale - The desired locale (e.g., 'en' or 'fr').
   * @returns An array of SunLife Communication Method DTOs in the specified locale.
   */
  listLocalizedSunLifeCommunicationMethods(locale: AppLocale): ReadonlyArray<SunLifeCommunicationMethodLocalizedDto>;

  /**
   * Retrieves a specific SunLife communication method by its ID in the specified locale.
   *
   * @param id - The ID of the SunLife communication method to retrieve.
   * @param locale - The desired locale (e.g., 'en' or 'fr').
   * @returns The SunLife Communication Method DTO corresponding to the specified ID in the given locale.
   * @throws {SunLifeCommunicationMethodNotFoundException} If no SunLife communication method is found with the specified ID.
   */
  getLocalizedSunLifeCommunicationMethodById(id: string, locale: AppLocale): SunLifeCommunicationMethodLocalizedDto;
}

export type DefaultSunLifeCommunicationMethodService_ServiceConfig = Pick<ServerConfig, 'COMMUNICATION_METHOD_SUNLIFE_EMAIL_ID' | 'COMMUNICATION_METHOD_SUNLIFE_MAIL_ID'>;

@injectable()
export class DefaultSunLifeCommunicationMethodService implements SunLifeCommunicationMethodService {
  private readonly log: Logger;
  private readonly sunLifeCommunicationMethodDtoMapper: SunLifeCommunicationMethodDtoMapper;
  private readonly sunLifeCommunicationMethodDtos: ReadonlyArray<SunLifeCommunicationMethodDto>;

  constructor(
    @inject(TYPES.SunLifeCommunicationMethodDtoMapper) sunLifeCommunicationMethodDtoMapper: SunLifeCommunicationMethodDtoMapper, //
    @inject(TYPES.ServerConfig) serverConfig: DefaultSunLifeCommunicationMethodService_ServiceConfig,
  ) {
    this.log = createLogger('DefaultSunLifeCommunicationMethodService');
    this.sunLifeCommunicationMethodDtoMapper = sunLifeCommunicationMethodDtoMapper;

    this.sunLifeCommunicationMethodDtos = [
      { id: serverConfig.COMMUNICATION_METHOD_SUNLIFE_EMAIL_ID.toString(), code: 'email', nameEn: 'By email', nameFr: 'Par courriel' },
      { id: serverConfig.COMMUNICATION_METHOD_SUNLIFE_MAIL_ID.toString(), code: 'mail', nameEn: 'By mail', nameFr: 'Par la poste' },
    ];
  }

  listSunLifeCommunicationMethods(): ReadonlyArray<SunLifeCommunicationMethodDto> {
    this.log.debug('Get all SunLife communication methods');
    this.log.trace('Returning SunLife communication methods: [%j]', this.sunLifeCommunicationMethodDtos);
    return this.sunLifeCommunicationMethodDtos;
  }

  getSunLifeCommunicationMethodById(id: string): SunLifeCommunicationMethodDto {
    this.log.debug('Get SunLife communication method with id: [%s]', id);
    const sunLifeCommunicationMethodDto = this.sunLifeCommunicationMethodDtos.find((dto) => dto.id === id);

    if (!sunLifeCommunicationMethodDto) {
      this.log.error('SunLife communication method with id: [%s] not found', id);
      throw new SunLifeCommunicationMethodNotFoundException(`SunLife communication method with id: [${id}] not found`);
    }

    this.log.trace('Returning SunLife communication method: [%j]', sunLifeCommunicationMethodDto);
    return sunLifeCommunicationMethodDto;
  }

  listLocalizedSunLifeCommunicationMethods(locale: AppLocale): ReadonlyArray<SunLifeCommunicationMethodLocalizedDto> {
    this.log.debug('Get all localized SunLife communication methods with locale: [%s]', locale);
    const sunLifeCommunicationMethodDtos = this.listSunLifeCommunicationMethods();
    const localizedSunLifeCommunicationMethodDtos = this.sunLifeCommunicationMethodDtoMapper.mapSunLifeCommunicationMethodDtosToSunLifeCommunicationMethodLocalizedDtos(sunLifeCommunicationMethodDtos, locale);
    this.log.trace('Returning localized SunLife communication methods: [%j]', localizedSunLifeCommunicationMethodDtos);
    return localizedSunLifeCommunicationMethodDtos;
  }

  getLocalizedSunLifeCommunicationMethodById(id: string, locale: AppLocale): SunLifeCommunicationMethodLocalizedDto {
    this.log.debug('Get localized SunLife communication method with id: [%s] and locale: [%s]', id, locale);
    const sunLifeCommunicationMethodDto = this.getSunLifeCommunicationMethodById(id);
    const localizedSunLifeCommunicationMethodDto = this.sunLifeCommunicationMethodDtoMapper.mapSunLifeCommunicationMethodDtoToSunLifeCommunicationMethodLocalizedDto(sunLifeCommunicationMethodDto, locale);
    this.log.trace('Returning localized SunLife communication method: [%j]', localizedSunLifeCommunicationMethodDto);
    return localizedSunLifeCommunicationMethodDto;
  }
}
