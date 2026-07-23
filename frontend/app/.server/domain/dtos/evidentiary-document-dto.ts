import type { ReadonlyDeep } from 'type-fest';

/**
 * DTO representing an evidentiary document.
 */
export type EvidentiaryDocumentDto = ReadonlyDeep<{
  id: string;
  fileName: string;
  clientId: string;
  documentTypeId: string;
  mscaUploadDate: string; // ISO 8601 date string
  healthCanadaTransferDate?: string; // ISO 8601 date string
  client: {
    id: string;
    firstName: string;
    lastName: string;
  };
  documentType: {
    id: string;
    nameEnglish: string;
    nameFrench: string;
  };
}>;

/**
 * Localized DTO representing an evidentiary document.
 */
export type EvidentiaryDocumentLocalizedDto = ReadonlyDeep<{
  id: string;
  fileName: string;
  clientId: string;
  documentTypeId: string;
  mscaUploadDate: string; // ISO 8601 date string
  healthCanadaTransferDate?: string; // ISO 8601 date string
  client: {
    id: string;
    firstName: string;
    lastName: string;
  };
  documentType: {
    id: string;
    name: string;
  };
}>;

/**
 * DTO for uploading evidentiary document metadata
 */
export type CreateEvidentiaryDocumentMetadataDto = ReadonlyDeep<{
  fileName: string;
  evidentiaryDocumentTypeId: string;
  documentUploadReasonId: string;
  recordSource: number; // Online = 775170001, MSCA = 775170004
  uploadDate: Date;
  healthCanadaTransferDate?: string; // ISO 8601 date string
}>;

/**
 * DTO representing the response from uploading document metadata
 */
export type CreateEvidentiaryDocumentMetadataResponseDto = ReadonlyDeep<{
  evidentiaryDocuments: ReadonlyArray<{
    fileName: string;
    evidentiaryDocumentTypeId: string;
    documentUploadReasonId: string;
    uploadDate: string;
    healthCanadaTransferDate?: string;
    clientId: string;
    recordSource: number;
  }>;
}>;

/*
 * Request object for listing evidentiary documents.
 */
export type ListEvidentiaryDocumentsRequest = Readonly<{
  /** The client ID of the applicant. */
  clientId: string;

  /** A unique identifier for the applicant - used for auditing */
  userId: string;
}>;

/**
 * Request object for uploading evidentiary document metadata
 */
export type CreateEvidentiaryDocumentMetadataRequest = Readonly<{
  /** The client ID of the applicant. */
  clientId: string;

  /** A unique identifier for the applicant - used for auditing */
  userId: string;

  /** The documents to upload */
  documents: ReadonlyArray<CreateEvidentiaryDocumentMetadataDto>;
}>;
