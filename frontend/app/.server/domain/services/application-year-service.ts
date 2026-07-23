import { inject, injectable } from 'inversify';
import { memoize } from 'micro-memoize';
import type { Memoized, Options } from 'micro-memoize';

import type { ServerConfig } from '~/.server/configs';
import { TYPES } from '~/.server/constants';
import type { ApplicationYearResultDto } from '~/.server/domain/dtos';
import type { ApplicationYearDtoMapper } from '~/.server/domain/mappers';
import type { ApplicationYearRepository } from '~/.server/domain/repositories';
import { createLogger } from '~/.server/logging';
import type { Logger } from '~/.server/logging';

export interface ApplicationYearService {
  /**
   * Fetches the intake application year DTO for a given date
   *
   * @param date The date sent to get the intake application year result in ISO 8601 format (e.g., "2024-12-25").
   * @returns An `ApplicationYearResultDto` object containing the intake application year result DTO
   * @throws {ApplicationYearNotFoundException} If no matching intake application year is found for the given date
   */
  getIntakeApplicationYear(date: string): ApplicationYearResultDto;

  /**
   * Fetches the renewal application year DTO for a given date
   *
   * @param date The date sent to get the renewal application year result in ISO 8601 format (e.g., "2024-12-25").
   * @returns An `ApplicationYearResultDto` object containing the renewal application year result DTO
   */
  getRenewalApplicationYear(date: string): ApplicationYearResultDto;
}

@injectable()
export class DefaultApplicationYearService implements ApplicationYearService {
  private readonly log: Logger;
  private readonly applicationYearDtoMapper: ApplicationYearDtoMapper;
  private readonly applicationYearRepository: ApplicationYearRepository;
  private readonly serverConfig: Pick<ServerConfig, 'LOOKUP_SVC_APPLICATION_YEAR_CACHE_TTL_SECONDS'>;

  constructor(
    @inject(TYPES.ApplicationYearDtoMapper) applicationYearDtoMapper: ApplicationYearDtoMapper,
    @inject(TYPES.ApplicationYearRepository) applicationYearRepository: ApplicationYearRepository,
    @inject(TYPES.ServerConfig) serverConfig: Pick<ServerConfig, 'LOOKUP_SVC_APPLICATION_YEAR_CACHE_TTL_SECONDS'>,
  ) {
    this.log = createLogger('DefaultApplicationYearService');
    this.applicationYearDtoMapper = applicationYearDtoMapper;
    this.applicationYearRepository = applicationYearRepository;
    this.serverConfig = serverConfig;
    this.init();
  }

  private init(): void {
    this.log.debug('Cache TTL value: %d ms', 1000 * this.serverConfig.LOOKUP_SVC_APPLICATION_YEAR_CACHE_TTL_SECONDS);

    this.getIntakeApplicationYear = memoize(this.getIntakeApplicationYear, {
      isKeyEqual: (cacheKey, key) => cacheKey.every((item, idx) => item.date === key[idx].date),
      maxSize: Infinity,
      expires: this.serverConfig.LOOKUP_SVC_APPLICATION_YEAR_CACHE_TTL_SECONDS * 1000,
    });

    type MemoizedGetIntakeApplicationYear = Memoized<typeof this.getIntakeApplicationYear, Options<typeof this.getIntakeApplicationYear>>;
    (this.getIntakeApplicationYear as MemoizedGetIntakeApplicationYear).cache.on('add', () => this.log.info('Creating new getIntakeApplicationYear memo'));

    this.getRenewalApplicationYear = memoize(this.getRenewalApplicationYear, {
      isKeyEqual: (cacheKey, key) => cacheKey.every((item, idx) => item.date === key[idx].date),
      maxSize: Infinity,
      expires: this.serverConfig.LOOKUP_SVC_APPLICATION_YEAR_CACHE_TTL_SECONDS * 1000,
    });

    type MemoizedGetRenewalApplicationYear = Memoized<typeof this.getRenewalApplicationYear, Options<typeof this.getRenewalApplicationYear>>;
    (this.getRenewalApplicationYear as MemoizedGetRenewalApplicationYear).cache.on('add', () => this.log.info('Creating new getRenewalApplicationYear memo'));

    this.log.debug('DefaultApplicationYearService initiated.');
  }

  getIntakeApplicationYear(date: string): ApplicationYearResultDto {
    this.log.trace('Finding intake application year results with date: [%s]', date);

    const intakeApplicationYearEntity = this.applicationYearRepository.getIntakeApplicationYear(date);
    const intakeApplicationYearResultDto = this.applicationYearDtoMapper.mapApplicationYearResultEntityToApplicationYearResultDto(intakeApplicationYearEntity);

    this.log.trace('Returning intake application year result: [%j]', intakeApplicationYearResultDto);
    return intakeApplicationYearResultDto;
  }

  getRenewalApplicationYear(date: string): ApplicationYearResultDto {
    this.log.trace('Finding renewal application year results with date: [%s]', date);

    const renewalApplicationYearEntity = this.applicationYearRepository.getRenewalApplicationYear(date);
    const renewalApplicationYearResultDto = this.applicationYearDtoMapper.mapApplicationYearResultEntityToApplicationYearResultDto(renewalApplicationYearEntity);

    this.log.trace('Returning renewal application year result: [%j]', renewalApplicationYearResultDto);
    return renewalApplicationYearResultDto;
  }
}
