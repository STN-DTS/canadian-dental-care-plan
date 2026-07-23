import { inject, injectable } from 'inversify';

import type { ServerConfig } from '~/.server/configs';
import { TYPES } from '~/.server/constants';
import type { ApplicationStatusBasicInfoRequestEntity, ApplicationStatusEntity, ApplicationStatusSinRequestEntity } from '~/.server/domain/entities';
import type { HttpClient } from '~/.server/http';
import type { Logger } from '~/.server/logging';
import { createLogger } from '~/.server/logging';
import clientFriendlyStatusDataSource from '~/.server/resources/power-platform/client-friendly-status.json';
import { HttpStatusCodes } from '~/constants/http-status-codes';
import { AppError } from '~/errors/app-error';
import { ErrorCodes } from '~/errors/error-codes';
import { expectDefined } from '~/utils/assert-utils';

/**
 * A repository that provides access to application status data.
 */
export interface ApplicationStatusRepository {
  /**
   * Gets the application status of an applicant by basic info.
   *
   * @param applicationStatusBasicInfoRequestEntity The basic info request entity.
   * @returns A Promise that resolves to the application status entity.
   */
  getApplicationStatusByBasicInfo(applicationStatusBasicInfoRequestEntity: ApplicationStatusBasicInfoRequestEntity): Promise<ApplicationStatusEntity>;

  /**
   * Gets the application status of an applicant by SIN.
   *
   * @param applicationStatusSinRequestEntity The SIN request entity.
   * @returns A Promise that resolves to the application status entity.
   */
  getApplicationStatusBySin(applicationStatusSinRequestEntity: ApplicationStatusSinRequestEntity): Promise<ApplicationStatusEntity>;

  /**
   * Retrieves metadata associated with the application status repository.
   *
   * @returns A record where the keys and values are strings representing metadata information.
   */
  getMetadata(): Record<string, string>;

  /**
   * Performs a health check to ensure that the application status repository is operational.
   *
   * @throws An error if the health check fails or the repository is unavailable.
   * @returns A promise that resolves when the health check completes successfully.
   */
  checkHealth(): Promise<void>;
}

@injectable()
export class DefaultApplicationStatusRepository implements ApplicationStatusRepository {
  private readonly log: Logger;
  private readonly serverConfig: Pick<
    ServerConfig,
    'HEALTH_PLACEHOLDER_REQUEST_VALUE' | 'HTTP_PROXY_URL' | 'INTEROP_API_BASE_URI' | 'INTEROP_API_SUBSCRIPTION_KEY' | 'INTEROP_STATUS_CHECK_API_BASE_URI' | 'INTEROP_STATUS_CHECK_API_SUBSCRIPTION_KEY' | 'INTEROP_API_MAX_RETRIES' | 'INTEROP_API_BACKOFF_MS'
  >;
  private readonly httpClient: HttpClient;
  private readonly baseUrl: string;

  constructor(
    @inject(TYPES.ServerConfig)
    serverConfig: Pick<
      ServerConfig,
      'HEALTH_PLACEHOLDER_REQUEST_VALUE' | 'HTTP_PROXY_URL' | 'INTEROP_API_BASE_URI' | 'INTEROP_API_SUBSCRIPTION_KEY' | 'INTEROP_STATUS_CHECK_API_BASE_URI' | 'INTEROP_STATUS_CHECK_API_SUBSCRIPTION_KEY' | 'INTEROP_API_MAX_RETRIES' | 'INTEROP_API_BACKOFF_MS'
    >,
    @inject(TYPES.HttpClient) httpClient: HttpClient,
  ) {
    this.log = createLogger('DefaultApplicationStatusRepository');
    this.serverConfig = serverConfig;
    this.httpClient = httpClient;
    this.baseUrl = `${this.serverConfig.INTEROP_STATUS_CHECK_API_BASE_URI ?? this.serverConfig.INTEROP_API_BASE_URI}/dental-care/status-check/v1`;
  }

  async getApplicationStatusByBasicInfo(applicationStatusBasicInfoRequestEntity: ApplicationStatusBasicInfoRequestEntity): Promise<ApplicationStatusEntity> {
    this.log.trace('Fetching application status for basic info [%j]', applicationStatusBasicInfoRequestEntity);

    const url = `${this.baseUrl}/status_fnlndob`;
    const response = await this.httpClient.instrumentedFetch('http.client.interop-api.status-fnlndob.posts', url, {
      proxyUrl: this.serverConfig.HTTP_PROXY_URL,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Ocp-Apim-Subscription-Key': this.serverConfig.INTEROP_API_SUBSCRIPTION_KEY,
      },
      body: JSON.stringify(applicationStatusBasicInfoRequestEntity),
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
        message: `Failed to 'POST' for application status by basic info`,
        status: response.status,
        statusText: response.statusText,
        url: url,
        responseBody: await response.text(),
      });

      if (response.status === HttpStatusCodes.TOO_MANY_REQUESTS) {
        // TODO ::: GjB ::: this throw is to facilitate enabling the application kill switch -- it should be removed once the killswitch functionality is removed
        throw new AppError('Failed to POST to /status_fnlndob. Status: 429, Status Text: Too Many Requests', ErrorCodes.XAPI_TOO_MANY_REQUESTS);
      }

      throw new Error(`Failed to 'POST' for application status by basic info. Status: ${response.status}, Status Text: ${response.statusText}`);
    }

    const applicationStatusEntity = (await response.json()) as ApplicationStatusEntity;
    this.log.trace('Returning application status [%j]', applicationStatusEntity);
    return applicationStatusEntity;
  }

  async getApplicationStatusBySin(applicationStatusSinRequestEntity: ApplicationStatusSinRequestEntity): Promise<ApplicationStatusEntity> {
    this.log.trace('Fetching application status for sin [%j]', applicationStatusSinRequestEntity);

    const url = `${this.baseUrl}/status`;
    const response = await this.httpClient.instrumentedFetch('http.client.interop-api.status.posts', url, {
      proxyUrl: this.serverConfig.HTTP_PROXY_URL,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Ocp-Apim-Subscription-Key': this.serverConfig.INTEROP_API_SUBSCRIPTION_KEY,
      },
      body: JSON.stringify(applicationStatusSinRequestEntity),
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
        message: `Failed to 'POST' for application status by sin`,
        status: response.status,
        statusText: response.statusText,
        url: url,
        responseBody: await response.text(),
      });

      if (response.status === HttpStatusCodes.TOO_MANY_REQUESTS) {
        // TODO ::: GjB ::: this throw is to facilitate enabling the application kill switch -- it should be removed once the killswitch functionality is removed
        throw new AppError('Failed to POST to /status. Status: 429, Status Text: Too Many Requests', ErrorCodes.XAPI_TOO_MANY_REQUESTS);
      }

      throw new Error(`Failed to 'POST' for application status by sin. Status: ${response.status}, Status Text: ${response.statusText}`);
    }

    const applicationStatusEntity = (await response.json()) as ApplicationStatusEntity;
    this.log.trace('Returning application status [%j]', applicationStatusEntity);
    return applicationStatusEntity;
  }

  getMetadata(): Record<string, string> {
    return {
      baseUrl: this.baseUrl,
    };
  }

  async checkHealth(): Promise<void> {
    await this.getApplicationStatusBySin({
      BenefitApplication: {
        Applicant: {
          ClientIdentification: [
            {
              IdentificationID: this.serverConfig.HEALTH_PLACEHOLDER_REQUEST_VALUE,
            },
          ],
          PersonSINIdentification: {
            IdentificationID: this.serverConfig.HEALTH_PLACEHOLDER_REQUEST_VALUE,
          },
        },
      },
    });
  }
}

@injectable()
export class MockApplicationStatusRepository implements ApplicationStatusRepository {
  /**
   * Mock mapping for application codes to application status codes
   * which can then be used to render on the frontend
   *
   * Example mapping:
   *  {
   *    '000001': '873ac4c6-77c0-ee11-9079-000d3a09d132',
   *    '000002': 'f752c665-c4e6-ee11-a204-000d3a09d1b8',
   *    '000003': 'e882086c-c4e6-ee11-a204-000d3a09d1b8',
   *  }
   */
  private readonly MOCK_APPLICATION_CODES_TO_STATUS_CODES_MAP: Record<string, string> = Object.fromEntries(
    clientFriendlyStatusDataSource.value.map(({ esdc_clientfriendlystatusid }, i) => {
      return [(i + 1).toString().padStart(6, '0'), esdc_clientfriendlystatusid];
    }),
  );

  private readonly log: Logger;

  constructor() {
    this.log = createLogger('MockApplicationStatusRepository');
  }

  async getApplicationStatusByBasicInfo(applicationStatusBasicInfoRequestEntity: ApplicationStatusBasicInfoRequestEntity): Promise<ApplicationStatusEntity> {
    this.log.debug('Fetching application status for basic info [%j]', applicationStatusBasicInfoRequestEntity);

    const applicationCode = expectDefined(applicationStatusBasicInfoRequestEntity.BenefitApplication.Applicant.ClientIdentification[0]?.IdentificationID, 'Expected applicationCode to be defined');

    const statusCode = this.MOCK_APPLICATION_CODES_TO_STATUS_CODES_MAP[applicationCode];

    const applicationStatusEntity: ApplicationStatusEntity = {
      BenefitApplication: {
        BenefitApplicationStatus: [
          {
            ReferenceDataID: statusCode ?? 'c23252fe-604e-ee11-be6f-000d3a09d640',
            ReferenceDataName: 'Dental Status Code',
          },
        ],
      },
    };

    this.log.debug('Returning application status [%j]', applicationStatusEntity);
    return await Promise.resolve(applicationStatusEntity);
  }

  async getApplicationStatusBySin(applicationStatusSinRequestEntity: ApplicationStatusSinRequestEntity): Promise<ApplicationStatusEntity> {
    this.log.debug('Fetching application status for sin [%j]', applicationStatusSinRequestEntity);

    const applicationCode = expectDefined(applicationStatusSinRequestEntity.BenefitApplication.Applicant.ClientIdentification[0]?.IdentificationID, 'Expected applicationCode to be defined');

    const statusCode = this.MOCK_APPLICATION_CODES_TO_STATUS_CODES_MAP[applicationCode];

    const applicationStatusEntity: ApplicationStatusEntity = {
      BenefitApplication: {
        BenefitApplicationStatus: [
          {
            ReferenceDataID: statusCode ?? 'c23252fe-604e-ee11-be6f-000d3a09d640',
            ReferenceDataName: 'Dental Status Code',
          },
        ],
      },
    };

    this.log.debug('Returning application status [%j]', applicationStatusEntity);
    return await Promise.resolve(applicationStatusEntity);
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
