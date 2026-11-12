import { Option } from 'effect';
import { inject, injectable } from 'inversify';
import { memoize } from 'micro-memoize';
import type { Memoized, Options } from 'micro-memoize';

import type { ServerConfig } from '~/.server/configs';
import { TYPES } from '~/.server/constants';
import type { CountryDto, CountryLocalizedDto } from '~/.server/domain/dtos';
import { CountryNotFoundException } from '~/.server/domain/exceptions';
import type { CountryDtoMapper } from '~/.server/domain/mappers';
import type { CountryRepository } from '~/.server/domain/repositories';
import { createLogger } from '~/.server/logging';
import type { Logger } from '~/.server/logging';
import { ATTR_CDCP_CACHE_ITEM_TTL_MS, ATTR_CDCP_CACHE_LIST_TTL_MS, ATTR_CDCP_LOCALE, ATTR_CDCP_REFERENCE_COUNT } from '~/.server/logging/log-attributes';
import { moveToTop } from '~/.server/utils/collection-utils';

/**
 * Service interface for managing country data.
 */
export interface CountryService {
  /**
   * Retrieves a list of all countries.
   *
   * @returns An array of Country DTOs.
   */
  listCountries(): Promise<ReadonlyArray<CountryDto>>;

  /**
   * Retrieves a specific country by its ID.
   *
   * @param id - The ID of the country to retrieve.
   * @returns The Country DTO corresponding to the specified ID.
   * @throws {CountryNotFoundException} If no country is found with the specified ID.
   */
  getCountryById(id: string): Promise<CountryDto>;

  /**
   * Retrieves a list of all countries in the specified locale.
   *
   * @param locale - The desired locale (e.g., 'en' or 'fr').
   * @returns An array of Country DTOs in the specified locale.
   */
  listAndSortLocalizedCountries(locale: AppLocale): Promise<ReadonlyArray<CountryLocalizedDto>>;

  /**
   * Retrieves a specific country by its ID in the specified locale.
   *
   * @param id - The ID of the country to retrieve.
   * @param locale - The desired locale (e.g., 'en' or 'fr').
   * @returns The Country DTO corresponding to the specified ID in the given locale.
   * @throws {CountryNotFoundException} If no country is found with the specified ID.
   */
  getLocalizedCountryById(id: string, locale: AppLocale): Promise<CountryLocalizedDto>;
}

export type CountryServiceImpl_ServiceConfig = Pick<ServerConfig, 'CANADA_COUNTRY_ID' | 'LOOKUP_SVC_ALL_COUNTRIES_CACHE_TTL_SECONDS' | 'LOOKUP_SVC_COUNTRY_CACHE_TTL_SECONDS'>;

/**
 * Implementation of the CountryService interface.
 * This service provides methods to manage and retrieve country data,
 * including localized versions of the data.
 *
 * The service uses caching to optimize performance and reduce redundant
 * database lookups. It integrates with a logging system to trace operations.
 */
@injectable()
export class DefaultCountryService implements CountryService {
  private readonly log: Logger;
  private readonly countryDtoMapper: CountryDtoMapper;
  private readonly countryRepository: CountryRepository;
  private readonly serverConfig: CountryServiceImpl_ServiceConfig;

  /**
   * Constructs a new DefaultCountryService instance.
   *
   * @param logFactory - A factory for creating logger instances.
   * @param countryDtoMapper - The mapper responsible for transforming country entities into DTOs.
   * @param countryRepository - The repository for accessing country data.
   * @param serverConfig - The server configuration containing necessary constants and cache TTL values.
   */
  constructor(@inject(TYPES.CountryDtoMapper) countryDtoMapper: CountryDtoMapper, @inject(TYPES.CountryRepository) countryRepository: CountryRepository, @inject(TYPES.ServerConfig) serverConfig: CountryServiceImpl_ServiceConfig) {
    this.log = createLogger('DefaultCountryService');
    this.countryDtoMapper = countryDtoMapper;
    this.countryRepository = countryRepository;
    this.serverConfig = serverConfig;
    this.init();
  }

  private init(): void {
    // Configure caching for country operations
    const allCountriesCacheTTL = 1000 * this.serverConfig.LOOKUP_SVC_ALL_COUNTRIES_CACHE_TTL_SECONDS;
    const countryCacheTTL = 1000 * this.serverConfig.LOOKUP_SVC_COUNTRY_CACHE_TTL_SECONDS;

    this.log.debug('Reference cache configured', { [ATTR_CDCP_CACHE_LIST_TTL_MS]: allCountriesCacheTTL, [ATTR_CDCP_CACHE_ITEM_TTL_MS]: countryCacheTTL });

    this.listCountries = memoize(this.listCountries, {
      async: true,
      expires: allCountriesCacheTTL,
    });

    type MemoizedListCountries = Memoized<typeof this.listCountries, Options<typeof this.listCountries>>;
    (this.listCountries as MemoizedListCountries).cache.on('add', () => {
      this.log.debug('Creating new listCountries memo');
    });

    this.getCountryById = memoize(this.getCountryById, {
      async: true,
      expires: countryCacheTTL,
      maxSize: Infinity,
    });

    type MemoizedGetCountryById = Memoized<typeof this.getCountryById, Options<typeof this.getCountryById>>;
    (this.getCountryById as MemoizedGetCountryById).cache.on('add', () => {
      this.log.debug('Creating new getCountryById memo');
    });

    this.log.debug('DefaultCountryService initialized.');
  }

  /**
   * Retrieves a list of all countries.
   *
   * @returns An array of Country DTOs.
   */
  async listCountries(): Promise<ReadonlyArray<CountryDto>> {
    this.log.debug('Get all countries');
    const countryEntities = await this.countryRepository.listAllCountries();
    const countryDtos = this.countryDtoMapper.mapCountryEntitiesToCountryDtos(countryEntities);
    this.log.trace('Returning countries', { [ATTR_CDCP_REFERENCE_COUNT]: countryDtos.length });
    return countryDtos;
  }

  /**
   * Retrieves a specific country by its ID.
   *
   * @param id - The ID of the country to retrieve.
   * @returns The Country DTO corresponding to the specified ID.
   * @throws {CountryNotFoundException} If no country is found with the specified ID.
   */
  async getCountryById(id: string): Promise<CountryDto> {
    this.log.debug('Get country');
    const countryEntity = await this.countryRepository.findCountryById(id);

    if (Option.isNone(countryEntity)) {
      throw new CountryNotFoundException(`Country with id: [${id}] not found`);
    }

    const countryDto = this.countryDtoMapper.mapCountryEntityToCountryDto(Option.getOrThrow(countryEntity));
    this.log.trace('Returning country');
    return countryDto;
  }

  /**
   * Retrieves a list of all countries in the specified locale and sorts them.
   *
   * @param locale - The desired locale (e.g., 'en' or 'fr').
   * @returns An array of localized Country DTOs.
   */
  async listAndSortLocalizedCountries(locale: AppLocale): Promise<ReadonlyArray<CountryLocalizedDto>> {
    this.log.debug('Get and sort all localized countries', { [ATTR_CDCP_LOCALE]: locale });
    const countryDtos = await this.listCountries();
    const localizedCountryDtos = this.countryDtoMapper.mapCountryDtosToCountryLocalizedDtos(countryDtos, locale);
    const sortedLocalizedCountryDtos = this.sortLocalizedCountries(localizedCountryDtos, locale);
    this.log.trace('Returning sorted localized countries', { [ATTR_CDCP_LOCALE]: locale, [ATTR_CDCP_REFERENCE_COUNT]: sortedLocalizedCountryDtos.length });
    return sortedLocalizedCountryDtos;
  }

  /**
   * Retrieves a specific country by its ID in the specified locale.
   *
   * @param id - The ID of the country to retrieve.
   * @param locale - The desired locale (e.g., 'en' or 'fr').
   * @returns The localized Country DTO corresponding to the specified ID.
   * @throws {CountryNotFoundException} If no country is found with the specified ID.
   */
  async getLocalizedCountryById(id: string, locale: AppLocale): Promise<CountryLocalizedDto> {
    this.log.debug('Get localized country', { [ATTR_CDCP_LOCALE]: locale });
    const countryDto = await this.getCountryById(id);
    const localizedCountryDto = this.countryDtoMapper.mapCountryDtoToCountryLocalizedDto(countryDto, locale);
    this.log.trace('Returning localized country', { [ATTR_CDCP_LOCALE]: locale });
    return localizedCountryDto;
  }

  private sortLocalizedCountries(countries: ReadonlyArray<CountryLocalizedDto>, locale: AppLocale): ReadonlyArray<CountryLocalizedDto> {
    const sortByNamePredicate = (a: CountryLocalizedDto, b: CountryLocalizedDto) => a.name.localeCompare(b.name, locale);
    const moveCanadaToTopPredicate = (country: CountryLocalizedDto) => country.id === this.serverConfig.CANADA_COUNTRY_ID;
    return moveToTop(countries.toSorted(sortByNamePredicate), moveCanadaToTopPredicate);
  }
}
