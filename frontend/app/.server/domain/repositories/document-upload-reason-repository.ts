import { inject, injectable } from 'inversify';
import { None, Option, Some } from 'oxide.ts';

import type { ServerConfig } from '~/.server/configs';
import { TYPES } from '~/.server/constants';
import type { DocumentUploadReasonEntity, DocumentUploadReasonResponseEntity } from '~/.server/domain/entities';
import type { HttpClient } from '~/.server/http';
import { createLogger } from '~/.server/logging';
import type { Logger } from '~/.server/logging';
import documentUploadReasonJsonDataSource from '~/.server/resources/power-platform/document-upload-reason.json';
import { HttpStatusCodes } from '~/constants/http-status-codes';

export interface DocumentUploadReasonRepository {
  /**
   * Fetch all document upload reason entities.
   * @returns All document upload reason entities.
   */
  listAllDocumentUploadReasons(): Promise<ReadonlyArray<DocumentUploadReasonEntity>>;

  /**
   * Fetch a document upload reason entity by its id.
   * @param id The id of the document upload reason entity.
   * @returns The document upload reason entity or null if not found.
   */
  findDocumentUploadReasonById(id: string): Promise<Option<DocumentUploadReasonEntity>>;

  /**
   * Retrieves metadata associated with the document upload reason repository.
   *
   * @returns A record where the keys and values are strings representing metadata information.
   */
  getMetadata(): Record<string, string>;

  /**
   * Performs a health check to ensure that the document upload reason repository is operational.
   *
   * @throws An error if the health check fails or the repository is unavailable.
   * @returns A promise that resolves when the health check completes successfully.
   */
  checkHealth(): Promise<void>;
}

type DefaultDocumentUploadReasonRepositoryServerConfig = Pick<ServerConfig, 'HTTP_PROXY_URL' | 'INTEROP_API_BASE_URI' | 'INTEROP_API_SUBSCRIPTION_KEY' | 'INTEROP_API_MAX_RETRIES' | 'INTEROP_API_BACKOFF_MS'>;

@injectable()
export class DefaultDocumentUploadReasonRepository implements DocumentUploadReasonRepository {
  private readonly log: Logger;
  private readonly serverConfig: DefaultDocumentUploadReasonRepositoryServerConfig;
  private readonly httpClient: HttpClient;
  private readonly baseUrl: string;

  constructor(
    @inject(TYPES.ServerConfig) serverConfig: DefaultDocumentUploadReasonRepositoryServerConfig, //
    @inject(TYPES.HttpClient) httpClient: HttpClient,
  ) {
    this.log = createLogger('DefaultDocumentUploadReasonRepository');
    this.serverConfig = serverConfig;
    this.httpClient = httpClient;
    this.baseUrl = `${this.serverConfig.INTEROP_API_BASE_URI}/dental-care/code-list/pp/v1`;
  }

  async listAllDocumentUploadReasons(): Promise<ReadonlyArray<DocumentUploadReasonEntity>> {
    this.log.trace('Fetching all document upload reasons');

    const url = new URL(`${this.baseUrl}/esdc_documentuploadreasons`);
    url.searchParams.set('$select', 'esdc_documentuploadreasonid,esdc_nameenglish,esdc_namefrench');
    url.searchParams.set('$filter', 'statecode eq 0');
    const response = await this.httpClient.instrumentedFetch('http.client.interop-api.document-upload-reasons.gets', url, {
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

    if (!response.ok) {
      this.log.error('%j', {
        message: 'Failed to fetch document upload reasons',
        status: response.status,
        statusText: response.statusText,
        url,
        responseBody: await response.text(),
      });
      throw new Error(`Failed to fetch document upload reasons. Status: ${response.status}, Status Text: ${response.statusText}`);
    }

    const documentResponseEntity = (await response.json()) as DocumentUploadReasonResponseEntity;
    const documentUploadReasonEntities = documentResponseEntity.value;

    this.log.trace('DocumentUploadReasons: [%j]', documentUploadReasonEntities);
    return documentUploadReasonEntities;
  }

  async findDocumentUploadReasonById(id: string): Promise<Option<DocumentUploadReasonEntity>> {
    this.log.debug('Fetching document upload reason with id: [%s]', id);

    const documentUploadReasonEntities = await this.listAllDocumentUploadReasons();
    const documentEntity = documentUploadReasonEntities.find(({ esdc_documentuploadreasonid }) => esdc_documentuploadreasonid === id);

    if (!documentEntity) {
      this.log.warn('Document upload reason not found; id: [%s]', id);
      return None;
    }

    this.log.trace('Returning document upload reason: [%j]', documentEntity);
    return Some(documentEntity);
  }

  getMetadata(): Record<string, string> {
    return {
      baseUrl: this.baseUrl,
    };
  }

  async checkHealth(): Promise<void> {
    await this.listAllDocumentUploadReasons();
  }
}

@injectable()
export class MockDocumentUploadReasonRepository implements DocumentUploadReasonRepository {
  private readonly log: Logger;

  constructor() {
    this.log = createLogger('MockDocumentUploadReasonRepository');
  }

  async listAllDocumentUploadReasons(): Promise<ReadonlyArray<DocumentUploadReasonEntity>> {
    this.log.debug('Fetching all document upload reasons');
    const documentUploadReasonEntities = documentUploadReasonJsonDataSource.value;

    if (documentUploadReasonEntities.length === 0) {
      this.log.warn('No document upload reasons found');
      return [];
    }

    this.log.trace('Returning document upload reasons: [%j]', documentUploadReasonEntities);
    return await Promise.resolve(documentUploadReasonEntities);
  }

  async findDocumentUploadReasonById(id: string): Promise<Option<DocumentUploadReasonEntity>> {
    this.log.debug('Fetching document upload reason with id: [%s]', id);

    const documentUploadReasonEntities = documentUploadReasonJsonDataSource.value;
    const documentEntity = documentUploadReasonEntities.find(({ esdc_documentuploadreasonid }) => esdc_documentuploadreasonid === id);

    if (!documentEntity) {
      this.log.warn('Document upload reason not found; id: [%s]', id);
      return None;
    }

    return await Promise.resolve(Some(documentEntity));
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
