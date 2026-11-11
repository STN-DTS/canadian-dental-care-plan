import { Redacted } from 'effect';
import { inject, injectable } from 'inversify';

import type { ServerConfig } from '~/.server/configs';
import { TYPES } from '~/.server/constants';
import type { BenefitRenewalRequestEntity, BenefitRenewalResponseEntity } from '~/.server/domain/entities';
import type { HttpClient } from '~/.server/http';
import type { Logger } from '~/.server/logging';
import { createLogger } from '~/.server/logging';
import { Traced } from '~/.server/observability/decorator';
import { HttpStatusCodes } from '~/constants/http-status-codes';
import { AppError } from '~/errors/app-error';
import { ErrorCodes } from '~/errors/error-codes';

export interface BenefitRenewalRepository {
  /**
   * Submits benefit renewal request.
   *
   * @param benefitRenewalRequest The renewal request stored in session.
   * @returns A Promise that resolves to the renewal response if successful, or `null` otherwise.
   */
  createBenefitRenewal(benefitRenewalRequest: BenefitRenewalRequestEntity): Promise<BenefitRenewalResponseEntity>;
}

@injectable()
export class DefaultBenefitRenewalRepository implements BenefitRenewalRepository {
  private readonly log: Logger;
  private readonly serverConfig: Pick<ServerConfig, 'INTEROP_API_BASE_URI' | 'HTTP_PROXY_URL' | 'INTEROP_API_SUBSCRIPTION_KEY' | 'INTEROP_API_MAX_RETRIES' | 'INTEROP_API_BACKOFF_MS'>;
  private readonly httpClient: HttpClient;

  constructor(
    @inject(TYPES.ServerConfig) serverConfig: Pick<ServerConfig, 'INTEROP_API_BASE_URI' | 'HTTP_PROXY_URL' | 'INTEROP_API_SUBSCRIPTION_KEY' | 'INTEROP_API_MAX_RETRIES' | 'INTEROP_API_BACKOFF_MS'>,
    @inject(TYPES.HttpClient) httpClient: HttpClient,
  ) {
    this.log = createLogger('DefaultBenefitRenewalRepository');
    this.serverConfig = serverConfig;
    this.httpClient = httpClient;
  }

  @Traced()
  async createBenefitRenewal(benefitRenewalRequest: BenefitRenewalRequestEntity): Promise<BenefitRenewalResponseEntity> {
    this.log.trace('Submitting benefit renewal');

    const url = new URL(`${this.serverConfig.INTEROP_API_BASE_URI}/dental-care/applicant-information/dts/v1/benefit-application`);
    url.searchParams.set('scenario', 'RENEWAL');

    const response = await this.httpClient.instrumentedFetch('http.client.interop-api.benefit-application-renewal.posts', url, {
      proxyUrl: this.serverConfig.HTTP_PROXY_URL,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Ocp-Apim-Subscription-Key': Redacted.value(this.serverConfig.INTEROP_API_SUBSCRIPTION_KEY),
      },
      body: JSON.stringify(benefitRenewalRequest),
      retryOptions: {
        retries: this.serverConfig.INTEROP_API_MAX_RETRIES,
        backoffMs: this.serverConfig.INTEROP_API_BACKOFF_MS,
        retryConditions: {
          [HttpStatusCodes.BAD_REQUEST]: [/A record with the same value for Application Confirmation Number already exists/],
          [HttpStatusCodes.BAD_GATEWAY]: [],
        },
      },
    });

    if (!response.ok) {
      await response.text();

      if (response.status === HttpStatusCodes.TOO_MANY_REQUESTS) {
        // TODO ::: GjB ::: this throw is to facilitate enabling the application kill switch -- it should be removed once the killswitch functionality is removed
        throw new AppError('Failed to POST to /benefit-application. Status: 429, Status Text: Too Many Requests', ErrorCodes.XAPI_TOO_MANY_REQUESTS);
      }

      throw new Error(`Failed to 'POST' for benefit renewal data. Status: ${response.status}, Status Text: ${response.statusText}`);
    }

    const data = (await response.json()) as BenefitRenewalResponseEntity;
    this.log.trace('Benefit renewal response received');

    return data;
  }
}

@injectable()
export class MockBenefitRenewalRepository implements BenefitRenewalRepository {
  private readonly log: Logger;

  constructor() {
    this.log = createLogger('MockBenefitRenewalRepository');
  }

  @Traced()
  async createBenefitRenewal(benefitRenewalRequest: BenefitRenewalRequestEntity): Promise<BenefitRenewalResponseEntity> {
    this.log.debug('Creating mock benefit renewal');

    const benefitRenewalResponseEntity: BenefitRenewalResponseEntity = {
      BenefitApplication: {
        BenefitApplicationIdentification: [
          {
            IdentificationID: '2476124092174',
            IdentificationCategoryText: 'Confirmation Number',
          },
        ],
      },
    };

    this.log.debug('Mock benefit renewal response generated');

    return await Promise.resolve(benefitRenewalResponseEntity);
  }
}
