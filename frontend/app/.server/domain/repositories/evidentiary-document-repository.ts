import { inject, injectable } from 'inversify';
import { URL } from 'node:url';

import type { ServerConfig } from '~/.server/configs';
import { TYPES } from '~/.server/constants';
import type { CreateEvidentiaryDocumentMetadataRepositoryRequest, CreateEvidentiaryDocumentMetadataResponseEntity, EvidentiaryDocumentEntity, EvidentiaryDocumentResponseEntity, FindEvidentiaryDocumentsRequest } from '~/.server/domain/entities';
import type { HttpClient } from '~/.server/http';
import { createLogger } from '~/.server/logging';
import type { Logger } from '~/.server/logging';
import { HttpStatusCodes } from '~/constants/http-status-codes';

/**
 * A repository that provides access to evidentiary document data.
 */
export interface EvidentiaryDocumentRepository {
  /**
   * Finds evidentiary documents based on the provided request object.
   *
   * @param findEvidentiaryDocumentsRequest The request object containing the client ID and userId for auditing.
   * @returns A promise that resolves to an array of evidentiary document entities.
   */
  findEvidentiaryDocuments(findEvidentiaryDocumentsRequest: FindEvidentiaryDocumentsRequest): Promise<ReadonlyArray<EvidentiaryDocumentEntity>>;

  /**
   * Uploads evidentiary document metadata.
   *
   * @param createRequest The request object containing the documents to upload.
   * @returns A promise that resolves to the upload response entity.
   */
  createEvidentiaryDocumentMetadata(createRequest: CreateEvidentiaryDocumentMetadataRepositoryRequest): Promise<CreateEvidentiaryDocumentMetadataResponseEntity>;

  /**
   * Retrieves metadata associated with the evidentiary documents repository.
   *
   * @returns A record where the keys and values are strings representing metadata information.
   */
  getMetadata(): Record<string, string>;

  /**
   * Performs a health check to ensure that the evidentiary documents repository is operational.
   *
   * @throws An error if the health check fails or the repository is unavailable.
   * @returns A promise that resolves when the health check completes successfully.
   */
  checkHealth(): Promise<void>;
}

type DefaultEvidentiaryDocumentRepositoryServerConfig = Pick<ServerConfig, 'HTTP_PROXY_URL' | 'INTEROP_API_BASE_URI' | 'INTEROP_API_SUBSCRIPTION_KEY' | 'INTEROP_API_MAX_RETRIES' | 'INTEROP_API_BACKOFF_MS'>;

@injectable()
export class DefaultEvidentiaryDocumentRepository implements EvidentiaryDocumentRepository {
  private readonly log: Logger;
  private readonly serverConfig: DefaultEvidentiaryDocumentRepositoryServerConfig;
  private readonly httpClient: HttpClient;
  private readonly baseUrl: string;

  constructor(
    @inject(TYPES.ServerConfig) serverConfig: DefaultEvidentiaryDocumentRepositoryServerConfig, //
    @inject(TYPES.HttpClient) httpClient: HttpClient,
  ) {
    this.log = createLogger('DefaultEvidentiaryDocumentRepository');
    this.serverConfig = serverConfig;
    this.httpClient = httpClient;
    this.baseUrl = `${this.serverConfig.INTEROP_API_BASE_URI}/dental-care/doc-metadata/pp/v1`;
  }

  async findEvidentiaryDocuments(findEvidentiaryDocumentsRequest: FindEvidentiaryDocumentsRequest): Promise<ReadonlyArray<EvidentiaryDocumentEntity>> {
    this.log.debug('Fetching evidentiary documents for client: [%s]', findEvidentiaryDocumentsRequest.clientId);
    this.log.trace('Fetching evidentiary documents for request [%j]', findEvidentiaryDocumentsRequest);

    const url = new URL(`${this.baseUrl}/esdc_evidentiarydocuments`);

    url.searchParams.set('$select', 'esdc_filename,_esdc_documenttypeid_value,esdc_uploaddate');
    url.searchParams.set('$expand', 'esdc_Clientid($select=esdc_firstname,esdc_lastname),esdc_DocumentTypeid($select=esdc_nameenglish,esdc_namefrench)');
    url.searchParams.set('$filter', `statuscode eq 1 and _esdc_clientid_value eq '${findEvidentiaryDocumentsRequest.clientId}'`);
    url.searchParams.set('$orderby', 'esdc_uploaddate desc,esdc_filename asc');

    const response = await this.httpClient.instrumentedFetch('http.client.interop-api.evidentiary-documents.gets', url, {
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
        message: 'Failed to fetch evidentiary documents',
        status: response.status,
        statusText: response.statusText,
        url: url.href,
        clientId: findEvidentiaryDocumentsRequest.clientId,
        responseBody: await response.text(),
      });
      throw new Error(`Failed to fetch evidentiary documents. Status: ${response.status}, Status Text: ${response.statusText}`);
    }

    const documentResponseEntity = (await response.json()) as EvidentiaryDocumentResponseEntity;
    const documentEntities = this.mapResponseToEntities(documentResponseEntity);

    this.log.trace('Returning evidentiary documents [%j]', documentEntities);
    return documentEntities;
  }

  async createEvidentiaryDocumentMetadata(createRequest: CreateEvidentiaryDocumentMetadataRepositoryRequest): Promise<CreateEvidentiaryDocumentMetadataResponseEntity> {
    this.log.debug('Uploading evidentiary document metadata for client: [%s]', createRequest.clientId);
    this.log.trace('Uploading evidentiary document metadata for request [%j]', createRequest);

    const url = new URL(`${this.baseUrl}/esdc_clients(${createRequest.clientId})/Microsoft.Dynamics.CRM.esdc_UploadEvidentiaryDocuments`);

    const requestBody = {
      Documents: createRequest.documents.map((doc) => ({
        '@odata.type': '#Microsoft.Dynamics.CRM.esdc_evidentiarydocument',
        'esdc_DocumentTypeid@odata.bind': `esdc_documenttypes(${doc.documentTypeId})`,
        'esdc_DocumentUploadReasonid@odata.bind': `esdc_documentuploadreasons(${doc.documentUploadReasonId})`,
        esdc_recordsource: doc.recordSource,
        esdc_filename: doc.fileName,
        esdc_uploaddate: doc.uploadDate,
        ...(doc.healthCanadaTransferDate && { esdc_hctransferdate: doc.healthCanadaTransferDate }),
      })),
    };

    const response = await this.httpClient.instrumentedFetch('http.client.interop-api.evidentiary-documents.upload', url, {
      proxyUrl: this.serverConfig.HTTP_PROXY_URL,
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': this.serverConfig.INTEROP_API_SUBSCRIPTION_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
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
        message: 'Failed to upload evidentiary document metadata',
        status: response.status,
        statusText: response.statusText,
        url: url.href,
        clientId: createRequest.clientId,
        responseBody: await response.text(),
      });
      throw new Error(`Failed to upload evidentiary document metadata. Status: ${response.status}, Status Text: ${response.statusText}`);
    }

    const uploadResponse = (await response.json()) as CreateEvidentiaryDocumentMetadataResponseEntity;
    this.log.trace('Upload evidentiary document metadata response [%j]', uploadResponse);
    return uploadResponse;
  }

  private mapResponseToEntities(response: EvidentiaryDocumentResponseEntity): ReadonlyArray<EvidentiaryDocumentEntity> {
    return response.value.map((doc) => ({
      id: doc.esdc_evidentiarydocumentid,
      fileName: doc.esdc_filename,
      clientId: doc.esdc_Clientid.esdc_clientid,
      documentTypeId: doc._esdc_documenttypeid_value,
      mscaUploadDate: doc.esdc_uploaddate,
      client: {
        id: doc.esdc_Clientid.esdc_clientid,
        firstName: doc.esdc_Clientid.esdc_firstname,
        lastName: doc.esdc_Clientid.esdc_lastname,
      },
      documentType: {
        id: doc.esdc_DocumentTypeid.esdc_evidentiarydocumenttypeid,
        nameEnglish: doc.esdc_DocumentTypeid.esdc_nameenglish,
        nameFrench: doc.esdc_DocumentTypeid.esdc_namefrench,
      },
    }));
  }

  getMetadata(): Record<string, string> {
    return {
      baseUrl: this.baseUrl,
    };
  }

  async checkHealth(): Promise<void> {
    await this.findEvidentiaryDocuments({
      clientId: '00000000-0000-0000-0000-000000000000',
      userId: 'health-check',
    });
  }
}

@injectable()
export class MockEvidentiaryDocumentRepository implements EvidentiaryDocumentRepository {
  private readonly log: Logger;

  constructor() {
    this.log = createLogger('MockEvidentiaryDocumentRepository');
  }

  async findEvidentiaryDocuments(findEvidentiaryDocumentsRequest: FindEvidentiaryDocumentsRequest): Promise<ReadonlyArray<EvidentiaryDocumentEntity>> {
    this.log.debug('Fetch evidentiary documents for client: [%s]', findEvidentiaryDocumentsRequest.clientId);
    this.log.trace('Fetch evidentiary documents for request [%j]', findEvidentiaryDocumentsRequest);

    const mockEvidentiaryDocumentEntities: ReadonlyArray<EvidentiaryDocumentEntity> = [
      {
        id: 'aff431b7-9bae-f011-bbd3-7c1e520630db',
        fileName: 'Benefit Provider Letter.pdf',
        clientId: findEvidentiaryDocumentsRequest.clientId,
        documentTypeId: '70a54c5a-9f9f-f011-bbd2-7ced8d05477c',
        mscaUploadDate: '2025-10-21T16:33:31Z',
        client: {
          id: findEvidentiaryDocumentsRequest.clientId,
          firstName: 'Liam',
          lastName: 'Anderson',
        },
        documentType: {
          id: '70a54c5a-9f9f-f011-bbd2-7ced8d05477c',
          nameEnglish: 'Benefit Provider Letter',
          nameFrench: 'Benefit Provider Letter [FR]',
        },
      },
      {
        id: '01968123-96ae-f011-bbd3-7c1e52408057',
        fileName: 'Employer Letter.pdf',
        clientId: findEvidentiaryDocumentsRequest.clientId,
        documentTypeId: 'de3c6d3c-9f9f-f011-bbd2-7ced8d05477c',
        mscaUploadDate: '2025-10-21T15:53:11Z',
        client: {
          id: findEvidentiaryDocumentsRequest.clientId,
          firstName: 'Liam',
          lastName: 'Anderson',
        },
        documentType: {
          id: 'de3c6d3c-9f9f-f011-bbd2-7ced8d05477c',
          nameEnglish: 'Employer Letter',
          nameFrench: 'Employer Letter [FR]',
        },
      },
    ];

    this.log.trace('Returning evidentiary documents [%j]', mockEvidentiaryDocumentEntities);
    return await Promise.resolve(mockEvidentiaryDocumentEntities);
  }

  async createEvidentiaryDocumentMetadata(createRequest: CreateEvidentiaryDocumentMetadataRepositoryRequest): Promise<CreateEvidentiaryDocumentMetadataResponseEntity> {
    this.log.debug('Upload evidentiary document metadata for client: [%s]', createRequest.clientId);
    this.log.trace('Upload evidentiary document metadata for request [%j]', createRequest);

    const mockResponse: CreateEvidentiaryDocumentMetadataResponseEntity = {
      esdc_evidentiarydocuments: createRequest.documents.map((doc) => ({
        esdc_filename: doc.fileName,
        _esdc_documenttypeid_value: doc.documentTypeId,
        _esdc_documentuploadreasonid_value: '89823b11-bfaa-f011-bbd3-7c1e520630db',
        esdc_uploaddate: doc.uploadDate,
        ...(doc.healthCanadaTransferDate && { esdc_hctransferdate: doc.healthCanadaTransferDate }),
        _esdc_clientid_value: createRequest.clientId,
        esdc_recordsource: doc.recordSource,
      })),
    };

    this.log.trace('Returning upload evidentiary document metadata response [%j]', mockResponse);
    return await Promise.resolve(mockResponse);
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
