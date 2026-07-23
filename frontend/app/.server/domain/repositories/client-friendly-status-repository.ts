import { inject, injectable } from 'inversify';
import type { Option } from 'oxide.ts';
import { None, Some } from 'oxide.ts';

import type { ServerConfig } from '~/.server/configs';
import { TYPES } from '~/.server/constants';
import type { ClientFriendlyStatusEntity, ClientFriendlyStatusResponseEntity } from '~/.server/domain/entities';
import type { HttpClient } from '~/.server/http';
import { createLogger } from '~/.server/logging';
import type { Logger } from '~/.server/logging';
import clientFriendlyStatusJsonDataSource from '~/.server/resources/power-platform/client-friendly-status.json';
import { HttpStatusCodes } from '~/constants/http-status-codes';

export interface ClientFriendlyStatusRepository {
  /**
   * Fetch all client-friendly status entities.
   * @returns All client-friendly status entities.
   */
  listAllClientFriendlyStatuses(): Promise<ReadonlyArray<ClientFriendlyStatusEntity>>;

  /**
   * Fetch a client-friendly status entity by its id.
   * @param id The id of the client-friendly status entity.
   * @returns The client-friendly status entity or null if not found.
   */
  findClientFriendlyStatusById(id: string): Promise<Option<ClientFriendlyStatusEntity>>;

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

export type DefaultClientFriendlyStatusRepositoryServerConfig = Pick<ServerConfig, 'HTTP_PROXY_URL' | 'INTEROP_API_BASE_URI' | 'INTEROP_API_SUBSCRIPTION_KEY' | 'INTEROP_API_MAX_RETRIES' | 'INTEROP_API_BACKOFF_MS'>;

@injectable()
export class DefaultClientFriendlyStatusRepository implements ClientFriendlyStatusRepository {
  private readonly log: Logger;
  private readonly serverConfig: DefaultClientFriendlyStatusRepositoryServerConfig;
  private readonly httpClient: HttpClient;
  private readonly baseUrl: string;

  constructor(@inject(TYPES.ServerConfig) serverConfig: DefaultClientFriendlyStatusRepositoryServerConfig, @inject(TYPES.HttpClient) httpClient: HttpClient) {
    this.log = createLogger('DefaultClientFriendlyStatusRepository');
    this.serverConfig = serverConfig;
    this.httpClient = httpClient;
    this.baseUrl = `${this.serverConfig.INTEROP_API_BASE_URI}/dental-care/code-list/pp/v1`;
  }

  async listAllClientFriendlyStatuses(): Promise<ReadonlyArray<ClientFriendlyStatusEntity>> {
    this.log.trace('Fetching all client friendly statuses');

    const url = new URL(`${this.baseUrl}/esdc_clientfriendlystatuses`);
    url.searchParams.set('$select', 'esdc_clientfriendlystatusid,esdc_descriptionenglish,esdc_descriptionfrench');
    url.searchParams.set('$filter', 'statecode eq 0');
    const response = await this.httpClient.instrumentedFetch('http.client.interop-api.client-friendly-statuses.gets', url, {
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
        message: 'Failed to fetch client friendly statuses',
        status: response.status,
        statusText: response.statusText,
        url,
        responseBody: await response.text(),
      });
      throw new Error(`Failed to fetch client friendly statuses. Status: ${response.status}, Status Text: ${response.statusText}`);
    }

    const clientFriendlyStatusResponseEntity = (await response.json()) as ClientFriendlyStatusResponseEntity;
    const clientFriendlyStatusEntities = clientFriendlyStatusResponseEntity.value;

    this.log.trace('Client friendly statuses: [%j]', clientFriendlyStatusEntities);
    return clientFriendlyStatusEntities;
  }

  async findClientFriendlyStatusById(id: string): Promise<Option<ClientFriendlyStatusEntity>> {
    this.log.debug('Fetching client friendly status with id: [%s]', id);

    const clientFriendlyStatusEntities = await this.listAllClientFriendlyStatuses();
    const clientFriendlyStatusEntity = clientFriendlyStatusEntities.find((status) => status.esdc_clientfriendlystatusid === id);

    if (!clientFriendlyStatusEntity) {
      this.log.warn('Client friendly status not found; id: [%s]', id);
      return None;
    }

    this.log.trace('Returning client friendly status: [%j]', clientFriendlyStatusEntity);
    return Some(clientFriendlyStatusEntity);
  }

  getMetadata(): Record<string, string> {
    return {
      baseUrl: this.baseUrl,
    };
  }

  async checkHealth(): Promise<void> {
    await this.listAllClientFriendlyStatuses();
  }
}

@injectable()
export class MockClientFriendlyStatusRepository implements ClientFriendlyStatusRepository {
  private readonly log: Logger;

  constructor() {
    this.log = createLogger('MockClientFriendlyStatusRepository');
  }

  async listAllClientFriendlyStatuses(): Promise<ReadonlyArray<ClientFriendlyStatusEntity>> {
    this.log.debug('Fetching all client friendly statuses');
    const clientFriendlyStatusEntities = clientFriendlyStatusJsonDataSource.value;

    if (clientFriendlyStatusEntities.length === 0) {
      this.log.warn('No client friendly statuses found');
      return [];
    }

    this.log.trace('Returning client friendly statuses: [%j]', clientFriendlyStatusEntities);
    return await Promise.resolve(clientFriendlyStatusEntities);
  }

  async findClientFriendlyStatusById(id: string): Promise<Option<ClientFriendlyStatusEntity>> {
    this.log.debug('Fetching client friendly status with id: [%s]', id);

    const clientFriendlyStatusEntities = clientFriendlyStatusJsonDataSource.value;
    const clientFriendlyStatusEntity = clientFriendlyStatusEntities.find(({ esdc_clientfriendlystatusid }) => esdc_clientfriendlystatusid === id);

    if (!clientFriendlyStatusEntity) {
      this.log.warn('Client friendly status not found; id: [%s]', id);
      return None;
    }

    return await Promise.resolve(Some(clientFriendlyStatusEntity));
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
