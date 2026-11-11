import { Option } from 'effect';
import { inject, injectable } from 'inversify';
import { memoize } from 'micro-memoize';
import type { Memoized, Options } from 'micro-memoize';

import type { ServerConfig } from '~/.server/configs';
import { TYPES } from '~/.server/constants';
import type { ProvincialGovernmentInsurancePlanDto, ProvincialGovernmentInsurancePlanLocalizedDto } from '~/.server/domain/dtos';
import { ProvincialGovernmentInsurancePlanNotFoundException } from '~/.server/domain/exceptions';
import type { ProvincialGovernmentInsurancePlanDtoMapper } from '~/.server/domain/mappers';
import type { GovernmentInsurancePlanRepository } from '~/.server/domain/repositories';
import { createLogger } from '~/.server/logging';
import type { Logger } from '~/.server/logging';
import { ATTR_CDCP_CACHE_ITEM_TTL_MS, ATTR_CDCP_CACHE_LIST_TTL_MS, ATTR_CDCP_LOCALE, ATTR_CDCP_REFERENCE_COUNT } from '~/.server/logging/log-attributes';
import { Traced } from '~/.server/observability/decorator';

export interface ProvincialGovernmentInsurancePlanService {
  listProvincialGovernmentInsurancePlans(): Promise<ReadonlyArray<ProvincialGovernmentInsurancePlanDto>>;
  findProvincialGovernmentInsurancePlanById(id: string): Promise<Option.Option<ProvincialGovernmentInsurancePlanDto>>;
  getProvincialGovernmentInsurancePlanById(id: string): Promise<ProvincialGovernmentInsurancePlanDto>;
  listAndSortLocalizedProvincialGovernmentInsurancePlans(locale: AppLocale): Promise<ReadonlyArray<ProvincialGovernmentInsurancePlanLocalizedDto>>;
  findLocalizedProvincialGovernmentInsurancePlanById(id: string, locale: AppLocale): Promise<Option.Option<ProvincialGovernmentInsurancePlanLocalizedDto>>;
  getLocalizedProvincialGovernmentInsurancePlanById(id: string, locale: AppLocale): Promise<ProvincialGovernmentInsurancePlanLocalizedDto>;
}

@injectable()
export class DefaultProvincialGovernmentInsurancePlanService implements ProvincialGovernmentInsurancePlanService {
  private readonly log: Logger;
  private readonly provincialGovernmentInsurancePlanDtoMapper: ProvincialGovernmentInsurancePlanDtoMapper;
  private readonly governmentInsurancePlanRepository: GovernmentInsurancePlanRepository;
  private readonly serverConfig: Pick<ServerConfig, 'LOOKUP_SVC_ALL_PROVINCIAL_GOVERNMENT_INSURANCE_PLANS_CACHE_TTL_SECONDS' | 'LOOKUP_SVC_PROVINCIAL_GOVERNMENT_INSURANCE_PLAN_CACHE_TTL_SECONDS'>;

  constructor(
    @inject(TYPES.ProvincialGovernmentInsurancePlanDtoMapper) provincialGovernmentInsurancePlanDtoMapper: ProvincialGovernmentInsurancePlanDtoMapper,
    @inject(TYPES.GovernmentInsurancePlanRepository) governmentInsurancePlanRepository: GovernmentInsurancePlanRepository,
    @inject(TYPES.ServerConfig) serverConfig: Pick<ServerConfig, 'LOOKUP_SVC_ALL_PROVINCIAL_GOVERNMENT_INSURANCE_PLANS_CACHE_TTL_SECONDS' | 'LOOKUP_SVC_PROVINCIAL_GOVERNMENT_INSURANCE_PLAN_CACHE_TTL_SECONDS'>,
  ) {
    this.log = createLogger('DefaultProvincialGovernmentInsurancePlanService');
    this.provincialGovernmentInsurancePlanDtoMapper = provincialGovernmentInsurancePlanDtoMapper;
    this.governmentInsurancePlanRepository = governmentInsurancePlanRepository;
    this.serverConfig = serverConfig;
    this.init();
  }

  private init(): void {
    const allProvincialGovernmentInsurancePlansCacheTTL = 1000 * this.serverConfig.LOOKUP_SVC_ALL_PROVINCIAL_GOVERNMENT_INSURANCE_PLANS_CACHE_TTL_SECONDS;
    const provincialGovernmentInsurancePlanCacheTTL = 1000 * this.serverConfig.LOOKUP_SVC_PROVINCIAL_GOVERNMENT_INSURANCE_PLAN_CACHE_TTL_SECONDS;

    this.log.debug('Reference cache configured', { [ATTR_CDCP_CACHE_LIST_TTL_MS]: allProvincialGovernmentInsurancePlansCacheTTL, [ATTR_CDCP_CACHE_ITEM_TTL_MS]: provincialGovernmentInsurancePlanCacheTTL });

    this.listProvincialGovernmentInsurancePlans = memoize(this.listProvincialGovernmentInsurancePlans, {
      async: true,
      expires: allProvincialGovernmentInsurancePlansCacheTTL,
    });

    type MemoizedListProvincialGovernmentInsurancePlans = Memoized<typeof this.listProvincialGovernmentInsurancePlans, Options<typeof this.listProvincialGovernmentInsurancePlans>>;
    (this.listProvincialGovernmentInsurancePlans as MemoizedListProvincialGovernmentInsurancePlans).cache.on('add', () => this.log.debug('Creating new listProvincialGovernmentInsurancePlans memo'));

    this.findProvincialGovernmentInsurancePlanById = memoize(this.findProvincialGovernmentInsurancePlanById, {
      async: true,
      maxSize: Infinity,
      expires: provincialGovernmentInsurancePlanCacheTTL,
    });

    type MemoizedFindProvincialGovernmentInsurancePlanById = Memoized<typeof this.findProvincialGovernmentInsurancePlanById, Options<typeof this.findProvincialGovernmentInsurancePlanById>>;
    (this.findProvincialGovernmentInsurancePlanById as MemoizedFindProvincialGovernmentInsurancePlanById).cache.on('add', () => this.log.debug('Creating new findProvincialGovernmentInsurancePlanById memo'));

    this.getProvincialGovernmentInsurancePlanById = memoize(this.getProvincialGovernmentInsurancePlanById, {
      async: true,
      maxSize: Infinity,
      expires: provincialGovernmentInsurancePlanCacheTTL,
    });

    type MemoizedGetProvincialGovernmentInsurancePlanById = Memoized<typeof this.getProvincialGovernmentInsurancePlanById, Options<typeof this.getProvincialGovernmentInsurancePlanById>>;
    (this.getProvincialGovernmentInsurancePlanById as MemoizedGetProvincialGovernmentInsurancePlanById).cache.on('add', () => this.log.debug('Creating new getProvincialGovernmentInsurancePlanById memo'));

    this.log.debug('DefaultProvincialGovernmentInsurancePlanService initiated.');
  }

  @Traced()
  async listProvincialGovernmentInsurancePlans(): Promise<ReadonlyArray<ProvincialGovernmentInsurancePlanDto>> {
    this.log.debug('Get all provincial government insurance plans');
    const governmentInsurancePlanEntities = await this.governmentInsurancePlanRepository.listAllGovernmentInsurancePlans();
    const provincialGovernmentInsurancePlanEntities = governmentInsurancePlanEntities.filter((entity) => entity._esdc_provinceterritorystateid_value !== null);
    const provincialGovernmentInsurancePlanDtos = this.provincialGovernmentInsurancePlanDtoMapper.mapGovernmentInsurancePlanEntitiesToProvincialGovernmentInsurancePlanDtos(provincialGovernmentInsurancePlanEntities);
    this.log.trace('Returning provincial government insurance plans', { [ATTR_CDCP_REFERENCE_COUNT]: provincialGovernmentInsurancePlanDtos.length });
    return provincialGovernmentInsurancePlanDtos;
  }

  @Traced()
  async findProvincialGovernmentInsurancePlanById(id: string): Promise<Option.Option<ProvincialGovernmentInsurancePlanDto>> {
    this.log.debug('Finding provincial government insurance plan');
    const provincialGovernmentInsurancePlans = await this.listProvincialGovernmentInsurancePlans();
    const provincialGovernmentInsurancePlanDto = provincialGovernmentInsurancePlans.find((plan) => plan.id === id);

    if (!provincialGovernmentInsurancePlanDto) {
      this.log.trace('Provincial government insurance plan not found. Returning null');
      return Option.none();
    }

    this.log.trace('Returning provincial government insurance plan');
    return Option.some(provincialGovernmentInsurancePlanDto);
  }

  @Traced()
  async getProvincialGovernmentInsurancePlanById(id: string): Promise<ProvincialGovernmentInsurancePlanDto> {
    this.log.debug('Get provincial government insurance plan');
    const provincialGovernmentInsurancePlanDtoOption = await this.findProvincialGovernmentInsurancePlanById(id);

    if (Option.isNone(provincialGovernmentInsurancePlanDtoOption)) {
      throw new ProvincialGovernmentInsurancePlanNotFoundException(`Provincial government insurance plan with id: [${id}] not found`);
    }

    const provincialGovernmentInsurancePlanDto = Option.getOrThrow(provincialGovernmentInsurancePlanDtoOption);

    this.log.trace('Returning provincial government insurance plan');
    return provincialGovernmentInsurancePlanDto;
  }

  @Traced()
  async listAndSortLocalizedProvincialGovernmentInsurancePlans(locale: AppLocale): Promise<ReadonlyArray<ProvincialGovernmentInsurancePlanLocalizedDto>> {
    this.log.debug('Get and sort all localized provincial government insurance plans', { [ATTR_CDCP_LOCALE]: locale });
    const provincialGovernmentInsurancePlanDtos = await this.listProvincialGovernmentInsurancePlans();
    const provincialGovernmentInsurancePlanLocalizedDtos = this.provincialGovernmentInsurancePlanDtoMapper.mapProvincialGovernmentInsurancePlanDtosToProvincialGovernmentInsurancePlanLocalizedDtos(provincialGovernmentInsurancePlanDtos, locale);
    const sortedProvincialGovernmentInsurancePlanLocalizedDtos = this.sortLocalizedProvincialGovernmentInsurancePlanDtos(provincialGovernmentInsurancePlanLocalizedDtos, locale);
    this.log.trace('Returning localized and sorted provincial government insurance plans', { [ATTR_CDCP_LOCALE]: locale, [ATTR_CDCP_REFERENCE_COUNT]: sortedProvincialGovernmentInsurancePlanLocalizedDtos.length });
    return sortedProvincialGovernmentInsurancePlanLocalizedDtos;
  }

  @Traced()
  async findLocalizedProvincialGovernmentInsurancePlanById(id: string, locale: AppLocale): Promise<Option.Option<ProvincialGovernmentInsurancePlanLocalizedDto>> {
    this.log.debug('Finding provincial government insurance plan', { [ATTR_CDCP_LOCALE]: locale });
    const provincialGovernmentInsurancePlanDto = await this.findProvincialGovernmentInsurancePlanById(id);

    if (Option.isNone(provincialGovernmentInsurancePlanDto)) {
      this.log.trace('Provincial government insurance plan not found. Returning null', { [ATTR_CDCP_LOCALE]: locale });
      return Option.none();
    }

    const provincialGovernmentInsurancePlanLocalizedDto = this.provincialGovernmentInsurancePlanDtoMapper.mapProvincialGovernmentInsurancePlanDtoToProvincialGovernmentInsurancePlanLocalizedDto(
      Option.getOrThrow(provincialGovernmentInsurancePlanDto),
      locale,
    );
    this.log.trace('Returning provincial government insurance plan', { [ATTR_CDCP_LOCALE]: locale });
    return Option.some(provincialGovernmentInsurancePlanLocalizedDto);
  }

  @Traced()
  async getLocalizedProvincialGovernmentInsurancePlanById(id: string, locale: AppLocale): Promise<ProvincialGovernmentInsurancePlanLocalizedDto> {
    this.log.debug('Get localized provincial government insurance plan', { [ATTR_CDCP_LOCALE]: locale });
    const provincialGovernmentInsurancePlanDto = await this.getProvincialGovernmentInsurancePlanById(id);
    const provincialGovernmentInsurancePlanLocalizedDto = this.provincialGovernmentInsurancePlanDtoMapper.mapProvincialGovernmentInsurancePlanDtoToProvincialGovernmentInsurancePlanLocalizedDto(provincialGovernmentInsurancePlanDto, locale);
    this.log.trace('Returning localized provincial government insurance plan', { [ATTR_CDCP_LOCALE]: locale });
    return provincialGovernmentInsurancePlanLocalizedDto;
  }

  private sortLocalizedProvincialGovernmentInsurancePlanDtos(provincialGovernmentInsurancePlanLocalizedDtos: ReadonlyArray<ProvincialGovernmentInsurancePlanLocalizedDto>, locale: AppLocale): ReadonlyArray<ProvincialGovernmentInsurancePlanLocalizedDto> {
    const sortByNamePredicate = (a: ProvincialGovernmentInsurancePlanLocalizedDto, b: ProvincialGovernmentInsurancePlanLocalizedDto) => a.name.localeCompare(b.name, locale);
    return provincialGovernmentInsurancePlanLocalizedDtos.toSorted(sortByNamePredicate);
  }
}
