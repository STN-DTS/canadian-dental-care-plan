/**
 * Represents a Data Transfer Object (DTO) for Document Upload request.
 */
export type DocumentUploadRequestDto = Readonly<{
  /** Client number identifier */
  clientNumber: string;

  /** Original file name provided by user */
  fileName: string;

  /** Base64 encoded bytes from the file being uploaded */
  binary: string;

  /** Evidentiary document type identifier */
  evidentiaryDocumentTypeId: string;

  /** Upload date */
  uploadDate: Temporal.Instant;

  /** Original last-modified date of the selected file */
  lastModifiedDate: Temporal.Instant;

  /** A unique identifier for the user making the request - used for auditing and as transactionEntryUserID */
  userId: string;
}>;

/**
 * Represents the response from a document upload operation.
 *
 * `success` contains the uploaded filename, `unsafe` or `rejected` contains the EWDU rejection,
 * and `error` indicates a technical failure whose details are logged server-side.
 */
export type DocumentUploadResponseDto =
  | Readonly<{ status: 'success'; documentFileName: string }>
  | Readonly<{ status: 'unsafe'; error: DocumentUploadErrorDto }>
  | Readonly<{ status: 'rejected'; error: DocumentUploadErrorDto }>
  | Readonly<{ status: 'error'; error: unknown }>;

/**
 * Represents a Data Transfer Object (DTO) for Document Upload error.
 */
export type DocumentUploadErrorDto = Readonly<{
  /** Error code */
  errorCode: string;

  /** Error message */
  errorMessage: string;
}>;

/**
 * Represents a Data Transfer Object (DTO) for Document Scan request.
 */
export type DocumentScanRequestDto = Readonly<{
  /** Original file name provided by user */
  fileName: string;

  /** Base64 encoded bytes from the file being uploaded */
  binary: string;

  /** A unique identifier for the user making the request - used for auditing */
  userId: string;
}>;

/**
 * Represents the response from a document scan operation.
 *
 * `success` contains the scan identifier, `unsafe` or `rejected` contains the EWDU rejection,
 * and `error` indicates a technical failure whose details are logged server-side.
 */
export type DocumentScanResponseDto = Readonly<{ status: 'success'; DataId: string }> | Readonly<{ status: 'unsafe'; Error: DocumentUploadErrorDto }> | Readonly<{ status: 'rejected'; Error: DocumentUploadErrorDto }> | Readonly<{ status: 'error' }>;
