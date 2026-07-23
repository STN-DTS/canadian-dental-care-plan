import { inject, injectable } from 'inversify';
import { memoize } from 'micro-memoize';
import type { Memoized, Options } from 'micro-memoize';
import { None, Some } from 'oxide.ts';
import type { Option } from 'oxide.ts';

import type { ServerConfig } from '~/.server/configs';
import { TYPES } from '~/.server/constants';
import type { FederalGovernmentInsurancePlanDto, FederalGovernmentInsurancePlanLocalizedDto } from '~/.server/domain/dtos';
import { FederalGovernmentInsurancePlanNotFoundException } from '~/.server/domain/exceptions';
import type { FederalGovernmentInsurancePlanDtoMapper } from '~/.server/domain/mappers';
import type { GovernmentInsurancePlanRepository } from '~/.server/domain/repositories';
import { createLogger } from '~/.server/logging';
import type { Logger } from '~/.server/logging';

/**
 * Service interface for managing federal government insurance plan data.
 */
export interface FederalGovernmentInsurancePlanService {
  /**
   * Finds a specific federal government insurance plan by its ID.
   * Returns null if no matching federal government insurance plan is found.
   *
   * @param id - The ID of the federal government insurance plan to retrieve.
   * @returns The FederalGovernmentInsurancePlan DTO corresponding to the specified ID or null if not found.
   */
  findFederalGovernmentInsurancePlanById(id: string): Promise<Option<FederalGovernmentInsurancePlanDto>>;

  /**
   * Retrieves a specific federal government insurance plan by its ID.
   *
   * @param id - The ID of the federal government insurance plan to retrieve.
   * @returns The FederalGovernmentInsurancePlan DTO corresponding to the specified ID.
   * @throws {FederalGovernmentInsurancePlanNotFoundException} If no federal government insurance plan is found with the specified ID
   */
  getFederalGovernmentInsurancePlanById(id: string): Promise<FederalGovernmentInsurancePlanDto>;

  /**
   * Retrieves a list of all federal government insurance plans.
   *
   * @returns An array of FederalGovernmentInsurancePlan DTOs.
   */
  listFederalGovernmentInsurancePlans(): Promise<ReadonlyArray<FederalGovernmentInsurancePlanDto>>;

  /**
   * Finds a specific federal government insurance plan by its ID in the specified locale.
   * Returns null if no matching federal government insurance plan is found for the specified locale.
   *
   * @param id - The ID of the federal government insurance plan to retrieve.
   * @param locale - The desired locale (e.g., 'en' or 'fr').
   * @returns The FederalGovernmentInsurancePlan DTO corresponding to the specified ID and locale or null if not found.
   */
  findLocalizedFederalGovernmentInsurancePlanById(id: string, locale: AppLocale): Promise<Option<FederalGovernmentInsurancePlanLocalizedDto>>;

  /**
   * Retrieves a specific federal government insurance plan by its ID in the specified locale.
   *
   * @param id - The ID of the federal government insurance plan to retrieve.
   * @param locale - The desired locale (e.g., 'en' or 'fr').
   * @returns The FederalGovernmentInsurancePlan DTO corresponding to the specified ID in the given locale.
   * @throws {FederalGovernmentInsurancePlanNotFoundException} If no federal government insurance plan is found with the specified ID
   */
  getLocalizedFederalGovernmentInsurancePlanById(id: string, locale: AppLocale): Promise<FederalGovernmentInsurancePlanLocalizedDto>;

  /**
   * Retrieves a list of all federal government insurance plans, sorted by name in the specified locale.
   *
   * @param locale - The desired locale (e.g., 'en' or 'fr').
   * @returns An array of FederalGovernmentInsurancePlanLocalized DTOs, sorted by name in the given locale.
   */
  listAndSortLocalizedFederalGovernmentInsurancePlans(locale: AppLocale): Promise<ReadonlyArray<FederalGovernmentInsurancePlanLocalizedDto>>;
}

@injectable()
export class DefaultFederalGovernmentInsurancePlanService implements FederalGovernmentInsurancePlanService {
  private readonly log: Logger;
  private readonly federalGovernmentInsurancePlanDtoMapper: FederalGovernmentInsurancePlanDtoMapper;
  private readonly governmentInsurancePlanRepository: GovernmentInsurancePlanRepository;
  private readonly serverConfig: Pick<ServerConfig, 'LOOKUP_SVC_ALL_FEDERAL_GOVERNMENT_INSURANCE_PLANS_CACHE_TTL_SECONDS' | 'LOOKUP_SVC_FEDERAL_GOVERNMENT_INSURANCE_PLAN_CACHE_TTL_SECONDS'>;

  constructor(
    @inject(TYPES.FederalGovernmentInsurancePlanDtoMapper) federalGovernmentInsurancePlanDtoMapper: FederalGovernmentInsurancePlanDtoMapper,
    @inject(TYPES.GovernmentInsurancePlanRepository) governmentInsurancePlanRepository: GovernmentInsurancePlanRepository,
    @inject(TYPES.ServerConfig) serverConfig: Pick<ServerConfig, 'LOOKUP_SVC_ALL_FEDERAL_GOVERNMENT_INSURANCE_PLANS_CACHE_TTL_SECONDS' | 'LOOKUP_SVC_FEDERAL_GOVERNMENT_INSURANCE_PLAN_CACHE_TTL_SECONDS'>,
  ) {
    this.log = createLogger('DefaultFederalGovernmentInsurancePlanService');
    this.federalGovernmentInsurancePlanDtoMapper = federalGovernmentInsurancePlanDtoMapper;
    this.governmentInsurancePlanRepository = governmentInsurancePlanRepository;
    this.serverConfig = serverConfig;
    this.init();
  }

  private init(): void {
    const allFederalGovernmentInsurancePlansCacheTTL = 1000 * this.serverConfig.LOOKUP_SVC_ALL_FEDERAL_GOVERNMENT_INSURANCE_PLANS_CACHE_TTL_SECONDS;
    const federalGovernmentInsurancePlanCacheTTL = 1000 * this.serverConfig.LOOKUP_SVC_FEDERAL_GOVERNMENT_INSURANCE_PLAN_CACHE_TTL_SECONDS;

    this.log.debug('Cache TTL values; allFederalGovernmentInsurancePlansCacheTTL: %d ms, federalGovernmentInsurancePlanCacheTTL: %d ms', allFederalGovernmentInsurancePlansCacheTTL, federalGovernmentInsurancePlanCacheTTL);

    this.listFederalGovernmentInsurancePlans = memoize(this.listFederalGovernmentInsurancePlans, {
      async: true,
      expires: allFederalGovernmentInsurancePlansCacheTTL,
    });

    type MemoizedListFederalGovernmentInsurancePlans = Memoized<typeof this.listFederalGovernmentInsurancePlans, Options<typeof this.listFederalGovernmentInsurancePlans>>;
    (this.listFederalGovernmentInsurancePlans as MemoizedListFederalGovernmentInsurancePlans).cache.on('add', () => this.log.info('Creating new listFederalGovernmentInsurancePlans memo'));

    this.findFederalGovernmentInsurancePlanById = memoize(this.findFederalGovernmentInsurancePlanById, {
      async: true,
      maxSize: Infinity,
      expires: federalGovernmentInsurancePlanCacheTTL,
    });

    type MemoizedFindFederalGovernmentInsurancePlanById = Memoized<typeof this.findFederalGovernmentInsurancePlanById, Options<typeof this.findFederalGovernmentInsurancePlanById>>;
    (this.findFederalGovernmentInsurancePlanById as MemoizedFindFederalGovernmentInsurancePlanById).cache.on('add', () => this.log.info('Creating new findFederalGovernmentInsurancePlanById memo'));

    this.getFederalGovernmentInsurancePlanById = memoize(this.getFederalGovernmentInsurancePlanById, {
      async: true,
      maxSize: Infinity,
      expires: federalGovernmentInsurancePlanCacheTTL,
    });

    type MemoizedGetFederalGovernmentInsurancePlanById = Memoized<typeof this.getFederalGovernmentInsurancePlanById, Options<typeof this.getFederalGovernmentInsurancePlanById>>;
    (this.getFederalGovernmentInsurancePlanById as MemoizedGetFederalGovernmentInsurancePlanById).cache.on('add', () => this.log.info('Creating new getFederalGovernmentInsurancePlanById memo'));

    this.log.debug('DefaultFederalGovernmentInsurancePlanService initiated.');
  }

  async listFederalGovernmentInsurancePlans(): Promise<ReadonlyArray<FederalGovernmentInsurancePlanDto>> {
    this.log.debug('Get all federal government insurance plans');
    const governmentInsurancePlanEntities = await this.governmentInsurancePlanRepository.listAllGovernmentInsurancePlans();
    const federalGovernmentInsurancePlanEntities = governmentInsurancePlanEntities.filter((entity) => entity._esdc_provinceterritorystateid_value === null);
    const federalGovernmentInsurancePlanDtos = this.federalGovernmentInsurancePlanDtoMapper.mapGovernmentInsurancePlanEntitiesToFederalGovernmentInsurancePlanDtos(federalGovernmentInsurancePlanEntities);
    this.log.trace('Returning federal government insurance plans: [%j]', federalGovernmentInsurancePlanDtos);
    return federalGovernmentInsurancePlanDtos;
  }

  async findFederalGovernmentInsurancePlanById(id: string): Promise<Option<FederalGovernmentInsurancePlanDto>> {
    this.log.debug('Finding federal government insurance plan with id: [%s]', id);
    const federalGovernmentInsurancePlans = await this.listFederalGovernmentInsurancePlans();
    const federalGovernmentInsurancePlanDto = federalGovernmentInsurancePlans.find((plan) => plan.id === id);

    if (!federalGovernmentInsurancePlanDto) {
      this.log.trace('Federal government insurance plan with id: [%s] not found. Returning null', id);
      return None;
    }

    this.log.trace('Returning federal government insurance plan: [%j]', federalGovernmentInsurancePlanDto);
    return Some(federalGovernmentInsurancePlanDto);
  }

  async getFederalGovernmentInsurancePlanById(id: string): Promise<FederalGovernmentInsurancePlanDto> {
    this.log.debug('Get federal government insurance plan with id: [%s]', id);
    const federalGovernmentInsurancePlanDtoOption = await this.findFederalGovernmentInsurancePlanById(id);

    if (federalGovernmentInsurancePlanDtoOption.isNone()) {
      this.log.error('Federal government insurance plan with id: [%s] not found', id);
      throw new FederalGovernmentInsurancePlanNotFoundException(`Federal government insurance plan with id: [${id}] not found`);
    }

    const federalGovernmentInsurancePlanDto = federalGovernmentInsurancePlanDtoOption.unwrap();

    this.log.trace('Returning federal government insurance plan: [%j]', federalGovernmentInsurancePlanDto);
    return federalGovernmentInsurancePlanDto;
  }

  async listAndSortLocalizedFederalGovernmentInsurancePlans(locale: AppLocale): Promise<ReadonlyArray<FederalGovernmentInsurancePlanLocalizedDto>> {
    this.log.debug('Get and sort all localized federal government insurance plans');
    const federalGovernmentInsurancePlanDtos = await this.listFederalGovernmentInsurancePlans();
    const federalGovernmentInsurancePlanLocalizedDtos = this.federalGovernmentInsurancePlanDtoMapper.mapFederalGovernmentInsurancePlanDtosToFederalGovernmentInsurancePlanLocalizedDtos(federalGovernmentInsurancePlanDtos, locale);
    const sortedFederalGovernmentInsurancePlanLocalizedDtos = this.sortFederalGovernmentInsurancePlanLocalizedDtos(federalGovernmentInsurancePlanLocalizedDtos, locale);
    this.log.trace('Returning localized and sorted federal government insurance plans: [%j]', sortedFederalGovernmentInsurancePlanLocalizedDtos);
    return sortedFederalGovernmentInsurancePlanLocalizedDtos;
  }

  async findLocalizedFederalGovernmentInsurancePlanById(id: string, locale: AppLocale): Promise<Option<FederalGovernmentInsurancePlanLocalizedDto>> {
    this.log.debug('Finding federal government insurance plan with id [%s] and locale [%s]', id, locale);
    const federalGovernmentInsurancePlanDto = await this.findFederalGovernmentInsurancePlanById(id);

    if (federalGovernmentInsurancePlanDto.isNone()) {
      this.log.trace('Federal government insurance plan with id [%s] not found. Returning null', id);
      return None;
    }

    const federalGovernmentInsurancePlanLocalizedDto = this.federalGovernmentInsurancePlanDtoMapper.mapFederalGovernmentInsurancePlanDtoToFederalGovernmentInsurancePlanLocalizedDto(federalGovernmentInsurancePlanDto.unwrap(), locale);

    this.log.trace('Returning federal government insurance plan: [%j]', federalGovernmentInsurancePlanLocalizedDto);
    return Some(federalGovernmentInsurancePlanLocalizedDto);
  }

  async getLocalizedFederalGovernmentInsurancePlanById(id: string, locale: AppLocale): Promise<FederalGovernmentInsurancePlanLocalizedDto> {
    this.log.debug('Get localized federal government insurance plan with id: [%s]', id);
    const federalGovernmentInsurancePlanDto = await this.getFederalGovernmentInsurancePlanById(id);
    const federalGovernmentInsurancePlanLocalizedDto = this.federalGovernmentInsurancePlanDtoMapper.mapFederalGovernmentInsurancePlanDtoToFederalGovernmentInsurancePlanLocalizedDto(federalGovernmentInsurancePlanDto, locale);
    this.log.trace('Returning localized federal government insurance plan: [%j]', federalGovernmentInsurancePlanLocalizedDto);
    return federalGovernmentInsurancePlanLocalizedDto;
  }

  private sortFederalGovernmentInsurancePlanLocalizedDtos(federalGovernmentInsurancePlanLocalizedDtos: ReadonlyArray<FederalGovernmentInsurancePlanLocalizedDto>, locale: AppLocale): ReadonlyArray<FederalGovernmentInsurancePlanLocalizedDto> {
    const sortByNamePredicate = (a: FederalGovernmentInsurancePlanLocalizedDto, b: FederalGovernmentInsurancePlanLocalizedDto) => a.name.localeCompare(b.name, locale);
    return federalGovernmentInsurancePlanLocalizedDtos.toSorted(sortByNamePredicate);
  }
}
