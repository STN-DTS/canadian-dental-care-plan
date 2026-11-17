import type { DocumentScanRequestEntity, DocumentScanResponseEntity, DocumentUploadRequestEntity, DocumentUploadResponseEntity } from '~/.server/domain/entities';

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
