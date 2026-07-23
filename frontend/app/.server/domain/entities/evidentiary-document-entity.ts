import type { ReadonlyDeep } from 'type-fest';

/**
 * Entity representing an evidentiary document.
 */
export type EvidentiaryDocumentEntity = ReadonlyDeep<{
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
 * Entity for uploading evidentiary document metadata
 */
export type UploadEvidentiaryDocumentMetadataEntity = ReadonlyDeep<{
  fileName: string;
  documentTypeId: string;
  documentUploadReasonId: string;
  recordSource: number; // Online = 775170001, MSCA = 775170004
  uploadDate: string; // ISO 8601 date string
  healthCanadaTransferDate?: string; // ISO 8601 date string
}>;

/**
 * Entity representing the response from uploading document metadata
 */
export type CreateEvidentiaryDocumentMetadataResponseEntity = ReadonlyDeep<{
  esdc_evidentiarydocuments: ReadonlyArray<{
    esdc_filename: string;
    _esdc_documenttypeid_value: string;
    _esdc_documentuploadreasonid_value: string;
    esdc_uploaddate: string;
    esdc_hctransferdate?: string;
    _esdc_clientid_value: string;
    esdc_recordsource: number;
  }>;
}>;

/**
 * Request entity for the Power Platform API for GET evidentiary documents
 */
export type FindEvidentiaryDocumentsRequest = Readonly<{
  clientId: string;
  userId: string;
}>;

/**
 * Request entity for the Power Platform API for POST evidentiary documents
 */
export type CreateEvidentiaryDocumentMetadataRepositoryRequest = Readonly<{
  clientId: string;
  userId: string;
  documents: ReadonlyArray<UploadEvidentiaryDocumentMetadataEntity>;
}>;

/**
 * Response entity from the Power Platform API for GET
 */
export type EvidentiaryDocumentResponseEntity = ReadonlyDeep<{
  value: ReadonlyArray<{
    esdc_filename: string;
    _esdc_documenttypeid_value: string;
    esdc_evidentiarydocumentid: string;
    esdc_uploaddate: string;
    esdc_Clientid: {
      esdc_clientid: string;
      esdc_lastname: string;
      esdc_firstname: string;
    };
    esdc_DocumentTypeid: {
      esdc_namefrench: string;
      esdc_evidentiarydocumenttypeid: string;
      esdc_nameenglish: string;
    };
  }>;
}>;
