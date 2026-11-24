import { invariant } from '@dts-stn/invariant';
import { Redacted } from 'effect';
import { inject, injectable } from 'inversify';

import type { ServerConfig } from '~/.server/configs';
import { TYPES } from '~/.server/constants';
import type { BenefitRenewalResponseEntity, BenefitRenewalSubmissionEntity } from '~/.server/domain/entities';
import type { HttpClient } from '~/.server/http';
import type { Logger } from '~/.server/logging';
import { createLogger } from '~/.server/logging';
import { Traced } from '~/.server/observability/decorator';
import { throwAppError } from '~/.server/utils/error-utils';
import { buildEndpointUrl } from '~/.server/utils/url-utils';
import { HttpStatusCodes } from '~/constants/http-status-codes';
import { ErrorCodes } from '~/errors/error-codes';
import { isValidId } from '~/utils/id-utils';

export interface BenefitRenewalRepository {
  /**
   * Submits benefit renewal request.
   *
   * @param benefitRenewalSubmissionEntity The renewal request and its flow ID.
   * @returns A Promise that resolves to the renewal response if successful, or `null` otherwise.
   */
  createBenefitRenewal(benefitRenewalSubmissionEntity: BenefitRenewalSubmissionEntity): Promise<BenefitRenewalResponseEntity>;
}

@injectable()
export class DefaultBenefitRenewalRepository implements BenefitRenewalRepository {
  private readonly log: Logger;
  private readonly serverConfig: Pick<
    ServerConfig,
    'INTEROP_API_BASE_URI' | 'INTEROP_BENEFIT_RENEWAL_BASE_URI' | 'INTEROP_BENEFIT_RENEWAL_PATHNAME' | 'HTTP_PROXY_URL' | 'INTEROP_API_SUBSCRIPTION_KEY' | 'INTEROP_BENEFIT_RENEWAL_SUBSCRIPTION_KEY' | 'INTEROP_API_MAX_RETRIES' | 'INTEROP_API_BACKOFF_MS'
  >;
  private readonly httpClient: HttpClient;
  private readonly subscriptionKey: Redacted.Redacted<string>;
  private readonly benefitApplicationUrl: string;

  constructor(
    @inject(TYPES.ServerConfig) serverConfig: Pick<
      ServerConfig,
      'INTEROP_API_BASE_URI' | 'INTEROP_BENEFIT_RENEWAL_BASE_URI' | 'INTEROP_BENEFIT_RENEWAL_PATHNAME' | 'HTTP_PROXY_URL' | 'INTEROP_API_SUBSCRIPTION_KEY' | 'INTEROP_BENEFIT_RENEWAL_SUBSCRIPTION_KEY' | 'INTEROP_API_MAX_RETRIES' | 'INTEROP_API_BACKOFF_MS'
    >,
    @inject(TYPES.HttpClient) httpClient: HttpClient,
  ) {
    this.log = createLogger('DefaultBenefitRenewalRepository');
    this.serverConfig = serverConfig;
    this.httpClient = httpClient;
    this.subscriptionKey = this.serverConfig.INTEROP_BENEFIT_RENEWAL_SUBSCRIPTION_KEY ?? this.serverConfig.INTEROP_API_SUBSCRIPTION_KEY;
    this.benefitApplicationUrl = buildEndpointUrl(this.serverConfig.INTEROP_BENEFIT_RENEWAL_BASE_URI ?? this.serverConfig.INTEROP_API_BASE_URI, this.serverConfig.INTEROP_BENEFIT_RENEWAL_PATHNAME);
  }

  @Traced()
  async createBenefitRenewal(benefitRenewalSubmissionEntity: BenefitRenewalSubmissionEntity): Promise<BenefitRenewalResponseEntity> {
    const { applicationId, ...benefitRenewalRequest } = benefitRenewalSubmissionEntity;
    invariant(isValidId(applicationId), 'A valid application ID is required for the idempotency key');
    this.log.trace('Submitting benefit renewal');

    const url = new URL(this.benefitApplicationUrl);
    url.searchParams.set('scenario', 'RENEWAL');

    const response = await this.httpClient.instrumentedFetch('http.client.interop-api.benefit-application-renewal.posts', url, {
      proxyUrl: this.serverConfig.HTTP_PROXY_URL,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': applicationId,
        'Ocp-Apim-Subscription-Key': Redacted.value(this.subscriptionKey),
      },
      body: JSON.stringify(benefitRenewalRequest),
      retryOptions: {
        retries: this.serverConfig.INTEROP_API_MAX_RETRIES,
        backoffMs: this.serverConfig.INTEROP_API_BACKOFF_MS,
        retryConditions: {
          [HttpStatusCodes.BAD_REQUEST]: [/A record with the same value for Application Confirmation Number already exists/],
        },
        // A 502 or lost response does not prove the renewal was not created; replaying it creates duplicates.
        retryOnTransportError: false,
      },
    });

    if (!response.ok) {
      await response.text();

      if (response.status === HttpStatusCodes.TOO_MANY_REQUESTS) {
        // TODO ::: GjB ::: this throw is to facilitate enabling the application kill switch -- it should be removed once the killswitch functionality is removed
        throwAppError('Failed to POST to /benefit-application. Status: 429, Status Text: Too Many Requests', ErrorCodes.API_BENEFIT_RENEWAL_CREATE_RATE_LIMITED);
      }

      throwAppError('Renewal submission failed.', ErrorCodes.API_BENEFIT_RENEWAL_CREATE_FAILED);
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

  async createBenefitRenewal(_benefitRenewalSubmissionEntity: BenefitRenewalSubmissionEntity): Promise<BenefitRenewalResponseEntity> {
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
