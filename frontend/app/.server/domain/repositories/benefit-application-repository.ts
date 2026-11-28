import { invariant } from '@dts-stn/invariant';
import { Redacted } from 'effect';
import { inject, injectable } from 'inversify';

import type { ServerConfig } from '~/.server/configs';
import { TYPES } from '~/.server/constants';
import type { BenefitApplicationResponseEntity, BenefitApplicationSubmissionEntity } from '~/.server/domain/entities';
import type { HttpClient } from '~/.server/http';
import type { Logger } from '~/.server/logging';
import { createLogger } from '~/.server/logging';
import { Traced } from '~/.server/observability/decorator';
import { throwAppError } from '~/.server/utils/error-utils';
import { buildEndpointUrl } from '~/.server/utils/url-utils';
import { HttpStatusCodes } from '~/constants/http-status-codes';
import { isAppError } from '~/errors/app-error';
import { ErrorCodes } from '~/errors/error-codes';
import { isValidId } from '~/utils/id-utils';

export interface BenefitApplicationRepository {
  /**
   * Submits a benefit application request.
   *
   * @param benefitApplicationSubmissionEntity The application request and its flow ID.
   * @returns A Promise that resolves to the benefit application response entity.
   */
  createBenefitApplication(benefitApplicationSubmissionEntity: BenefitApplicationSubmissionEntity): Promise<BenefitApplicationResponseEntity>;
}

@injectable()
export class DefaultBenefitApplicationRepository implements BenefitApplicationRepository {
  private readonly log: Logger;
  private readonly serverConfig: Pick<
    ServerConfig,
    | 'HTTP_PROXY_URL'
    | 'INTEROP_API_BASE_URI'
    | 'INTEROP_BENEFIT_APPLICATION_PATHNAME'
    | 'INTEROP_API_SUBSCRIPTION_KEY'
    | 'INTEROP_BENEFIT_APPLICATION_BASE_URI'
    | 'INTEROP_BENEFIT_APPLICATION_SUBSCRIPTION_KEY'
    | 'INTEROP_API_MAX_RETRIES'
    | 'INTEROP_API_BACKOFF_MS'
  >;
  private readonly httpClient: HttpClient;
  private readonly subscriptionKey: Redacted.Redacted<string>;
  private readonly benefitApplicationUrl: string;

  constructor(
    @inject(TYPES.ServerConfig)
    serverConfig: Pick<
      ServerConfig,
      | 'HTTP_PROXY_URL'
      | 'INTEROP_API_BASE_URI'
      | 'INTEROP_BENEFIT_APPLICATION_PATHNAME'
      | 'INTEROP_API_SUBSCRIPTION_KEY'
      | 'INTEROP_BENEFIT_APPLICATION_BASE_URI'
      | 'INTEROP_BENEFIT_APPLICATION_SUBSCRIPTION_KEY'
      | 'INTEROP_API_MAX_RETRIES'
      | 'INTEROP_API_BACKOFF_MS'
    >,
    @inject(TYPES.HttpClient) httpClient: HttpClient,
  ) {
    this.log = createLogger('DefaultBenefitApplicationRepository');
    this.serverConfig = serverConfig;
    this.httpClient = httpClient;
    this.subscriptionKey = this.serverConfig.INTEROP_BENEFIT_APPLICATION_SUBSCRIPTION_KEY ?? this.serverConfig.INTEROP_API_SUBSCRIPTION_KEY;
    this.benefitApplicationUrl = buildEndpointUrl(this.serverConfig.INTEROP_BENEFIT_APPLICATION_BASE_URI ?? this.serverConfig.INTEROP_API_BASE_URI, this.serverConfig.INTEROP_BENEFIT_APPLICATION_PATHNAME);
  }

  @Traced()
  async createBenefitApplication(benefitApplicationSubmissionEntity: BenefitApplicationSubmissionEntity): Promise<BenefitApplicationResponseEntity> {
    const { applicationId, ...benefitApplicationRequestEntity } = benefitApplicationSubmissionEntity;
    invariant(isValidId(applicationId), 'A valid application ID is required for the idempotency key');
    this.log.trace('Submitting benefit application');

    const url = this.benefitApplicationUrl;

    try {
      const response = await this.httpClient.instrumentedFetch('http.client.interop-api.benefit-application.posts', url, {
        proxyUrl: this.serverConfig.HTTP_PROXY_URL,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': applicationId,
          'Ocp-Apim-Subscription-Key': Redacted.value(this.subscriptionKey),
        },
        body: JSON.stringify(benefitApplicationRequestEntity),
        retryOptions: {
          retries: this.serverConfig.INTEROP_API_MAX_RETRIES,
          backoffMs: this.serverConfig.INTEROP_API_BACKOFF_MS,
          retryConditions: {
            [HttpStatusCodes.BAD_REQUEST]: [/A record with the same value for Application Confirmation Number already exists/],
          },
          // A 502 or lost response does not prove the application was not created; replaying it creates duplicates.
          retryOnTransportError: false,
        },
      });

      if (!response.ok) {
        await response.text();

        if (response.status === HttpStatusCodes.TOO_MANY_REQUESTS) {
          // TODO ::: GjB ::: this throw is to facilitate enabling the application kill switch -- it should be removed once the killswitch functionality is removed
          throwAppError('Failed to POST to /benefit-application. Status: 429, Status Text: Too Many Requests', ErrorCodes.API_BENEFIT_APPLICATION_CREATE_RATE_LIMITED);
        }

        throwAppError('Application submission failed.', ErrorCodes.API_BENEFIT_APPLICATION_CREATE_FAILED);
      }

      const benefitApplicationResponseEntity = (await response.json()) as BenefitApplicationResponseEntity;
      this.log.trace('Benefit application response received');
      return benefitApplicationResponseEntity;
    } catch (cause) {
      if (isAppError(cause) && cause.errorCode !== ErrorCodes.API_HTTP_REQUEST_FAILED) {
        throw cause;
      }

      throwAppError('Application submission failed.', ErrorCodes.API_BENEFIT_APPLICATION_CREATE_FAILED, { cause });
    }
  }
}

@injectable()
export class MockBenefitApplicationRepository implements BenefitApplicationRepository {
  private readonly log: Logger;

  constructor() {
    this.log = createLogger('MockBenefitApplicationRepository');
  }

  async createBenefitApplication(_benefitApplicationSubmissionEntity: BenefitApplicationSubmissionEntity): Promise<BenefitApplicationResponseEntity> {
    this.log.debug('Creating mock benefit application');

    const benefitApplicationResponseEntity: BenefitApplicationResponseEntity = {
      BenefitApplication: {
        BenefitApplicationIdentification: [
          {
            IdentificationID: '2476124092174',
            IdentificationCategoryText: 'Confirmation Number',
          },
        ],
      },
    };

    this.log.debug('Mock benefit application response generated');
    return await Promise.resolve(benefitApplicationResponseEntity);
  }
}
