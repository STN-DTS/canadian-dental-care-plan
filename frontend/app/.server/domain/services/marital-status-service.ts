import { inject, injectable } from 'inversify';

import type { ServerConfig } from '~/.server/configs';
import { TYPES } from '~/.server/constants';
import type { MaritalStatusDto, MaritalStatusLocalizedDto } from '~/.server/domain/dtos';
import { MaritalStatusNotFoundException } from '~/.server/domain/exceptions';
import type { MaritalStatusDtoMapper } from '~/.server/domain/mappers';
import { createLogger } from '~/.server/logging';
import type { Logger } from '~/.server/logging';

/**
 * Service interface for managing marital status data.
 */
export interface MaritalStatusService {
  /**
   * Retrieves a list of all marital statuses.
   *
   * @returns An array of Marital Status DTOs.
   */
  listMaritalStatuses(): ReadonlyArray<MaritalStatusDto>;

  /**
   * Retrieves a specific marital status by its ID.
   *
   * @param id - The ID of the marital status to retrieve.
   * @returns The Marital Status DTO corresponding to the specified ID.
   * @throws {MaritalStatusNotFoundException} If no marital status is found with the specified ID.
   */
  getMaritalStatusById(id: string): MaritalStatusDto;

  /**
   * Retrieves a list of all marital statuses in the specified locale.
   *
   * @param locale - The desired locale (e.g., 'en' or 'fr').
   * @returns An array of Marital Status DTOs in the specified locale.
   */
  listLocalizedMaritalStatuses(locale: AppLocale): ReadonlyArray<MaritalStatusLocalizedDto>;

  /**
   * Retrieves a specific marital status by its ID in the specified locale.
   *
   * @param id - The ID of the marital status to retrieve.
   * @param locale - The desired locale (e.g., 'en' or 'fr').
   * @returns The Marital Status DTO corresponding to the specified ID in the given locale.
   * @throws {MaritalStatusNotFoundException} If no marital status is found with the specified ID.
   */
  getLocalizedMaritalStatusById(id: string, locale: AppLocale): MaritalStatusLocalizedDto;
}

export type DefaultMaritalStatusService_ServiceConfig = Pick<
  ServerConfig,
  | 'MARITAL_STATUS_CODE_COMMON_LAW' //
  | 'MARITAL_STATUS_CODE_DIVORCED'
  | 'MARITAL_STATUS_CODE_MARRIED'
  | 'MARITAL_STATUS_CODE_SEPARATED'
  | 'MARITAL_STATUS_CODE_SINGLE'
  | 'MARITAL_STATUS_CODE_WIDOWED'
>;

@injectable()
export class DefaultMaritalStatusService implements MaritalStatusService {
  private readonly log: Logger;
  private readonly maritalStatusDtoMapper: MaritalStatusDtoMapper;
  private readonly maritalStatusDtos: ReadonlyArray<MaritalStatusDto>;

  constructor(
    @inject(TYPES.MaritalStatusDtoMapper) maritalStatusDtoMapper: MaritalStatusDtoMapper, //
    @inject(TYPES.ServerConfig) serverConfig: DefaultMaritalStatusService_ServiceConfig,
  ) {
    this.log = createLogger('DefaultMaritalStatusService');
    this.maritalStatusDtoMapper = maritalStatusDtoMapper;

    this.maritalStatusDtos = [
      { id: serverConfig.MARITAL_STATUS_CODE_SINGLE, nameEn: 'Single', nameFr: 'Célibataire' },
      { id: serverConfig.MARITAL_STATUS_CODE_MARRIED, nameEn: 'Married', nameFr: 'Marié(e)' },
      { id: serverConfig.MARITAL_STATUS_CODE_COMMON_LAW, nameEn: 'Common-Law', nameFr: 'Conjoint(e) de fait' },
      { id: serverConfig.MARITAL_STATUS_CODE_SEPARATED, nameEn: 'Separated', nameFr: 'Séparé(e)' },
      { id: serverConfig.MARITAL_STATUS_CODE_DIVORCED, nameEn: 'Divorced', nameFr: 'Divorcé(e)' },
      { id: serverConfig.MARITAL_STATUS_CODE_WIDOWED, nameEn: 'Widowed', nameFr: 'Veuf ou veuve' },
    ];
  }

  listMaritalStatuses(): ReadonlyArray<MaritalStatusDto> {
    this.log.debug('Get all marital statuses');
    this.log.trace('Returning marital statuses: [%j]', this.maritalStatusDtos);
    return this.maritalStatusDtos;
  }

  getMaritalStatusById(id: string): MaritalStatusDto {
    this.log.debug('Get marital status with id: [%s]', id);
    const maritalStatusDto = this.maritalStatusDtos.find((dto) => dto.id === id);

    if (!maritalStatusDto) {
      this.log.error('marital status with id: [%s] not found', id);
      throw new MaritalStatusNotFoundException(`marital status with id: [${id}] not found`);
    }

    this.log.trace('Returning marital status: [%j]', maritalStatusDto);
    return maritalStatusDto;
  }

  listLocalizedMaritalStatuses(locale: AppLocale): ReadonlyArray<MaritalStatusLocalizedDto> {
    this.log.debug('Get all localized marital statuses with locale: [%s]', locale);
    const maritalStatusDtos = this.listMaritalStatuses();
    const localizedMaritalStatusDtos = this.maritalStatusDtoMapper.mapMaritalStatusDtosToMaritalStatusLocalizedDtos(maritalStatusDtos, locale);
    this.log.trace('Returning localized marital statuses: [%j]', localizedMaritalStatusDtos);
    return localizedMaritalStatusDtos;
  }

  getLocalizedMaritalStatusById(id: string, locale: AppLocale): MaritalStatusLocalizedDto {
    this.log.debug('Get localized marital status with id: [%s] and locale: [%s]', id, locale);
    const maritalStatusDto = this.getMaritalStatusById(id);
    const localizedMaritalStatusDto = this.maritalStatusDtoMapper.mapMaritalStatusDtoToMaritalStatusLocalizedDto(maritalStatusDto, locale);
    this.log.trace('Returning localized marital status: [%j]', localizedMaritalStatusDto);
    return localizedMaritalStatusDto;
  }
}
