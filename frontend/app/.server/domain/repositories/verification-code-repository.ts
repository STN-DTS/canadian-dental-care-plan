import { inject, injectable } from 'inversify';
import { randomUUID } from 'node:crypto';

import type { ServerConfig } from '~/.server/configs';
import { TYPES } from '~/.server/constants';
import type { VerificationCodeEmailRequestEntity, VerificationCodeEmailResponseEntity } from '~/.server/domain/entities';
import type { HttpClient } from '~/.server/http';
import type { Logger } from '~/.server/logging';
import { createLogger } from '~/.server/logging';
import { HttpStatusCodes } from '~/constants/http-status-codes';
import { AppError } from '~/errors/app-error';
import { ErrorCodes } from '~/errors/error-codes';

export interface VerificationCodeRepository {
  /**
   * Sends a verification code email to the specified recipient.
   *
   * @param verificationCodeEmailRequestEntity The request entity containing verification code email request details.
   * @returns A promise resolving to an `VerificationCodeEmailResponseEntity` containing the result of the operation.
   */
  sendVerificationCodeEmail(verificationCodeEmailRequestEntity: VerificationCodeEmailRequestEntity): Promise<VerificationCodeEmailResponseEntity>;

  /**
   * Retrieves metadata associated with the verification code repository.
   *
   * @returns A record where the keys and values are strings representing metadata information.
   */
  getMetadata(): Record<string, string>;

  /**
   * Performs a health check to ensure that the verification code repository is operational.
   *
   * @throws An error if the health check fails or the repository is unavailable.
   * @returns A promise that resolves when the health check completes successfully.
   */
  checkHealth(): Promise<void>;
}

@injectable()
export class DefaultVerificationCodeRepository implements VerificationCodeRepository {
  private readonly log: Logger;
  private readonly serverConfig: Pick<ServerConfig, 'GC_NOTIFY_API_KEY' | 'HTTP_PROXY_URL' | 'INTEROP_API_BASE_URI' | 'INTEROP_API_SUBSCRIPTION_KEY'>;
  private readonly httpClient: HttpClient;
  private readonly baseUrl: string;

  constructor(@inject(TYPES.ServerConfig) serverConfig: Pick<ServerConfig, 'GC_NOTIFY_API_KEY' | 'HTTP_PROXY_URL' | 'INTEROP_API_BASE_URI' | 'INTEROP_API_SUBSCRIPTION_KEY'>, @inject(TYPES.HttpClient) httpClient: HttpClient) {
    this.log = createLogger('DefaultVerificationCodeRepository');
    this.serverConfig = serverConfig;
    this.httpClient = httpClient;
    this.baseUrl = `${this.serverConfig.INTEROP_API_BASE_URI}/notifications/email-txt-notifications/v1`;
  }

  async sendVerificationCodeEmail(verificationCodeEmailRequestEntity: VerificationCodeEmailRequestEntity): Promise<VerificationCodeEmailResponseEntity> {
    this.log.trace('Sending verification code email for request: [%j]', verificationCodeEmailRequestEntity);

    const url = `${this.baseUrl}/notifications/email`;
    const response = await this.httpClient.instrumentedFetch('http.client.interop-api.email-notifications.posts', url, {
      proxyUrl: this.serverConfig.HTTP_PROXY_URL,
      method: 'POST',
      headers: {
        Authorization: `ApiKey-v1 ${this.serverConfig.GC_NOTIFY_API_KEY}`,
        'Content-Type': 'application/json',
        'Ocp-Apim-Subscription-Key': this.serverConfig.INTEROP_API_SUBSCRIPTION_KEY,
      },
      body: JSON.stringify(verificationCodeEmailRequestEntity),
    });

    if (!response.ok) {
      this.log.error('%j', {
        message: `Failed to 'POST' email notification`,
        status: response.status,
        statusText: response.statusText,
        url,
        responseBody: await response.text(),
      });

      if (response.status === HttpStatusCodes.TOO_MANY_REQUESTS) {
        // TODO ::: GjB ::: this throw is to facilitate enabling the application kill switch -- it should be removed once the killswitch functionality is removed
        throw new AppError('Failed to POST to /notifications/email. Status: 429, Status Text: Too Many Requests', ErrorCodes.XAPI_TOO_MANY_REQUESTS);
      }

      throw new Error(`Failed to 'POST' email notification. Status: ${response.status}, Status Text: ${response.statusText}`);
    }

    const verificationCodeEmailResponseEntity = (await response.json()) as VerificationCodeEmailResponseEntity;
    this.log.trace('Returning verification code email response [%j]', verificationCodeEmailResponseEntity);
    return verificationCodeEmailResponseEntity;
  }

  getMetadata(): Record<string, string> {
    return {
      baseUrl: this.baseUrl,
    };
  }

  async checkHealth(): Promise<void> {
    this.log.trace('Checking health for verification code repository');

    const url = `${this.baseUrl}/notifications`;
    const response = await this.httpClient.instrumentedFetch('http.client.interop-api.email-notifications.gets', url, {
      proxyUrl: this.serverConfig.HTTP_PROXY_URL,
      method: 'GET',
      headers: {
        Authorization: `ApiKey-v1 ${this.serverConfig.GC_NOTIFY_API_KEY}`,
        'Content-Type': 'application/json',
        'Ocp-Apim-Subscription-Key': this.serverConfig.INTEROP_API_SUBSCRIPTION_KEY,
      },
    });

    if (!response.ok) {
      this.log.error('%j', {
        message: `Failed to 'GET' email notifications`,
        status: response.status,
        statusText: response.statusText,
        url,
        responseBody: await response.text(),
      });

      if (response.status === HttpStatusCodes.TOO_MANY_REQUESTS) {
        // TODO ::: GjB ::: this throw is to facilitate enabling the application kill switch -- it should be removed once the killswitch functionality is removed
        throw new AppError('Failed to GET /notifications. Status: 429, Status Text: Too Many Requests', ErrorCodes.XAPI_TOO_MANY_REQUESTS);
      }

      throw new Error(`Failed to 'GET' email notifications. Status: ${response.status}, Status Text: ${response.statusText}`);
    }
  }
}

@injectable()
export class MockVerificationCodeRepository implements VerificationCodeRepository {
  private readonly log: Logger;

  constructor() {
    this.log = createLogger('MockVerificationCodeRepository');
  }

  async sendVerificationCodeEmail(verificationCodeEmailRequestEntity: VerificationCodeEmailRequestEntity): Promise<VerificationCodeEmailResponseEntity> {
    this.log.trace('Sending verification code email for request: [%j]', verificationCodeEmailRequestEntity);

    const id = randomUUID();
    const verificationCodeEmailResponseEntity: VerificationCodeEmailResponseEntity = {
      id,
      content: {
        subject: 'Email address verification',
        body: `Your verification code is: ${verificationCodeEmailRequestEntity.personalisation.EmailVerificationCode}`,
        from_email: 'test@example.com',
      },
      uri: `https://api.example.com/v1/notifications/${id}`,
      template: {
        id: verificationCodeEmailRequestEntity.template_id,
        version: 1,
        uri: `https://api.example.com/v1/templates/${verificationCodeEmailRequestEntity.template_id}`,
      },
    };

    this.log.trace('Returning verification code email response [%j]', verificationCodeEmailResponseEntity);
    return await Promise.resolve(verificationCodeEmailResponseEntity);
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
