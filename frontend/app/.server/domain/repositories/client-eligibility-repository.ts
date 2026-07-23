import { inject, injectable } from 'inversify';

import type { ServerConfig } from '~/.server/configs';
import { TYPES } from '~/.server/constants';
import type { ClientEligibilityEntity, ClientEligibilityRequestEntity } from '~/.server/domain/entities/client-eligibility-entity';
import type { HttpClient } from '~/.server/http';
import type { Logger } from '~/.server/logging';
import { createLogger } from '~/.server/logging';
import clientEligibilityJsonDataSource from '~/.server/resources/power-platform/client-eligibility.json';

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
  private readonly serverConfig: Pick<ServerConfig, 'INTEROP_API_BASE_URI' | 'HTTP_PROXY_URL' | 'INTEROP_API_SUBSCRIPTION_KEY'>;
  private readonly httpClient: HttpClient;

  constructor(
    @inject(TYPES.ServerConfig)
    serverConfig: Pick<ServerConfig, 'INTEROP_API_BASE_URI' | 'HTTP_PROXY_URL' | 'INTEROP_API_SUBSCRIPTION_KEY'>,
    @inject(TYPES.HttpClient)
    httpClient: HttpClient,
  ) {
    this.log = createLogger('DefaultClientEligibilityRepository');
    this.serverConfig = serverConfig;
    this.httpClient = httpClient;
  }

  async listClientEligibilitiesByClientNumbers(clientEligibilityRequestEntity: ClientEligibilityRequestEntity): Promise<ReadonlyArray<ClientEligibilityEntity>> {
    this.log.trace('Fetching client eligibility for client numbers [%j]', clientEligibilityRequestEntity);

    const url = new URL(`${this.serverConfig.INTEROP_API_BASE_URI}/dental-care/applicant-information/dts/v1/applicant-eligibility`);
    const response = await this.httpClient.instrumentedFetch('http.client.interop-api.applicant-eligibility_by-client-number.posts', url, {
      proxyUrl: this.serverConfig.HTTP_PROXY_URL,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Ocp-Apim-Subscription-Key': this.serverConfig.INTEROP_API_SUBSCRIPTION_KEY,
      },
      body: JSON.stringify(clientEligibilityRequestEntity),
    });

    if (response.ok) {
      const data = (await response.json()) as ReadonlyArray<ClientEligibilityEntity>;
      this.log.trace('Client eligibility [%j]', data);
      return data;
    }

    this.log.error('%j', {
      message: "Failed to 'POST' for client eligibility by client numbers",
      status: response.status,
      statusText: response.statusText,
      url: url,
      responseBody: await response.text(),
    });

    throw new Error(`Failed to 'POST' for client eligibility by client numbers. Status: ${response.status}, Status Text: ${response.statusText}`);
  }
}

@injectable()
export class MockClientEligibilityRepository implements ClientEligibilityRepository {
  private readonly log: Logger;

  constructor() {
    this.log = createLogger('MockClientEligibilityRepository');
  }
  async listClientEligibilitiesByClientNumbers(clientEligibilityRequestEntity: ClientEligibilityRequestEntity): Promise<ReadonlyArray<ClientEligibilityEntity>> {
    this.log.debug('Fetching client eligibility for client numbers [%j]', clientEligibilityRequestEntity);

    this.log.debug('Successfully mock client eligibility');
    return await Promise.resolve(clientEligibilityJsonDataSource as ReadonlyArray<ClientEligibilityEntity>);
  }
}
