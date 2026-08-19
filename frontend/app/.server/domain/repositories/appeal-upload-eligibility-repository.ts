import { inject, injectable } from 'inversify';
import { None, Option, Some } from 'oxide.ts';

import type { ServerConfig } from '~/.server/configs';
import { TYPES } from '~/.server/constants';
import type { AppealUploadEligibilityResponseEntity } from '~/.server/domain/entities';
import type { HttpClient } from '~/.server/http';
import { createLogger } from '~/.server/logging';
import type { Logger } from '~/.server/logging';
import appealUploadEligibilityJsonDataSource from '~/.server/resources/power-platform/appeal-upload-eligibility.json';
import { HttpStatusCodes } from '~/constants/http-status-codes';

/**
 * A repository that determines whether a client is eligible to upload appeal documents.
 */
export interface AppealUploadEligibilityRepository {
  /**
   * Fetches the appeal upload eligibility record for a client by its client number.
   *
   * @param clientNumber The client number to look up.
   * @returns The eligibility response entity, or `None` if no matching client was found.
   */
  findAppealUploadEligibilityByClientNumber(clientNumber: string): Promise<Option<AppealUploadEligibilityResponseEntity>>;

  /**
   * Retrieves metadata associated with the appeal upload eligibility repository.
   *
   * @returns A record where the keys and values are strings representing metadata information.
   */
  getMetadata(): Record<string, string>;

  /**
   * Performs a health check to ensure that the appeal upload eligibility repository is operational.
   *
   * @throws An error if the health check fails or the repository is unavailable.
   * @returns A promise that resolves when the health check completes successfully.
   */
}

type DefaultAppealUploadEligibilityRepositoryServerConfig = Pick<ServerConfig, 'HTTP_PROXY_URL' | 'INTEROP_API_BASE_URI' | 'INTEROP_API_SUBSCRIPTION_KEY' | 'INTEROP_API_MAX_RETRIES' | 'INTEROP_API_BACKOFF_MS'>;

@injectable()
export class DefaultAppealUploadEligibilityRepository implements AppealUploadEligibilityRepository {
  private readonly log: Logger;
  private readonly serverConfig: DefaultAppealUploadEligibilityRepositoryServerConfig;
  private readonly httpClient: HttpClient;
  private readonly baseUrl: string;

  constructor(
    @inject(TYPES.ServerConfig) serverConfig: DefaultAppealUploadEligibilityRepositoryServerConfig, //
    @inject(TYPES.HttpClient) httpClient: HttpClient,
  ) {
    this.log = createLogger('DefaultAppealUploadEligibilityRepository');
    this.serverConfig = serverConfig;
    this.httpClient = httpClient;
    this.baseUrl = `${this.serverConfig.INTEROP_API_BASE_URI}/dental-care/appeal-upload-eligible/pp/v1`;
  }

  async findAppealUploadEligibilityByClientNumber(clientNumber: string): Promise<Option<AppealUploadEligibilityResponseEntity>> {
    this.log.debug('Fetching appeal upload eligibility for client number: [%s]', clientNumber);

    const url = new URL(`${this.baseUrl}/esdc_clients(esdc_clientnumber='${encodeURIComponent(clientNumber)}')`);
    url.searchParams.set('$select', 'esdc_clientid,esdc_clientnumber,esdc_applicanttype,esdc_socialinsurancenumber,statecode,statuscode,esdc_suspendedon');
    // The expanded esdc_esdc_dentalapplicant_Clientid_esdc_client collection represents the client's
    // applications that are paused due to a T4 mismatch. A non-empty collection means the client is
    // eligible to upload evidentiary documentation.
    //
    // TODO: confirm the server-side $filter that restricts this collection to T4-mismatch-paused
    // applications. The real payload shows _esdc_pendingstatusid_value as `null | number`, so the
    // previously assumed `_esdc_pendingstatusid_value eq '<guid>'` filter was incorrect and has been
    // removed. Confirm with the API team whether the filtering is applied by the endpoint itself or
    // must be supplied here.
    url.searchParams.set('$expand', 'esdc_esdc_dentalapplicant_Clientid_esdc_client($select=esdc_dentalapplicantid,_esdc_dentalapplicationid_value,_esdc_pendingstatusid_value)');

    const response = await this.httpClient.instrumentedFetch('http.client.interop-api.appeal-upload-eligible.get', url, {
      proxyUrl: this.serverConfig.HTTP_PROXY_URL,
      method: 'GET',
      headers: {
        'Ocp-Apim-Subscription-Key': this.serverConfig.INTEROP_API_SUBSCRIPTION_KEY,
      },
      retryOptions: {
        retries: this.serverConfig.INTEROP_API_MAX_RETRIES,
        backoffMs: this.serverConfig.INTEROP_API_BACKOFF_MS,
        retryConditions: {
          [HttpStatusCodes.BAD_GATEWAY]: [],
        },
      },
    });

    // TODO: confirm how the service signals "client not found". This assumes a 404; the service
    // may instead return 200 with an empty body/collection, in which case this needs adjusting.
    if (response.status === HttpStatusCodes.NOT_FOUND) {
      this.log.debug('No client found for appeal upload eligibility; clientNumber: [%s]', clientNumber);
      return None;
    }

    if (!response.ok) {
      this.log.error('%j', {
        message: 'Failed to fetch appeal upload eligibility',
        status: response.status,
        statusText: response.statusText,
        url: url.href,
        responseBody: await response.text(),
      });
      throw new Error(`Failed to fetch appeal upload eligibility. Status: ${response.status}, Status Text: ${response.statusText}`);
    }

    const appealUploadEligibilityResponseEntity = (await response.json()) as AppealUploadEligibilityResponseEntity;

    this.log.trace('Appeal upload eligibility: [%j]', appealUploadEligibilityResponseEntity);
    return Some(appealUploadEligibilityResponseEntity);
  }

  getMetadata(): Record<string, string> {
    return {
      baseUrl: this.baseUrl,
    };
  }
}

@injectable()
export class MockAppealUploadEligibilityRepository implements AppealUploadEligibilityRepository {
  private readonly log: Logger;

  constructor() {
    this.log = createLogger('MockAppealUploadEligibilityRepository');
  }

  async findAppealUploadEligibilityByClientNumber(clientNumber: string): Promise<Option<AppealUploadEligibilityResponseEntity>> {
    this.log.debug('Fetching mock appeal upload eligibility for client number: [%s]', clientNumber);

    // The fixture is a real UAT payload (client 59373339201) populated with one T4-mismatch-paused
    // application so it represents an *eligible* client for local testing.
    // TODO: consider supporting multiple mock clients (eligible / not-eligible) once the upload
    // flow needs to exercise the ineligible path.
    const appealUploadEligibilityResponseEntity = appealUploadEligibilityJsonDataSource as AppealUploadEligibilityResponseEntity;

    if (appealUploadEligibilityResponseEntity.esdc_clientnumber !== clientNumber) {
      this.log.warn('No mock client found for appeal upload eligibility; clientNumber: [%s]', clientNumber);
      return await Promise.resolve(None);
    }

    return await Promise.resolve(Some(appealUploadEligibilityResponseEntity));
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
