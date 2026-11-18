import { Redacted } from 'effect';
import { inject, injectable } from 'inversify';

import type { ServerConfig } from '~/.server/configs';
import { TYPES } from '~/.server/constants';
import type { ClientEligibilityEntity, ClientEligibilityRequestEntity } from '~/.server/domain/entities/client-eligibility-entity';
import type { HttpClient } from '~/.server/http';
import type { Logger } from '~/.server/logging';
import { createLogger } from '~/.server/logging';
import { Traced } from '~/.server/observability/decorator';
import clientEligibilityJsonDataSource from '~/.server/resources/power-platform/client-eligibility.json';
import { throwAppError } from '~/.server/utils/error-utils';
import { buildEndpointUrl } from '~/.server/utils/url-utils';
import { ErrorCodes } from '~/errors/error-codes';

export interface ClientEligibilityRepository {
  /**
   * Lists client eligibility information by client numbers.
   *
   * @param clientEligibilityRequestEntity - The request entity containing an array of client identification information.
   * @returns A Promise that resolves to a read-only array of client eligibility entities.
   * @throws {Error} When the API request fails or returns a non-OK response.
   */
  listClientEligibilitiesByClientNumbers(clientEligibilityRequestEntity: ClientEligibilityRequestEntity): Promise<ReadonlyArray<ClientEligibilityEntity>>;
}

@injectable()
export class DefaultClientEligibilityRepository implements ClientEligibilityRepository {
  private readonly log: Logger;
  private readonly serverConfig: Pick<
    ServerConfig,
    'INTEROP_API_BASE_URI' | 'INTEROP_CLIENT_ELIGIBILITY_BASE_URI' | 'INTEROP_CLIENT_ELIGIBILITY_APPLICANT_PATHNAME' | 'HTTP_PROXY_URL' | 'INTEROP_API_SUBSCRIPTION_KEY' | 'INTEROP_CLIENT_ELIGIBILITY_SUBSCRIPTION_KEY'
  >;
  private readonly httpClient: HttpClient;
  private readonly subscriptionKey: Redacted.Redacted<string>;
  private readonly applicantEligibilityUrl: string;

  constructor(
    @inject(TYPES.ServerConfig)
    serverConfig: Pick<ServerConfig, 'INTEROP_API_BASE_URI' | 'INTEROP_CLIENT_ELIGIBILITY_BASE_URI' | 'INTEROP_CLIENT_ELIGIBILITY_APPLICANT_PATHNAME' | 'HTTP_PROXY_URL' | 'INTEROP_API_SUBSCRIPTION_KEY' | 'INTEROP_CLIENT_ELIGIBILITY_SUBSCRIPTION_KEY'>,
    @inject(TYPES.HttpClient)
    httpClient: HttpClient,
  ) {
    this.log = createLogger('DefaultClientEligibilityRepository');
    this.serverConfig = serverConfig;
    this.httpClient = httpClient;
    this.subscriptionKey = this.serverConfig.INTEROP_CLIENT_ELIGIBILITY_SUBSCRIPTION_KEY ?? this.serverConfig.INTEROP_API_SUBSCRIPTION_KEY;
    this.applicantEligibilityUrl = buildEndpointUrl(this.serverConfig.INTEROP_CLIENT_ELIGIBILITY_BASE_URI ?? this.serverConfig.INTEROP_API_BASE_URI, this.serverConfig.INTEROP_CLIENT_ELIGIBILITY_APPLICANT_PATHNAME);
  }

  @Traced()
  async listClientEligibilitiesByClientNumbers(clientEligibilityRequestEntity: ClientEligibilityRequestEntity): Promise<ReadonlyArray<ClientEligibilityEntity>> {
    this.log.trace('Fetching client eligibility');

    const url = new URL(this.applicantEligibilityUrl);
    const response = await this.httpClient.instrumentedFetch('http.client.interop-api.applicant-eligibility_by-client-number.posts', url, {
      proxyUrl: this.serverConfig.HTTP_PROXY_URL,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Ocp-Apim-Subscription-Key': Redacted.value(this.subscriptionKey),
      },
      body: JSON.stringify(clientEligibilityRequestEntity),
    });

    if (response.ok) {
      const data = (await response.json()) as ReadonlyArray<ClientEligibilityEntity>;
      this.log.trace('Client eligibility received');
      return data;
    }

    await response.text();

    throwAppError('Client eligibility lookup failed.', ErrorCodes.API_CLIENT_ELIGIBILITY_LIST_FAILED);
  }
}

@injectable()
export class MockClientEligibilityRepository implements ClientEligibilityRepository {
  private readonly log: Logger;

  constructor() {
    this.log = createLogger('MockClientEligibilityRepository');
  }
  async listClientEligibilitiesByClientNumbers(clientEligibilityRequestEntity: ClientEligibilityRequestEntity): Promise<ReadonlyArray<ClientEligibilityEntity>> {
    this.log.debug('Fetching mock client eligibility');

    this.log.debug('Successfully mock client eligibility');
    return await Promise.resolve(clientEligibilityJsonDataSource as ReadonlyArray<ClientEligibilityEntity>);
  }
}
