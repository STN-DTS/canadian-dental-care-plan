import { inject, injectable } from 'inversify';
import { None, Option, Some } from 'oxide.ts';

import type { ServerConfig } from '~/.server/configs';
import { TYPES } from '~/.server/constants';
import type { CountryEntity, CountryResponseEntity } from '~/.server/domain/entities';
import type { HttpClient } from '~/.server/http';
import { createLogger } from '~/.server/logging';
import type { Logger } from '~/.server/logging';
import countryJsonDataSource from '~/.server/resources/power-platform/country.json';
import { HttpStatusCodes } from '~/constants/http-status-codes';

export interface CountryRepository {
  /**
   * Fetch all country entities.
   * @returns All country entities.
   */
  listAllCountries(): Promise<ReadonlyArray<CountryEntity>>;

  /**
   * Fetch a country entity by its id.
   * @param id The id of the country entity.
   * @returns The country entity or null if not found.
   */
  findCountryById(id: string): Promise<Option<CountryEntity>>;

  /**
   * Retrieves metadata associated with the country repository.
   *
   * @returns A record where the keys and values are strings representing metadata information.
   */
  getMetadata(): Record<string, string>;

  /**
   * Performs a health check to ensure that the country repository is operational.
   *
   * @throws An error if the health check fails or the repository is unavailable.
   * @returns A promise that resolves when the health check completes successfully.
   */
  checkHealth(): Promise<void>;
}

export type DefaultCountryRepositoryServerConfig = Pick<ServerConfig, 'HTTP_PROXY_URL' | 'INTEROP_API_BASE_URI' | 'INTEROP_API_SUBSCRIPTION_KEY' | 'INTEROP_API_MAX_RETRIES' | 'INTEROP_API_BACKOFF_MS'>;

@injectable()
export class DefaultCountryRepository implements CountryRepository {
  private readonly log: Logger;
  private readonly serverConfig: DefaultCountryRepositoryServerConfig;
  private readonly httpClient: HttpClient;
  private readonly baseUrl: string;

  constructor(@inject(TYPES.ServerConfig) serverConfig: DefaultCountryRepositoryServerConfig, @inject(TYPES.HttpClient) httpClient: HttpClient) {
    this.log = createLogger('DefaultCountryRepository');
    this.serverConfig = serverConfig;
    this.httpClient = httpClient;
    this.baseUrl = `${this.serverConfig.INTEROP_API_BASE_URI}/dental-care/code-list/pp/v1`;
  }

  async listAllCountries(): Promise<ReadonlyArray<CountryEntity>> {
    this.log.trace('Fetching all countries');

    const url = new URL(`${this.baseUrl}/esdc_countries`);
    url.searchParams.set('$select', 'esdc_countryid,esdc_nameenglish,esdc_namefrench,esdc_countrycodealpha3');
    url.searchParams.set('$filter', 'statecode eq 0 and esdc_enabledentalapplicationportal eq true');
    const response = await this.httpClient.instrumentedFetch('http.client.interop-api.countries.gets', url, {
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
        message: 'Failed to fetch countries',
        status: response.status,
        statusText: response.statusText,
        url,
        responseBody: await response.text(),
      });
      throw new Error(`Failed to fetch countries. Status: ${response.status}, Status Text: ${response.statusText}`);
    }

    const countryResponseEntity = (await response.json()) as CountryResponseEntity;
    const countryEntities = countryResponseEntity.value;

    this.log.trace('Countries: [%j]', countryEntities);
    return countryEntities;
  }

  async findCountryById(id: string): Promise<Option<CountryEntity>> {
    this.log.debug('Fetching country with id: [%s]', id);

    const countryEntities = await this.listAllCountries();
    const countryEntity = countryEntities.find((status) => status.esdc_countryid === id);

    if (!countryEntity) {
      this.log.warn('Country not found; id: [%s]', id);
      return None;
    }

    this.log.trace('Returning country: [%j]', countryEntity);
    return Some(countryEntity);
  }

  getMetadata(): Record<string, string> {
    return {
      baseUrl: this.baseUrl,
    };
  }

  async checkHealth(): Promise<void> {
    await this.listAllCountries();
  }
}

@injectable()
export class MockCountryRepository implements CountryRepository {
  private readonly log: Logger;

  constructor() {
    this.log = createLogger('MockCountryRepository');
  }

  async listAllCountries(): Promise<ReadonlyArray<CountryEntity>> {
    this.log.debug('Fetching all countries');
    const countryEntities = countryJsonDataSource.value;

    if (countryEntities.length === 0) {
      this.log.warn('No countries found');
      return [];
    }

    this.log.trace('Returning countries: [%j]', countryEntities);
    return await Promise.resolve(countryEntities);
  }

  async findCountryById(id: string): Promise<Option<CountryEntity>> {
    this.log.debug('Fetching country with id: [%s]', id);

    const countryEntities = countryJsonDataSource.value;
    const countryEntity = countryEntities.find(({ esdc_countryid }) => esdc_countryid === id);

    if (!countryEntity) {
      this.log.warn('Country not found; id: [%s]', id);
      return None;
    }

    return await Promise.resolve(Some(countryEntity));
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
