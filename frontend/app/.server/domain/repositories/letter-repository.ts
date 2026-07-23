import { inject, injectable } from 'inversify';

import type { ServerConfig } from '~/.server/configs';
import { TYPES } from '~/.server/constants';
import type { LetterEntity, PdfEntity } from '~/.server/domain/entities';
import type { HttpClient } from '~/.server/http';
import type { Logger } from '~/.server/logging';
import { createLogger } from '~/.server/logging';
import getPdfByLetterIdJson from '~/.server/resources/cct/get-pdf-by-letter-id.json';
import { HttpStatusCodes } from '~/constants/http-status-codes';
import { AppError } from '~/errors/app-error';
import { ErrorCodes } from '~/errors/error-codes';

/**
 * A repository that provides access to letters.
 */
export interface LetterRepository {
  /**
   * Find all letter entities for a given client id.
   *
   * @param clientId The client id to find all letter entities for.
   * @returns A Promise that resolves to all letter entities found for a client id.
   */
  findLettersByClientId(clientId: string): Promise<ReadonlyArray<LetterEntity>>;

  /**
   * Retrieve the PDF entity associated with a specific letter id.
   *
   * @param letterId The letter id of the PDF entity.
   * @returns A Promise that resolves to the PDF entity for a letter id.
   */
  getPdfByLetterId(letterId: string): Promise<PdfEntity>;

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

@injectable()
export class DefaultLetterRepository implements LetterRepository {
  private readonly log: Logger;
  private readonly serverConfig: Pick<
    ServerConfig,
    | 'HEALTH_PLACEHOLDER_REQUEST_VALUE'
    | 'HTTP_PROXY_URL'
    | 'INTEROP_API_BASE_URI'
    | 'INTEROP_API_SUBSCRIPTION_KEY'
    | 'INTEROP_CCT_API_BASE_URI'
    | 'INTEROP_CCT_API_SUBSCRIPTION_KEY'
    | 'INTEROP_CCT_API_COMMUNITY'
    | 'INTEROP_API_MAX_RETRIES'
    | 'INTEROP_API_BACKOFF_MS'
  >;
  private readonly httpClient: HttpClient;
  private readonly baseUrl: string;

  constructor(
    @inject(TYPES.ServerConfig)
    serverConfig: Pick<
      ServerConfig,
      | 'HEALTH_PLACEHOLDER_REQUEST_VALUE'
      | 'HTTP_PROXY_URL'
      | 'INTEROP_API_BASE_URI'
      | 'INTEROP_API_SUBSCRIPTION_KEY'
      | 'INTEROP_CCT_API_BASE_URI'
      | 'INTEROP_CCT_API_SUBSCRIPTION_KEY'
      | 'INTEROP_CCT_API_COMMUNITY'
      | 'INTEROP_API_MAX_RETRIES'
      | 'INTEROP_API_BACKOFF_MS'
    >,
    @inject(TYPES.HttpClient) httpClient: HttpClient,
  ) {
    this.log = createLogger('DefaultLetterRepository');
    this.serverConfig = serverConfig;
    this.httpClient = httpClient;
    this.baseUrl = `${this.serverConfig.INTEROP_CCT_API_BASE_URI ?? this.serverConfig.INTEROP_API_BASE_URI}/dental-care/client-letters/cct/v1`;
  }

  async findLettersByClientId(clientId: string): Promise<ReadonlyArray<LetterEntity>> {
    this.log.trace('Fetching letters for clientId [%s]', clientId);

    const url = new URL(`${this.baseUrl}/GetDocInfoByClientId`);
    url.searchParams.set('clientid', clientId);

    const response = await this.httpClient.instrumentedFetch('http.client.interop-api.get-doc-info-by-client-id.gets', url, {
      proxyUrl: this.serverConfig.HTTP_PROXY_URL,
      headers: {
        'Content-Type': 'application/json',
        'Ocp-Apim-Subscription-Key': this.serverConfig.INTEROP_CCT_API_SUBSCRIPTION_KEY ?? this.serverConfig.INTEROP_API_SUBSCRIPTION_KEY,
        'cct-community': this.serverConfig.INTEROP_CCT_API_COMMUNITY,
      },
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
        message: 'Failed to find letters',
        status: response.status,
        statusText: response.statusText,
        url: url,
        responseBody: await response.text(),
      });

      if (response.status === HttpStatusCodes.TOO_MANY_REQUESTS) {
        // TODO ::: GjB ::: this throw is to facilitate enabling the application kill switch -- it should be removed once the killswitch functionality is removed
        throw new AppError('Failed to GET /GetDocInfoByClientId. Status: 429, Status Text: Too Many Requests', ErrorCodes.XAPI_TOO_MANY_REQUESTS);
      }

      throw new Error(`Failed to find letters. Status: ${response.status}, Status Text: ${response.statusText}`);
    }

    const letterEntities = (await response.json()) as ReadonlyArray<LetterEntity>;
    this.log.trace('Returning letters [%j]', letterEntities);
    return letterEntities;
  }

  async getPdfByLetterId(letterId: string): Promise<PdfEntity> {
    this.log.trace('Fetching PDF for letterId [%s]', letterId);

    const url = new URL(`${this.baseUrl}/GetPdfByLetterId`);
    url.searchParams.set('id', letterId);

    const response = await this.httpClient.instrumentedFetch('http.client.interop-api.get-pdf-by-client-id.gets', url, {
      proxyUrl: this.serverConfig.HTTP_PROXY_URL,
      headers: {
        'Content-Type': 'application/json',
        'Ocp-Apim-Subscription-Key': this.serverConfig.INTEROP_CCT_API_SUBSCRIPTION_KEY ?? this.serverConfig.INTEROP_API_SUBSCRIPTION_KEY,
        'cct-community': this.serverConfig.INTEROP_CCT_API_COMMUNITY,
      },
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
        message: 'Failed to get PDF',
        status: response.status,
        statusText: response.statusText,
        url: url,
        responseBody: await response.text(),
      });

      if (response.status === HttpStatusCodes.TOO_MANY_REQUESTS) {
        // TODO ::: GjB ::: this throw is to facilitate enabling the application kill switch -- it should be removed once the killswitch functionality is removed
        throw new AppError('Failed to GET /GetPdfByLetterId. Status: 429, Status Text: Too Many Requests', ErrorCodes.XAPI_TOO_MANY_REQUESTS);
      }

      throw new Error(`Failed to get PDF. Status: ${response.status}, Status Text: ${response.statusText}`);
    }

    const pdfEntity = (await response.json()) as PdfEntity;
    this.log.trace('Returning PDF [%j]', pdfEntity);
    return pdfEntity;
  }

  getMetadata(): Record<string, string> {
    return {
      baseUrl: this.baseUrl,
    };
  }

  async checkHealth(): Promise<void> {
    await this.findLettersByClientId(this.serverConfig.HEALTH_PLACEHOLDER_REQUEST_VALUE);
  }
}

@injectable()
export class MockLetterRepository implements LetterRepository {
  private readonly log: Logger;

  constructor() {
    this.log = createLogger('MockLetterRepository');
  }

  async findLettersByClientId(clientId: string): Promise<ReadonlyArray<LetterEntity>> {
    this.log.debug('Fetching letters for clientId [%s]', clientId);

    const letterEntities: ReadonlyArray<LetterEntity> = [
      {
        LetterName: '775170001',
        LetterId: '038d9d0f-fb35-4d98-8f31-a4b2171e521a',
        LetterDate: '2024/04/05',
      },
    ];

    this.log.debug('Returning letters [%j]', letterEntities);
    return await Promise.resolve(letterEntities);
  }

  async getPdfByLetterId(letterId: string): Promise<PdfEntity> {
    this.log.debug('Fetching PDF for letterId [%s]', letterId);

    const pdfEntity: PdfEntity = getPdfByLetterIdJson;

    this.log.debug('Returning PDF [%j]', pdfEntity);
    return await Promise.resolve(pdfEntity);
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
