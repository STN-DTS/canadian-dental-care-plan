import { inject, injectable } from 'inversify';

import type { ServerConfig } from '~/.server/configs';
import { TYPES } from '~/.server/constants';
import type { UpdateAddressRequestEntity, UpdateCommunicationPreferenceRequestEntity, UpdateDentalBenefitsRequestEntity, UpdateEmailAddressRequestEntity, UpdatePhoneNumbersRequestEntity } from '~/.server/domain/entities';
import type { HttpClient } from '~/.server/http';
import type { Logger } from '~/.server/logging';
import { createLogger } from '~/.server/logging';
import { HttpStatusCodes } from '~/constants/http-status-codes';

export interface ProfileRepository {
  /**
   * Updates communication preferences for a user.
   *
   * @param updateCommunicationPreferenceRequestEntity The communication preference request entity.
   * @returns A Promise that resolves when the update is complete.
   */
  updateCommunicationPreferences(updateCommunicationPreferenceRequestEntity: UpdateCommunicationPreferenceRequestEntity): Promise<void>;

  /**
   * Updates phone numbers for a user.
   *
   * @param updatePhoneNumbersRequestEntity The update phone number request entity.
   * @returns A Promise that resolves when the update is complete.
   */
  updatePhoneNumbers(updatePhoneNumbersRequestEntity: UpdatePhoneNumbersRequestEntity): Promise<void>;

  /**
   * Updates email address for a user.
   *
   * @param updateEmailAddressRequestEntity The email address request entity.
   * @returns A Promise that resolves when the update is complete.
   */
  updateEmailAddress(updateEmailAddressRequestEntity: UpdateEmailAddressRequestEntity): Promise<void>;

  /**
   * Updates dental benefits for a user.
   *
   * @param updateDentalBenefitsRequestEntity The update dental benefits request entity.
   * @returns A Promise that resolves when the update is complete.
   */
  updateDentalBenefits(updateDentalBenefitsRequestEntity: UpdateDentalBenefitsRequestEntity): Promise<void>;

  /**
   * Updates mailing and home addresses for a user.
   *
   * @param updateAddressRequestEntity The address request entity.
   * @returns A Promise that resolves when the update is complete.
   */
  updateAddresses(updateAddressRequestEntity: UpdateAddressRequestEntity): Promise<void>;

  /**
   * Retrieves metadata associated with the letter repository.
   *
   * @returns A record where the keys and values are strings representing metadata information.
   */
  getMetadata(): Record<string, string>;

  /**
   * Performs a health check to ensure that the letter repository is operational.
   *
   * @throws An error if the health check fails or the repository is unavailable.
   * @returns A promise that resolves when the health check completes successfully.
   */
  checkHealth(): Promise<void>;
}

type DefaultProfileRepositoryServerConfig = Pick<ServerConfig, 'HTTP_PROXY_URL' | 'INTEROP_API_BASE_URI' | 'INTEROP_API_MAX_RETRIES' | 'INTEROP_API_BACKOFF_MS' | 'INTEROP_API_SUBSCRIPTION_KEY'>;

@injectable()
export class DefaultProfileRepository implements ProfileRepository {
  private readonly log: Logger;
  private readonly serverConfig: DefaultProfileRepositoryServerConfig;
  private readonly httpClient: HttpClient;

  constructor(
    @inject(TYPES.ServerConfig)
    serverConfig: DefaultProfileRepositoryServerConfig,
    @inject(TYPES.HttpClient) httpClient: HttpClient,
  ) {
    this.log = createLogger('DefaultProfileRepository');
    this.serverConfig = serverConfig;
    this.httpClient = httpClient;
  }

  async updateCommunicationPreferences(updateCommunicationPreferenceRequestEntity: UpdateCommunicationPreferenceRequestEntity): Promise<void> {
    this.log.trace('Updating communication preferences for request [%j]', updateCommunicationPreferenceRequestEntity);

    const url = `${this.serverConfig.INTEROP_API_BASE_URI}/dental-care/applicant-information/dts/v1/update-benefit-application`;
    const response = await this.httpClient.instrumentedFetch('http.client.interop-api.update-benefit-application.communication-preferences.posts', url, {
      proxyUrl: this.serverConfig.HTTP_PROXY_URL,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Ocp-Apim-Subscription-Key': this.serverConfig.INTEROP_API_SUBSCRIPTION_KEY,
      },
      body: JSON.stringify(updateCommunicationPreferenceRequestEntity),
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
        message: `Failed to 'POST' for update benefit application communication preferences`,
        status: response.status,
        statusText: response.statusText,
        url: url,
        responseBody: await response.text(),
      });

      throw new Error(`Failed to 'POST' for update benefit application communication preferences. Status: ${response.status}, Status Text: ${response.statusText}`);
    }
  }

  async updatePhoneNumbers(updatePhoneNumbersRequestEntity: UpdatePhoneNumbersRequestEntity): Promise<void> {
    this.log.trace('Updating phone numbers for request [%j]', updatePhoneNumbersRequestEntity);

    const url = `${this.serverConfig.INTEROP_API_BASE_URI}/dental-care/applicant-information/dts/v1/update-benefit-application`;
    const response = await this.httpClient.instrumentedFetch('http.client.interop-api.update-benefit-application.phone-numbers.posts', url, {
      proxyUrl: this.serverConfig.HTTP_PROXY_URL,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Ocp-Apim-Subscription-Key': this.serverConfig.INTEROP_API_SUBSCRIPTION_KEY,
      },
      body: JSON.stringify(updatePhoneNumbersRequestEntity),
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
        message: `Failed to 'POST' for update benefit application phone numbers`,
        status: response.status,
        statusText: response.statusText,
        url: url,
        responseBody: await response.text(),
      });

      throw new Error(`Failed to 'POST' for update benefit application phone numbers. Status: ${response.status}, Status Text: ${response.statusText}`);
    }
  }

  async updateEmailAddress(updateEmailAddressRequestEntity: UpdateEmailAddressRequestEntity): Promise<void> {
    this.log.trace('Updating email address for request [%j]', updateEmailAddressRequestEntity);

    const url = `${this.serverConfig.INTEROP_API_BASE_URI}/dental-care/applicant-information/dts/v1/update-benefit-application`;
    const response = await this.httpClient.instrumentedFetch('http.client.interop-api.update-benefit-application.email-address.posts', url, {
      proxyUrl: this.serverConfig.HTTP_PROXY_URL,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Ocp-Apim-Subscription-Key': this.serverConfig.INTEROP_API_SUBSCRIPTION_KEY,
      },
      body: JSON.stringify(updateEmailAddressRequestEntity),
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
        message: `Failed to 'POST' for update benefit application email address`,
        status: response.status,
        statusText: response.statusText,
        url: url,
        responseBody: await response.text(),
      });

      throw new Error(`Failed to 'POST' for update benefit application email address. Status: ${response.status}, Status Text: ${response.statusText}`);
    }
  }

  async updateDentalBenefits(updateDentalBenefitsRequestEntity: UpdateDentalBenefitsRequestEntity): Promise<void> {
    this.log.trace('Updating dental benefits for request [%j]', updateDentalBenefitsRequestEntity);

    const url = `${this.serverConfig.INTEROP_API_BASE_URI}/dental-care/applicant-information/dts/v1/update-benefit-application`;
    const response = await this.httpClient.instrumentedFetch('http.client.interop-api.update-benefit-application.dental-benefits.posts', url, {
      proxyUrl: this.serverConfig.HTTP_PROXY_URL,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Ocp-Apim-Subscription-Key': this.serverConfig.INTEROP_API_SUBSCRIPTION_KEY,
      },
      body: JSON.stringify(updateDentalBenefitsRequestEntity),
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
        message: `Failed to 'POST' for update benefit application dental benefits`,
        status: response.status,
        statusText: response.statusText,
        url: url,
        responseBody: await response.text(),
      });

      throw new Error(`Failed to 'POST' for update benefit application dental benefits. Status: ${response.status}, Status Text: ${response.statusText}`);
    }
  }

  async updateAddresses(updateAddressRequestEntity: UpdateAddressRequestEntity): Promise<void> {
    this.log.trace('Updating mailing and home addresses for request [%j]', updateAddressRequestEntity);

    const url = `${this.serverConfig.INTEROP_API_BASE_URI}/dental-care/applicant-information/dts/v1/update-benefit-application`;
    const response = await this.httpClient.instrumentedFetch('http.client.interop-api.update-benefit-application.mailing-and-home-addresses.posts', url, {
      proxyUrl: this.serverConfig.HTTP_PROXY_URL,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Ocp-Apim-Subscription-Key': this.serverConfig.INTEROP_API_SUBSCRIPTION_KEY,
      },
      body: JSON.stringify(updateAddressRequestEntity),
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
        message: `Failed to 'POST' for update benefit application mailing and home addresses`,
        status: response.status,
        statusText: response.statusText,
        url: url,
        responseBody: await response.text(),
      });

      throw new Error(`Failed to 'POST' for update benefit application mailing and home addresses. Status: ${response.status}, Status Text: ${response.statusText}`);
    }
  }

  getMetadata(): Record<string, string> {
    throw new Error('Method not implemented.');
  }

  async checkHealth(): Promise<void> {
    await Promise.reject(new Error('Method not implemented.'));
  }
}

@injectable()
export class MockProfileRepository implements ProfileRepository {
  private readonly log: Logger;

  constructor() {
    this.log = createLogger('MockProfileRepository');
  }

  async updateCommunicationPreferences(updateCommunicationPreferenceRequestEntity: UpdateCommunicationPreferenceRequestEntity): Promise<void> {
    this.log.debug('Mock updating communication preferences for request [%j]', updateCommunicationPreferenceRequestEntity);

    this.log.debug('Successfully mock updated communication preferences');
    return await Promise.resolve();
  }

  async updatePhoneNumbers(updatePhoneNumbersRequestEntity: UpdatePhoneNumbersRequestEntity): Promise<void> {
    this.log.debug('Mock updating phone numbers for request [%j]', updatePhoneNumbersRequestEntity);

    this.log.debug('Successfully mock updated phone numbers');
    return await Promise.resolve();
  }

  async updateDentalBenefits(updateDentalBenefitsRequestEntity: UpdateDentalBenefitsRequestEntity): Promise<void> {
    this.log.debug('Mock updating dental benefits for request [%j]', updateDentalBenefitsRequestEntity);

    this.log.debug('Successfully mock updated dental benefits');
    return await Promise.resolve();
  }

  async updateEmailAddress(updateEmailAddressRequestEntity: UpdateEmailAddressRequestEntity): Promise<void> {
    this.log.debug('Mock updating email address for request [%j]', updateEmailAddressRequestEntity);

    this.log.debug('Successfully mock updated email address');
    return await Promise.resolve();
  }

  async updateAddresses(updateAddressRequestEntity: UpdateAddressRequestEntity): Promise<void> {
    this.log.debug('Mock updating mailing and home addresses for request [%j]', updateAddressRequestEntity);

    this.log.debug('Successfully mock updated mailing and home addresses');
    return await Promise.resolve();
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
