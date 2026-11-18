import { Option, Redacted } from 'effect';
import { inject, injectable } from 'inversify';

import type { ServerConfig } from '~/.server/configs';
import { TYPES } from '~/.server/constants';
import type { ClientFriendlyStatusEntity, ClientFriendlyStatusResponseEntity } from '~/.server/domain/entities';
import type { HttpClient } from '~/.server/http';
import { createLogger } from '~/.server/logging';
import type { Logger } from '~/.server/logging';
import { ATTR_CDCP_REFERENCE_COUNT } from '~/.server/logging/log-attributes';
import { Traced } from '~/.server/observability/decorator';
import clientFriendlyStatusJsonDataSource from '~/.server/resources/power-platform/client-friendly-status.json';
import { throwAppError } from '~/.server/utils/error-utils';
import { buildEndpointUrl } from '~/.server/utils/url-utils';
import { HttpStatusCodes } from '~/constants/http-status-codes';
import { ErrorCodes } from '~/errors/error-codes';

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
  findClientFriendlyStatusById(id: string): Promise<Option.Option<ClientFriendlyStatusEntity>>;

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

export type DefaultClientFriendlyStatusRepositoryServerConfig = Pick<
  ServerConfig,
  | 'HTTP_PROXY_URL'
  | 'INTEROP_API_BASE_URI'
  | 'INTEROP_CLIENT_FRIENDLY_STATUS_BASE_URI'
  | 'INTEROP_CLIENT_FRIENDLY_STATUS_PATHNAME'
  | 'INTEROP_API_SUBSCRIPTION_KEY'
  | 'INTEROP_CLIENT_FRIENDLY_STATUS_SUBSCRIPTION_KEY'
  | 'INTEROP_API_MAX_RETRIES'
  | 'INTEROP_API_BACKOFF_MS'
>;

@injectable()
export class DefaultClientFriendlyStatusRepository implements ClientFriendlyStatusRepository {
  private readonly log: Logger;
  private readonly serverConfig: DefaultClientFriendlyStatusRepositoryServerConfig;
  private readonly httpClient: HttpClient;
  private readonly subscriptionKey: Redacted.Redacted<string>;
  private readonly clientFriendlyStatusesUrl: string;

  constructor(@inject(TYPES.ServerConfig) serverConfig: DefaultClientFriendlyStatusRepositoryServerConfig, @inject(TYPES.HttpClient) httpClient: HttpClient) {
    this.log = createLogger('DefaultClientFriendlyStatusRepository');
    this.serverConfig = serverConfig;
    this.httpClient = httpClient;
    this.subscriptionKey = this.serverConfig.INTEROP_CLIENT_FRIENDLY_STATUS_SUBSCRIPTION_KEY ?? this.serverConfig.INTEROP_API_SUBSCRIPTION_KEY;
    this.clientFriendlyStatusesUrl = buildEndpointUrl(this.serverConfig.INTEROP_CLIENT_FRIENDLY_STATUS_BASE_URI ?? this.serverConfig.INTEROP_API_BASE_URI, this.serverConfig.INTEROP_CLIENT_FRIENDLY_STATUS_PATHNAME);
  }

  @Traced()
  async listAllClientFriendlyStatuses(): Promise<ReadonlyArray<ClientFriendlyStatusEntity>> {
    this.log.trace('Fetching all client friendly statuses');

    const url = new URL(this.clientFriendlyStatusesUrl);
    url.searchParams.set('$select', 'esdc_clientfriendlystatusid,esdc_descriptionenglish,esdc_descriptionfrench');
    url.searchParams.set('$filter', 'statecode eq 0');
    const response = await this.httpClient.instrumentedFetch('http.client.interop-api.client-friendly-statuses.gets', url, {
      method: 'GET',
      headers: {
        'Ocp-Apim-Subscription-Key': Redacted.value(this.subscriptionKey),
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
      await response.text();
      throwAppError('Client-friendly status list failed.', ErrorCodes.API_REFDATA_CLIENT_FRIENDLY_STATUS_LIST_FAILED);
    }

    const clientFriendlyStatusResponseEntity = (await response.json()) as ClientFriendlyStatusResponseEntity;
    const clientFriendlyStatusEntities = clientFriendlyStatusResponseEntity.value;

    this.log.trace('Client friendly statuses', { [ATTR_CDCP_REFERENCE_COUNT]: clientFriendlyStatusEntities.length });
    return clientFriendlyStatusEntities;
  }

  async findClientFriendlyStatusById(id: string): Promise<Option.Option<ClientFriendlyStatusEntity>> {
    this.log.debug('Fetching client friendly status');

    const clientFriendlyStatusEntities = await this.listAllClientFriendlyStatuses();
    const clientFriendlyStatusEntity = clientFriendlyStatusEntities.find((status) => status.esdc_clientfriendlystatusid === id);

    if (!clientFriendlyStatusEntity) {
      this.log.debug('Client friendly status not found');
      return Option.none();
    }

    this.log.trace('Returning client friendly status');
    return Option.some(clientFriendlyStatusEntity);
  }

  getMetadata(): Record<string, string> {
    return {
      clientFriendlyStatusesUrl: this.clientFriendlyStatusesUrl,
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
      this.log.warn('No client friendly statuses found', { [ATTR_CDCP_REFERENCE_COUNT]: 0 });
      return [];
    }

    this.log.trace('Returning client friendly statuses', { [ATTR_CDCP_REFERENCE_COUNT]: clientFriendlyStatusEntities.length });
    return await Promise.resolve(clientFriendlyStatusEntities);
  }

  async findClientFriendlyStatusById(id: string): Promise<Option.Option<ClientFriendlyStatusEntity>> {
    this.log.debug('Fetching client friendly status');

    const clientFriendlyStatusEntities = clientFriendlyStatusJsonDataSource.value;
    const clientFriendlyStatusEntity = clientFriendlyStatusEntities.find(({ esdc_clientfriendlystatusid }) => esdc_clientfriendlystatusid === id);

    if (!clientFriendlyStatusEntity) {
      this.log.debug('Client friendly status not found');
      return Option.none();
    }

    return await Promise.resolve(Option.some(clientFriendlyStatusEntity));
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
