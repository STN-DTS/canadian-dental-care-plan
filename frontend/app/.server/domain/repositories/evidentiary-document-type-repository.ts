import { inject, injectable } from 'inversify';
import { None, Option, Some } from 'oxide.ts';

import type { ServerConfig } from '~/.server/configs';
import { TYPES } from '~/.server/constants';
import type { EvidentiaryDocumentTypeEntity, EvidentiaryDocumentTypeResponseEntity } from '~/.server/domain/entities';
import type { HttpClient } from '~/.server/http';
import { createLogger } from '~/.server/logging';
import type { Logger } from '~/.server/logging';
import evidentiaryDocumentTypeJsonDataSource from '~/.server/resources/power-platform/evidentiary-document-type.json';
import { HttpStatusCodes } from '~/constants/http-status-codes';

export interface EvidentiaryDocumentTypeRepository {
  /**
   * Fetch all evidentiary document type entities.
   * @returns All evidentiary document type entities.
   */
  listAllEvidentiaryDocumentTypes(): Promise<ReadonlyArray<EvidentiaryDocumentTypeEntity>>;

  /**
   * Fetch a evidentiary document type entity by its id.
   * @param id The id of the evidentiary document type entity.
   * @returns The evidentiary document type entity or null if not found.
   */
  findEvidentiaryDocumentTypeById(id: string): Promise<Option<EvidentiaryDocumentTypeEntity>>;

  /**
   * Retrieves metadata associated with the evidentiary document type repository.
   *
   * @returns A record where the keys and values are strings representing metadata information.
   */
  getMetadata(): Record<string, string>;

  /**
   * Performs a health check to ensure that the evidentiary document type repository is operational.
   *
   * @throws An error if the health check fails or the repository is unavailable.
   * @returns A promise that resolves when the health check completes successfully.
   */
  checkHealth(): Promise<void>;
}

type DefaultEvidentiaryDocumentTypeRepositoryServerConfig = Pick<ServerConfig, 'HTTP_PROXY_URL' | 'INTEROP_API_BASE_URI' | 'INTEROP_API_SUBSCRIPTION_KEY' | 'INTEROP_API_MAX_RETRIES' | 'INTEROP_API_BACKOFF_MS'>;

@injectable()
export class DefaultEvidentiaryDocumentTypeRepository implements EvidentiaryDocumentTypeRepository {
  private readonly log: Logger;
  private readonly serverConfig: DefaultEvidentiaryDocumentTypeRepositoryServerConfig;
  private readonly httpClient: HttpClient;
  private readonly baseUrl: string;

  constructor(
    @inject(TYPES.ServerConfig) serverConfig: DefaultEvidentiaryDocumentTypeRepositoryServerConfig, //
    @inject(TYPES.HttpClient) httpClient: HttpClient,
  ) {
    this.log = createLogger('DefaultEvidentiaryDocumentTypeRepository');
    this.serverConfig = serverConfig;
    this.httpClient = httpClient;
    this.baseUrl = `${this.serverConfig.INTEROP_API_BASE_URI}/dental-care/code-list/pp/v1`;
  }

  async listAllEvidentiaryDocumentTypes(): Promise<ReadonlyArray<EvidentiaryDocumentTypeEntity>> {
    this.log.trace('Fetching all evidentiary evidentiary document types');

    const url = new URL(`${this.baseUrl}/esdc_evidentiarydocumenttypes`);
    url.searchParams.set('$select', 'esdc_evidentiarydocumenttypeid,esdc_value,esdc_nameenglish,esdc_namefrench');
    url.searchParams.set('$filter', 'statecode eq 0');
    const response = await this.httpClient.instrumentedFetch('http.client.interop-api.evidentiary-document-types.gets', url, {
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
        message: 'Failed to fetch evidentiary evidentiary document types',
        status: response.status,
        statusText: response.statusText,
        url,
        responseBody: await response.text(),
      });
      throw new Error(`Failed to fetch evidentiary evidentiary document types. Status: ${response.status}, Status Text: ${response.statusText}`);
    }

    const documentResponseEntity = (await response.json()) as EvidentiaryDocumentTypeResponseEntity;
    const documentTypeEntities = documentResponseEntity.value;

    this.log.trace('EvidentiaryDocumentTypes: [%j]', documentTypeEntities);
    return documentTypeEntities;
  }

  async findEvidentiaryDocumentTypeById(id: string): Promise<Option<EvidentiaryDocumentTypeEntity>> {
    this.log.debug('Fetching evidentiary document type with id: [%s]', id);

    const documentTypeEntities = await this.listAllEvidentiaryDocumentTypes();
    const documentEntity = documentTypeEntities.find(({ esdc_evidentiarydocumenttypeid }) => esdc_evidentiarydocumenttypeid === id);

    if (!documentEntity) {
      this.log.warn('Document type not found; id: [%s]', id);
      return None;
    }

    this.log.trace('Returning document: [%j]', documentEntity);
    return Some(documentEntity);
  }

  getMetadata(): Record<string, string> {
    return {
      baseUrl: this.baseUrl,
    };
  }

  async checkHealth(): Promise<void> {
    await this.listAllEvidentiaryDocumentTypes();
  }
}

@injectable()
export class MockEvidentiaryDocumentTypeRepository implements EvidentiaryDocumentTypeRepository {
  private readonly log: Logger;

  constructor() {
    this.log = createLogger('MockEvidentiaryDocumentTypeRepository');
  }

  async listAllEvidentiaryDocumentTypes(): Promise<ReadonlyArray<EvidentiaryDocumentTypeEntity>> {
    this.log.debug('Fetching all evidentiary evidentiary document types');
    const documentTypeEntities = evidentiaryDocumentTypeJsonDataSource.value;

    if (documentTypeEntities.length === 0) {
      this.log.warn('No evidentiary evidentiary document types found');
      return [];
    }

    this.log.trace('Returning evidentiary evidentiary document types: [%j]', documentTypeEntities);
    return await Promise.resolve(documentTypeEntities);
  }

  async findEvidentiaryDocumentTypeById(id: string): Promise<Option<EvidentiaryDocumentTypeEntity>> {
    this.log.debug('Fetching evidentiary document type with id: [%s]', id);

    const documentTypeEntities = evidentiaryDocumentTypeJsonDataSource.value;
    const documentEntity = documentTypeEntities.find(({ esdc_evidentiarydocumenttypeid }) => esdc_evidentiarydocumenttypeid === id);

    if (!documentEntity) {
      this.log.warn('Document type not found; id: [%s]', id);
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
