import { inject, injectable } from 'inversify';
import { None, Option, Some } from 'oxide.ts';

import type { ServerConfig } from '~/.server/configs';
import { TYPES } from '~/.server/constants';
import type { GovernmentInsurancePlanEntity, GovernmentInsurancePlanResponseEntity } from '~/.server/domain/entities';
import type { HttpClient } from '~/.server/http';
import { createLogger } from '~/.server/logging';
import type { Logger } from '~/.server/logging';
import governmentInsurancePlanJsonDataSource from '~/.server/resources/power-platform/government-insurance-plan.json';
import { HttpStatusCodes } from '~/constants/http-status-codes';

export interface GovernmentInsurancePlanRepository {
  /**
   * Fetch all government insurance plan entities.
   * @returns All government insurance plan entities.
   */
  listAllGovernmentInsurancePlans(): Promise<ReadonlyArray<GovernmentInsurancePlanEntity>>;

  /**
   * Fetch a government insurance plan entity by its id.
   * @param id The id of the government insurance plan entity.
   * @returns The government insurance plan entity or null if not found.
   */
  findGovernmentInsurancePlanById(id: string): Promise<Option<GovernmentInsurancePlanEntity>>;

  /**
   * Retrieves metadata associated with the government insurance repository.
   *
   * @returns A record where the keys and values are strings representing metadata information.
   */
  getMetadata(): Record<string, string>;

  /**
   * Performs a health check to ensure that the government insurance repository is operational.
   *
   * @throws An error if the health check fails or the repository is unavailable.
   * @returns A promise that resolves when the health check completes successfully.
   */
  checkHealth(): Promise<void>;
}

export type DefaultGovernmentInsurancePlanRepositoryServerConfig = Pick<ServerConfig, 'HTTP_PROXY_URL' | 'INTEROP_API_BASE_URI' | 'INTEROP_API_SUBSCRIPTION_KEY' | 'INTEROP_API_MAX_RETRIES' | 'INTEROP_API_BACKOFF_MS'>;

@injectable()
export class DefaultGovernmentInsurancePlanRepository implements GovernmentInsurancePlanRepository {
  private readonly log: Logger;
  private readonly serverConfig: DefaultGovernmentInsurancePlanRepositoryServerConfig;
  private readonly httpClient: HttpClient;
  private readonly baseUrl: string;

  constructor(@inject(TYPES.ServerConfig) serverConfig: DefaultGovernmentInsurancePlanRepositoryServerConfig, @inject(TYPES.HttpClient) httpClient: HttpClient) {
    this.log = createLogger('DefaultGovernmentInsurancePlanRepository');
    this.serverConfig = serverConfig;
    this.httpClient = httpClient;
    this.baseUrl = `${this.serverConfig.INTEROP_API_BASE_URI}/dental-care/code-list/pp/v1`;
  }

  async listAllGovernmentInsurancePlans(): Promise<ReadonlyArray<GovernmentInsurancePlanEntity>> {
    this.log.trace('Fetching all government insurance plans');

    const url = new URL(`${this.baseUrl}/esdc_governmentinsuranceplans`);
    url.searchParams.set('$select', 'esdc_governmentinsuranceplanid,esdc_nameenglish,esdc_namefrench,_esdc_provinceterritorystateid_value');
    url.searchParams.set('$filter', 'statecode eq 0');
    const response = await this.httpClient.instrumentedFetch('http.client.interop-api.government-insurance-plans.gets', url, {
      proxyUrl: this.serverConfig.HTTP_PROXY_URL,
      method: 'GET',
      headers: {
        'Ocp-Apim-Subscription-Key': this.serverConfig.INTEROP_API_SUBSCRIPTION_KEY,
      },
      retryOptions: {
        retries: this.serverConfig.INTEROP_API_MAX_RETRIES,
        backoffMs: this.serverConfig.INTEROP_API_BACKOFF_MS,
        retryConditions: {
          [HttpStatusCodes.BAD_GATEWAY]: [],
        },
      },
    });

    if (!response.ok) {
      this.log.error('%j', {
        message: 'Failed to fetch government insurance plans',
        status: response.status,
        statusText: response.statusText,
        url,
        responseBody: await response.text(),
      });
      throw new Error(`Failed to fetch government insurance plans. Status: ${response.status}, Status Text: ${response.statusText}`);
    }

    const governmentInsurancePlanResponseEntity = (await response.json()) as GovernmentInsurancePlanResponseEntity;
    const governmentInsurancePlanEntities = governmentInsurancePlanResponseEntity.value;

    this.log.trace('Government insurance plans: [%j]', governmentInsurancePlanEntities);
    return governmentInsurancePlanEntities;
  }

  async findGovernmentInsurancePlanById(id: string): Promise<Option<GovernmentInsurancePlanEntity>> {
    this.log.debug('Fetching government insurance plan with id: [%s]', id);

    const governmentInsurancePlanEntities = await this.listAllGovernmentInsurancePlans();
    const governmentInsurancePlanEntity = governmentInsurancePlanEntities.find((plan) => plan.esdc_governmentinsuranceplanid === id);

    if (!governmentInsurancePlanEntity) {
      this.log.warn('Government insurance plan not found; id: [%s]', id);
      return None;
    }

    this.log.trace('Returning government insurance plan: [%j]', governmentInsurancePlanEntity);
    return Some(governmentInsurancePlanEntity);
  }

  getMetadata(): Record<string, string> {
    return {
      baseUrl: this.baseUrl,
    };
  }

  async checkHealth(): Promise<void> {
    await this.listAllGovernmentInsurancePlans();
  }
}

@injectable()
export class MockGovernmentInsurancePlanRepository implements GovernmentInsurancePlanRepository {
  private readonly log: Logger;

  constructor() {
    this.log = createLogger('MockGovernmentInsurancePlanRepository');
  }

  async listAllGovernmentInsurancePlans(): Promise<GovernmentInsurancePlanEntity[]> {
    this.log.debug('Fetching all government insurance plans');
    const governmentInsurancePlanEntities = governmentInsurancePlanJsonDataSource.value;

    if (governmentInsurancePlanEntities.length === 0) {
      this.log.warn('No government insurance plans found');
      return [];
    }

    this.log.trace('Returning government insurance plans: [%j]', governmentInsurancePlanEntities);
    return await Promise.resolve(governmentInsurancePlanEntities);
  }

  async findGovernmentInsurancePlanById(id: string): Promise<Option<GovernmentInsurancePlanEntity>> {
    this.log.debug('Fetching government insurance plan with id: [%s]', id);

    const governmentInsurancePlanEntities = governmentInsurancePlanJsonDataSource.value;
    const governmentInsurancePlanEntity = governmentInsurancePlanEntities.find(({ esdc_governmentinsuranceplanid }) => esdc_governmentinsuranceplanid === id);

    if (!governmentInsurancePlanEntity) {
      this.log.info('Government insurance plan not found; id: [%s]', id);
      return None;
    }

    return await Promise.resolve(Some(governmentInsurancePlanEntity));
  }

  getMetadata(): Record<string, string> {
    return {
      mockEnabled: 'true',
    };
  }

  async checkHealth(): Promise<void> {
    return await Promise.resolve();
  }
}
