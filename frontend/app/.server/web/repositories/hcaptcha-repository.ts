import { inject, injectable } from 'inversify';

import type { ServerConfig } from '~/.server/configs';
import { TYPES } from '~/.server/constants';
import type { HttpClient } from '~/.server/http';
import { createLogger } from '~/.server/logging';
import type { Logger } from '~/.server/logging';
import type { HCaptchaVerifyRequestEntity, HCaptchaVerifyResponseEntity } from '~/.server/web/entities';

export interface HCaptchaRepository {
  /**
   * Verifies a user's hCaptcha response.
   * @see https://docs.hcaptcha.com/#verify-the-user-response-server-side
   *
   * @param hCaptchaVerifyRequestEntity The hCaptcha verify request entity that includes the hCaptcha response token and optional IP address.
   * @returns A Promise that resolves to the hCaptcha verify response entity that includes the success status and score if successful.
   */
  verifyHCaptchaResponse(hCaptchaVerifyRequestEntity: HCaptchaVerifyRequestEntity): Promise<HCaptchaVerifyResponseEntity>;

  /**
   * Retrieves metadata associated with the hCaptcha repository.
   *
   * @returns A record where the keys and values are strings representing metadata information.
   */
  getMetadata(): Record<string, string>;

  /**
   * Performs a health check to ensure that the hCaptcha repository is operational.
   *
   * @throws An error if the health check fails or the repository is unavailable.
   * @returns A promise that resolves when the health check completes successfully.
   */
  checkHealth(): Promise<void>;
}

@injectable()
export class DefaultHCaptchaRepository implements HCaptchaRepository {
  private readonly log: Logger;
  private readonly serverConfig: Pick<ServerConfig, 'HCAPTCHA_SECRET_KEY' | 'HCAPTCHA_VERIFY_URL' | 'HEALTH_PLACEHOLDER_REQUEST_VALUE'>;
  private readonly httpClient: HttpClient;
  private readonly baseUrl: string;

  constructor(@inject(TYPES.ServerConfig) serverConfig: Pick<ServerConfig, 'HCAPTCHA_SECRET_KEY' | 'HCAPTCHA_VERIFY_URL' | 'HEALTH_PLACEHOLDER_REQUEST_VALUE'>, @inject(TYPES.HttpClient) httpClient: HttpClient) {
    this.log = createLogger('DefaultHCaptchaRepository');
    this.serverConfig = serverConfig;
    this.httpClient = httpClient;
    this.baseUrl = this.serverConfig.HCAPTCHA_VERIFY_URL;
  }

  async verifyHCaptchaResponse({ hCaptchaResponse, ipAddress }: HCaptchaVerifyRequestEntity): Promise<HCaptchaVerifyResponseEntity> {
    this.log.trace('Verifying hCaptchaResponse [%s] with ipAddress [%s]', hCaptchaResponse, ipAddress);

    const url = new URL(this.baseUrl);
    url.searchParams.set('response', hCaptchaResponse);
    url.searchParams.set('secret', this.serverConfig.HCAPTCHA_SECRET_KEY);
    if (ipAddress) {
      url.searchParams.set('remoteip', ipAddress);
    }

    const response = await this.httpClient.instrumentedFetch('http.client.hcaptcha.posts', url, { method: 'POST' });

    if (!response.ok) {
      this.log.error('%j', {
        message: 'Failed to verify hCaptcha',
        status: response.status,
        statusText: response.statusText,
        url,
        responseBody: await response.text(),
      });

      throw new Error(`Failed to verify hCaptcha: ${response.status}, Status Text: ${response.statusText}`);
    }

    const hCaptchaVerifyResponseEntity = (await response.json()) as HCaptchaVerifyResponseEntity;

    if (hCaptchaVerifyResponseEntity.success) {
      this.log.trace('hCaptcha verification successful with site verify response: [%j]', hCaptchaVerifyResponseEntity);
    } else {
      this.log.warn('hCaptcha verification unsuccessful with site verify response: [%j]', hCaptchaVerifyResponseEntity);
    }

    return hCaptchaVerifyResponseEntity;
  }

  getMetadata(): Record<string, string> {
    return {
      baseUrl: this.baseUrl,
    };
  }

  async checkHealth(): Promise<void> {
    await this.verifyHCaptchaResponse({ hCaptchaResponse: this.serverConfig.HEALTH_PLACEHOLDER_REQUEST_VALUE });
  }
}
