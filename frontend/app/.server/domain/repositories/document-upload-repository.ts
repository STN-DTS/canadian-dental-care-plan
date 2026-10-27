import { inject, injectable } from 'inversify';
import type { Response } from 'undici';
import * as z from 'zod';

import type { ServerConfig } from '~/.server/configs';
import { TYPES } from '~/.server/constants';
import type { DocumentScanRequestEntity, DocumentScanResponseEntity, DocumentUploadRequestEntity, DocumentUploadResponseEntity } from '~/.server/domain/entities';
import { DocumentUploadException } from '~/.server/domain/exceptions/document-upload-exception';
import type { HttpClient } from '~/.server/http';
import type { Logger } from '~/.server/logging';
import { createLogger } from '~/.server/logging';
import { HttpStatusCodes } from '~/constants/http-status-codes';
import { base64ToArrayBuffer, detectEicarContent } from '~/utils/file-utils';

const errorSchema = z.object({ ErrorCode: z.string(), ErrorMessage: z.string() });
const uploadResponseSchema = z.union([z.object({ DocumentFileName: z.string().min(1), Error: z.null() }), z.object({ DocumentFileName: z.null(), Error: errorSchema })]);
const scanResponseSchema = z.union([z.object({ DataId: z.string().min(1), Error: z.null() }), z.object({ DataId: z.null(), Error: errorSchema })]);

/**
 * A repository that provides document uploading and scanning functionality.
 */
export interface DocumentUploadRepository {
  /**
   * Upload a document to a predetermined drop location.
   * This will process the file through scan for threats and upload the file to an SFTP/FTPS drop location.
   *
   * @param documentUploadRequestEntity The document upload request entity
   * @returns The validated EWDU response for an OK or HTTP 400 response, without business classification.
   * @throws On other HTTP statuses, transport failures, or invalid response payloads.
   */
  uploadDocument(documentUploadRequestEntity: DocumentUploadRequestEntity): Promise<DocumentUploadResponseEntity>;

  /**
   * Scan a document for threats and return scan result synchronously.
   *
   * @param scanDocumentRequestEntity The document scan request entity
   * @returns The validated EWDU response for an OK or HTTP 400 response, without business classification.
   * @throws On other HTTP statuses, transport failures, or invalid response payloads.
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

    const url = `${this.baseUrl}/SPOUploadDocument`;

    const requestBody = this.addCredentialsToRequestBody(documentUploadRequestEntity);

    let response: Response;

    try {
      response = await this.httpClient.instrumentedFetch('http.client.document-scan-api.spo-upload-document.posts', url, {
        proxyUrl: this.serverConfig.HTTP_PROXY_URL,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Ocp-Apim-Subscription-Key': this.serverConfig.INTEROP_API_SUBSCRIPTION_KEY,
        },
        body: JSON.stringify(requestBody),
        // A retry can save the same file twice if the first response was lost.
        // Keep HTTP responses available for classification instead of retrying them.
        retryOptions: { retries: 0, retryConditions: {} },
      });
    } catch (cause) {
      throw new DocumentUploadException('network', undefined, { cause });
    }

    if (!response.ok && response.status !== HttpStatusCodes.BAD_REQUEST) {
      this.log.error('%j', {
        message: `Failed to 'POST' for document upload (SPOUploadDocument)`,
        status: response.status,
        statusText: response.statusText,
        url: url,
      });

      await response.body?.cancel().catch(() => {
        // Preserve the original HTTP failure if cleanup fails.
      });

      throw new DocumentUploadException('http', response.status);
    }

    try {
      return uploadResponseSchema.parse(await response.json());
    } catch (cause) {
      throw new DocumentUploadException('invalid-response', response.status, { cause });
    }
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

    if (!response.ok && response.status !== HttpStatusCodes.BAD_REQUEST) {
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

    return scanResponseSchema.parse(await response.json());
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

    // Model the scan performed by the real upload endpoint, without a separate caller request.
    const scanResult = await this.scanDocument(documentUploadRequestEntity);

    if (scanResult.Error) {
      return { DocumentFileName: null, Error: scanResult.Error };
    }

    if (documentUploadRequestEntity.filename === 'mock-upload-failure.txt') {
      this.log.warn('Mock document upload failed for filename [%s]', documentUploadRequestEntity.filename);

      return await Promise.resolve({
        DocumentFileName: null,
        Error: {
          ErrorCode: 'MOCK_UPLOAD_FAILURE',
          ErrorMessage: 'Mock document upload failed.',
        },
      });
    }

    this.log.debug('Successfully uploaded document: [%s]', documentUploadRequestEntity.filename);

    return await Promise.resolve({
      DocumentFileName: documentUploadRequestEntity.filename,
      Error: null,
    });
  }

  async scanDocument(scanDocumentRequestEntity: DocumentScanRequestEntity): Promise<DocumentScanResponseEntity> {
    this.log.debug('Scanning document for filename [%s]', scanDocumentRequestEntity.filename);

    const documentBuffer = base64ToArrayBuffer(scanDocumentRequestEntity.binary);

    if (!documentBuffer) {
      this.log.warn('Document scan failed: unable to decode binary content for filename [%s]', scanDocumentRequestEntity.filename);
      return await Promise.resolve({
        DataId: null,
        Error: {
          ErrorCode: 'INVALID_BINARY',
          ErrorMessage: 'Failed to decode binary content of the document.',
        },
      });
    }

    if (detectEicarContent(documentBuffer)) {
      this.log.warn('Document scan detected EICAR test content for filename [%s]', scanDocumentRequestEntity.filename);
      return await Promise.resolve({
        DataId: null,
        Error: {
          ErrorCode: '400',
          ErrorMessage: 'File not safe',
        },
      });
    }

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
