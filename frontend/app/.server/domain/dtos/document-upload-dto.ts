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
  uploadDate: Date;

  /** A unique identifier for the user making the request - used for auditing */
  userId: string;
}>;

/**
 * Represents the response from a document upload operation.
 *
 * This is a discriminated union type that represents either a successful upload
 * or an error state, but never both simultaneously.
 *
 * @remarks
 * The type uses a discriminated union pattern where:
 * - On success: `DocumentFileName` contains the filename and `Error` is undefined
 * - On failure: `DocumentFileName` is undefined and `Error` contains error details
 */
export type DocumentUploadResponseDto = Readonly<
  | { DocumentFileName: string; Error?: undefined } //
  | { DocumentFileName?: undefined; Error: DocumentUploadErrorDto }
>;

/**
 * Represents a Data Transfer Object (DTO) for Document Upload error.
 */
export type DocumentUploadErrorDto = Readonly<{
  /** Error code */
  ErrorCode: string;

  /** Error message */
  ErrorMessage: string;
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
 * This is a discriminated union type that can represent either a successful scan result
 * or an error state.
 *
 * @remarks
 * - On success: Contains a `DataId` string and `Error` is undefined
 * - On failure: Contains an `Error` object of type `DocumentUploadErrorDto` and `DataId` is undefined
 */
export type DocumentScanResponseDto = Readonly<
  | { DataId: string; Error?: undefined } //
  | { DataId?: undefined; Error: DocumentUploadErrorDto }
>;
