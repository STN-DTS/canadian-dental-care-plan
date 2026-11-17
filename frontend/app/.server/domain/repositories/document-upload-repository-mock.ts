import { injectable } from 'inversify';

import type { DocumentScanRequestEntity, DocumentScanResponseEntity, DocumentUploadRequestEntity, DocumentUploadResponseEntity } from '~/.server/domain/entities';
import type { DocumentUploadRepository } from '~/.server/domain/repositories/document-upload-repository';
import type { Logger } from '~/.server/logging';
import { createLogger } from '~/.server/logging';
import { ATTR_CDCP_DOCUMENT_OUTCOME } from '~/.server/logging/log-attributes';
import { base64ToArrayBuffer, detectEicarContent } from '~/utils/file-utils';

@injectable()
export class MockDocumentUploadRepository implements DocumentUploadRepository {
  private readonly log: Logger;

  constructor() {
    this.log = createLogger('MockDocumentUploadRepository');
  }

  async uploadDocument(documentUploadRequestEntity: DocumentUploadRequestEntity): Promise<DocumentUploadResponseEntity> {
    this.log.debug('Uploading mock document');

    // Model the scan performed by the real upload endpoint, without a separate caller request.
    const scanResult = await this.scanDocument(documentUploadRequestEntity);

    if (scanResult.Error) {
      return { DocumentFileName: null, Error: scanResult.Error };
    }

    if (documentUploadRequestEntity.filename === 'mock-upload-failure.txt') {
      this.log.debug('Mock document upload rejected', { [ATTR_CDCP_DOCUMENT_OUTCOME]: 'rejected' });

      return await Promise.resolve({
        DocumentFileName: null,
        Error: {
          ErrorCode: 'MOCK_UPLOAD_FAILURE',
          ErrorMessage: 'Mock document upload failed.',
        },
      });
    }

    this.log.debug('Mock document uploaded successfully');

    return await Promise.resolve({
      DocumentFileName: documentUploadRequestEntity.filename,
      Error: null,
    });
  }

  async scanDocument(scanDocumentRequestEntity: DocumentScanRequestEntity): Promise<DocumentScanResponseEntity> {
    this.log.debug('Scanning mock document');

    const documentBuffer = base64ToArrayBuffer(scanDocumentRequestEntity.binary);

    if (!documentBuffer) {
      this.log.debug('Mock document scan could not decode binary content', { [ATTR_CDCP_DOCUMENT_OUTCOME]: 'rejected' });
      return await Promise.resolve({
        DataId: null,
        Error: {
          ErrorCode: 'INVALID_BINARY',
          ErrorMessage: 'Failed to decode binary content of the document.',
        },
      });
    }

    if (detectEicarContent(documentBuffer)) {
      this.log.debug('Mock document scan detected EICAR test content', { [ATTR_CDCP_DOCUMENT_OUTCOME]: 'unsafe' });
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
