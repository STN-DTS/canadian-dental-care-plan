import { inject, injectable } from 'inversify';

import type { ServerConfig } from '~/.server/configs';
import { TYPES } from '~/.server/constants';
import type { DocumentScanRequestEntity, DocumentScanResponseEntity, DocumentUploadRequestEntity, DocumentUploadResponseEntity } from '~/.server/domain/entities';
import type { HttpClient } from '~/.server/http';
import type { Logger } from '~/.server/logging';
import { createLogger } from '~/.server/logging';
import { HttpStatusCodes } from '~/constants/http-status-codes';

/**
 * A repository that provides document uploading and scanning functionality.
 */
export interface DocumentUploadRepository {
  /**
   * Upload a document to a predetermined drop location.
   * This will process the file through scan for threats and upload the file to an SFTP/FTPS drop location.
   *
   * @param documentUploadRequestEntity The document upload request entity
   * @returns A Promise that resolves to the document upload response entity.
   */
  uploadDocument(documentUploadRequestEntity: DocumentUploadRequestEntity): Promise<DocumentUploadResponseEntity>;

  /**
   * Scan a document for threats and return scan result synchronously.
   *
   * @param scanDocumentRequestEntity The document scan request entity
   * @returns A Promise that resolves to the document scan response entity.
   */
  scanDocument(scanDocumentRequestEntity: DocumentScanRequestEntity): Promise<DocumentScanResponseEntity>;

  /**
   * Retrieves metadata associated with the document upload repository.
   *
   * @returns A record where the keys and values are strings representing metadata information.
   */
  getMetadata(): Record<string, string>;

  /**
   * Performs a health check to ensure that the document upload repository is operational.
   *
   * @throws An error if the health check fails or the repository is unavailable.
   * @returns A promise that resolves when the health check completes successfully.
   */
  checkHealth(): Promise<void>;
}

@injectable()
export class DefaultDocumentUploadRepository implements DocumentUploadRepository {
  private readonly log: Logger;
  private readonly serverConfig: Pick<
    ServerConfig,
    'INTEROP_API_SUBSCRIPTION_KEY' | 'HTTP_PROXY_URL' | 'INTEROP_API_BASE_URI' | 'EWDU_ENCAPSULATION_USERNAME' | 'EWDU_ENCAPSULATION_PASSWORD' | 'EWDU_PROGRAM_ACTIVITY_ID' | 'INTEROP_API_MAX_RETRIES' | 'INTEROP_API_BACKOFF_MS'
  >;
  private readonly httpClient: HttpClient;
  private readonly baseUrl: string;

  constructor(
    @inject(TYPES.ServerConfig)
    serverConfig: Pick<
      ServerConfig,
      'HTTP_PROXY_URL' | 'INTEROP_API_SUBSCRIPTION_KEY' | 'INTEROP_API_BASE_URI' | 'EWDU_ENCAPSULATION_USERNAME' | 'EWDU_ENCAPSULATION_PASSWORD' | 'EWDU_PROGRAM_ACTIVITY_ID' | 'INTEROP_API_MAX_RETRIES' | 'INTEROP_API_BACKOFF_MS'
    >,
    @inject(TYPES.HttpClient) httpClient: HttpClient,
  ) {
    this.log = createLogger('DefaultDocumentUploadRepository');
    this.serverConfig = serverConfig;
    this.httpClient = httpClient;
    this.baseUrl = `${this.serverConfig.INTEROP_API_BASE_URI}/client-correspondence/document-upload/cct/v1/api`;
  }

  private addCredentialsToRequestBody<T extends object>(requestBody: T): T & { username: string; password?: string; programActivityIdentificationID: string } {
    return {
      ...requestBody,
      username: this.serverConfig.EWDU_ENCAPSULATION_USERNAME,
      password: this.serverConfig.EWDU_ENCAPSULATION_PASSWORD,
      programActivityIdentificationID: this.serverConfig.EWDU_PROGRAM_ACTIVITY_ID,
    };
  }

  async uploadDocument(documentUploadRequestEntity: DocumentUploadRequestEntity): Promise<DocumentUploadResponseEntity> {
    this.log.trace('Uploading document for filename [%s]', documentUploadRequestEntity.filename);

    const url = `${this.baseUrl}/ScanAndSave`;

    const response = await this.httpClient.instrumentedFetch('http.client.document-scan-api.scan-and-save.posts', url, {
      proxyUrl: this.serverConfig.HTTP_PROXY_URL,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Ocp-Apim-Subscription-Key': this.serverConfig.INTEROP_API_SUBSCRIPTION_KEY,
      },
      body: JSON.stringify(this.addCredentialsToRequestBody(documentUploadRequestEntity)),
      retryOptions: {
        retries: this.serverConfig.INTEROP_API_MAX_RETRIES,
        backoffMs: this.serverConfig.INTEROP_API_BACKOFF_MS,
        retryConditions: {
          [HttpStatusCodes.BAD_GATEWAY]: [],
          [HttpStatusCodes.SERVICE_UNAVAILABLE]: [],
          [HttpStatusCodes.GATEWAY_TIMEOUT]: [],
        },
      },
    });

    if (!response.ok) {
      this.log.error('%j', {
        message: `Failed to 'POST' for document upload (ScanAndSave)`,
        status: response.status,
        statusText: response.statusText,
        url: url,
        filename: documentUploadRequestEntity.filename,
        responseBody: await response.text(),
      });

      throw new Error(`Failed to 'POST' for document upload. Status: ${response.status}, Status Text: ${response.statusText}`);
    }

    const documentUploadResponseEntity = (await response.json()) as DocumentUploadResponseEntity;

    if (documentUploadResponseEntity.Error) {
      this.log.warn('Document upload completed with error: [%j]', documentUploadResponseEntity.Error);
    } else {
      this.log.trace('Successfully uploaded document. DocumentFileName: [%s]', documentUploadResponseEntity.DocumentFileName);
    }

    return documentUploadResponseEntity;
  }

  async scanDocument(scanDocumentRequestEntity: DocumentScanRequestEntity): Promise<DocumentScanResponseEntity> {
    this.log.trace('Scanning document for filename [%s]', scanDocumentRequestEntity.filename);

    const url = `${this.baseUrl}/Scan`;

    const response = await this.httpClient.instrumentedFetch('http.client.document-scan-api.scan.posts', url, {
      proxyUrl: this.serverConfig.HTTP_PROXY_URL,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Ocp-Apim-Subscription-Key': this.serverConfig.INTEROP_API_SUBSCRIPTION_KEY,
      },
      body: JSON.stringify(this.addCredentialsToRequestBody(scanDocumentRequestEntity)),
      retryOptions: {
        retries: this.serverConfig.INTEROP_API_MAX_RETRIES,
        backoffMs: this.serverConfig.INTEROP_API_BACKOFF_MS,
        retryConditions: {
          [HttpStatusCodes.BAD_GATEWAY]: [],
          [HttpStatusCodes.SERVICE_UNAVAILABLE]: [],
          [HttpStatusCodes.GATEWAY_TIMEOUT]: [],
        },
      },
    });

    if (!response.ok) {
      this.log.error('%j', {
        message: `Failed to 'POST' for document scan`,
        status: response.status,
        statusText: response.statusText,
        url: url,
        filename: scanDocumentRequestEntity.filename,
        responseBody: await response.text(),
      });

      throw new Error(`Failed to 'POST' for document scan. Status: ${response.status}, Status Text: ${response.statusText}`);
    }

    const documentScanResponseEntity = (await response.json()) as DocumentScanResponseEntity;

    if (documentScanResponseEntity.Error) {
      this.log.warn('Document scan completed with error: [%j]', documentScanResponseEntity.Error);
    } else {
      this.log.trace('Successfully scanned document. DocumentFileName: [%s]', scanDocumentRequestEntity.filename);
    }

    return documentScanResponseEntity;
  }

  getMetadata(): Record<string, string> {
    return {
      baseUrl: this.baseUrl,
    };
  }

  async checkHealth(): Promise<void> {
    await this.scanDocument({ filename: '', binary: '' });
  }
}

@injectable()
export class MockDocumentUploadRepository implements DocumentUploadRepository {
  private readonly log: Logger;

  constructor() {
    this.log = createLogger('MockDocumentUploadRepository');
  }

  async uploadDocument(documentUploadRequestEntity: DocumentUploadRequestEntity): Promise<DocumentUploadResponseEntity> {
    this.log.debug('Uploading document for filename [%s]', documentUploadRequestEntity.filename);

    this.log.debug('Successfully uploaded document: [%s]', documentUploadRequestEntity.filename);

    return await Promise.resolve({
      DocumentFileName: documentUploadRequestEntity.filename,
      Error: null,
    });
  }

  async scanDocument(scanDocumentRequestEntity: DocumentScanRequestEntity): Promise<DocumentScanResponseEntity> {
    this.log.debug('Scanning document for filename [%s]', scanDocumentRequestEntity.filename);

    this.log.debug('Successfully scanned document. File is safe.');

    return await Promise.resolve({ DataId: 'mock-data-id-12345', Error: null });
  }

  getMetadata(): Record<string, string> {
    return { mockEnabled: 'true' };
  }

  async checkHealth(): Promise<void> {
    return await Promise.resolve();
  }
}
