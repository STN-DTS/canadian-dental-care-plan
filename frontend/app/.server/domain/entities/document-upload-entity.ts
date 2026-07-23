export type DocumentUploadResponseEntity = Readonly<
  | { DocumentFileName: string; Error: null } //
  | { DocumentFileName: null; Error: DocumentUploadErrorEntity }
>;

export type DocumentUploadErrorEntity = Readonly<{
  ErrorCode: string;
  ErrorMessage: string;
}>;

export type DocumentScanResponseEntity = Readonly<
  | { DataId: string; Error: null } //
  | { DataId: null; Error: DocumentUploadErrorEntity }
>;

export type DocumentUploadRequestEntity = Readonly<{
  filename: string;
  binary: string;
  subjectPersonIdentificationID: string;
  documentCategoryText: string;
  originalDocumentCreationDate: string;
}>;

export type DocumentScanRequestEntity = Readonly<{
  filename: string;
  binary: string;
}>;
