import { ATTR_ERROR_TYPE, ATTR_HTTP_RESPONSE_STATUS_CODE } from '@opentelemetry/semantic-conventions';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import type { DocumentScanRequestDto, DocumentUploadRequestDto } from '~/.server/domain/dtos';
import type { DocumentScanRequestEntity, DocumentUploadRequestEntity } from '~/.server/domain/entities';
import type { DocumentUploadDtoMapper } from '~/.server/domain/mappers';
import { DefaultDocumentUploadDtoMapper } from '~/.server/domain/mappers/document-upload-dto-mapper';
import type { DocumentUploadRepository } from '~/.server/domain/repositories';
import { DefaultDocumentUploadService } from '~/.server/domain/services';
import type { AuditService, EvidentiaryDocumentTypeService } from '~/.server/domain/services';
import { createLogger } from '~/.server/logging';
import type { Logger } from '~/.server/logging';
import { EVIDENTIARY_DOCUMENT_TYPE_STATUS } from '~/constants/evidentiary-document-type';
import { AppError } from '~/errors/app-error';
import { ErrorCodes } from '~/errors/error-codes';

const scanRequest: DocumentScanRequestDto = {
  fileName: 'document.txt',
  binary: 'Y29udGVudA==',
};

const uploadRequest: DocumentUploadRequestDto = {
  ...scanRequest,
  clientNumber: 'client-123',
  evidentiaryDocumentTypeId: 'receipt',
  uploadDate: Temporal.Instant.from('2026-10-27T12:00:00Z'),
  lastModifiedDate: Temporal.Instant.from('2026-10-26T12:00:00Z'),
  userId: 'user-123',
};

const scanEntity: DocumentScanRequestEntity = { filename: scanRequest.fileName, binary: scanRequest.binary };
const uploadEntity: DocumentUploadRequestEntity = {
  ...scanEntity,
  subjectPersonIdentificationID: uploadRequest.clientNumber,
  documentCategoryText: 'RECEIPT',
  originalDocumentCreationDate: uploadRequest.uploadDate.toString(),
  originalDocumentLastModifiedDate: uploadRequest.lastModifiedDate.toString(),
  transactionEntryUserID: uploadRequest.userId,
  persist: true,
  commit: true,
};

describe('DefaultDocumentUploadService', () => {
  let mapper: ReturnType<typeof mock<DocumentUploadDtoMapper>>;
  let repository: ReturnType<typeof mock<DocumentUploadRepository>>;
  let auditService: ReturnType<typeof mock<AuditService>>;
  let logger: ReturnType<typeof mock<Logger>>;
  let service: DefaultDocumentUploadService;

  beforeEach(() => {
    mapper = mock<DocumentUploadDtoMapper>();
    repository = mock<DocumentUploadRepository>();
    auditService = mock<AuditService>();
    logger = mock<Logger>();
    vi.mocked(createLogger).mockReturnValue(logger);
    mapper.mapDocumentScanRequestDtoToEntity.mockReturnValue(scanEntity);
    mapper.mapDocumentUploadRequestDtoToEntity.mockResolvedValue(uploadEntity);
    mapper.mapDocumentUploadErrorEntityToDto.mockImplementation((error) => {
      return {
        errorCode: error.ErrorCode,
        errorMessage: error.ErrorMessage,
      };
    });
    service = new DefaultDocumentUploadService(mapper, repository, auditService);
  });

  describe('uploadDocument', () => {
    it('should audit, map, and upload once without a separate scan', async () => {
      repository.uploadDocument.mockResolvedValue({ DocumentFileName: 'stored-document.txt', Error: null });

      await expect(service.uploadDocument(uploadRequest)).resolves.toEqual({ status: 'success', documentFileName: 'stored-document.txt' });

      expect(auditService.createAudit).toHaveBeenCalledExactlyOnceWith('documentupload.upload');
      expect(mapper.mapDocumentUploadRequestDtoToEntity).toHaveBeenCalledExactlyOnceWith(uploadRequest);
      expect(repository.uploadDocument).toHaveBeenCalledExactlyOnceWith(uploadEntity);
      expect(repository.scanDocument).not.toHaveBeenCalled();
    });

    it('should return a mapped EWDU rejection, distinct from a technical failure', async () => {
      repository.uploadDocument.mockResolvedValue({ DocumentFileName: null, Error: { ErrorCode: 'EWDU_REJECTED', ErrorMessage: 'Document rejected' } });

      await expect(service.uploadDocument(uploadRequest)).resolves.toEqual({ status: 'rejected', error: { errorCode: 'EWDU_REJECTED', errorMessage: 'Document rejected' } });

      expect(mapper.mapDocumentUploadErrorEntityToDto).toHaveBeenCalledWith({ ErrorCode: 'EWDU_REJECTED', ErrorMessage: 'Document rejected' });
      expect(logger.warn).toHaveBeenCalledWith('Document upload rejected', { 'cdcp.document.outcome': 'rejected' });
      expect(logger.error).not.toHaveBeenCalled();
    });

    it.each([
      ['400', 'File not safe', 'unsafe'],
      ['400', 'Missing mandatory field', 'rejected'],
      ['400', 'Invalid POST body', 'rejected'],
      ['400', 'file not safe', 'rejected'],
      ['404', 'File not safe', 'rejected'],
      ['MOCK_UPLOAD_FAILURE', 'Mock document upload failed.', 'rejected'],
    ] as const)('should classify upload rejection %s / %s as %s', async (errorCode, errorMessage, status) => {
      repository.uploadDocument.mockResolvedValue({ DocumentFileName: null, Error: { ErrorCode: errorCode, ErrorMessage: errorMessage } });

      await expect(service.uploadDocument(uploadRequest)).resolves.toEqual({ status, error: { errorCode, errorMessage } });
    });

    it.each([
      ['HTTP bad request', new AppError('Document upload failed with HTTP 400.', ErrorCodes.API_DOC_UPLOAD_FAILED, { httpStatusCode: 400 })],
      ['HTTP service failure', new AppError('Document upload failed with HTTP 503.', ErrorCodes.API_DOC_UPLOAD_FAILED, { httpStatusCode: 503 })],
      ['network failure', new AppError('Document upload failed during authentication or request.', ErrorCodes.API_DOC_UPLOAD_FAILED)],
      ['invalid response', new AppError('Document upload returned an invalid response (HTTP 200).', ErrorCodes.API_DOC_UPLOAD_FAILED)],
    ])('should absorb and log a %s without retrying', async (_name, error) => {
      repository.uploadDocument.mockRejectedValue(error);

      await expect(service.uploadDocument(uploadRequest)).resolves.toEqual({ status: 'error', error });

      expect(logger.error).toHaveBeenCalledWith(error, {
        [ATTR_ERROR_TYPE]: 'document_upload_failed',
        [ATTR_HTTP_RESPONSE_STATUS_CODE]: error.httpStatusCode,
      });
      expect(repository.uploadDocument).toHaveBeenCalledOnce();
    });

    it.each([new Error('unexpected repository failure'), 'non-Error rejection'])('should absorb and log an unexpected repository failure: %s', async (error) => {
      repository.uploadDocument.mockRejectedValue(error);

      const result = await service.uploadDocument(uploadRequest);

      expect(result).toEqual({ status: 'error', error });
      expect(result.status === 'error' && result.error).toBe(error);

      expect(logger.error).toHaveBeenCalledWith(error, { [ATTR_ERROR_TYPE]: 'document_upload_failed' });
    });

    it('should absorb request mapping failures without submitting the file', async () => {
      const error = new Error('document type lookup failed');
      mapper.mapDocumentUploadRequestDtoToEntity.mockRejectedValue(error);

      await expect(service.uploadDocument(uploadRequest)).resolves.toEqual({ status: 'error', error });

      expect(logger.error).toHaveBeenCalledWith(error, { [ATTR_ERROR_TYPE]: 'document_upload_failed' });
      expect(repository.uploadDocument).not.toHaveBeenCalled();
    });

    it('should absorb rejection mapping failures', async () => {
      const error = new Error('response mapping failed');
      repository.uploadDocument.mockResolvedValue({ DocumentFileName: null, Error: { ErrorCode: 'EWDU_REJECTED', ErrorMessage: 'Document rejected' } });
      mapper.mapDocumentUploadErrorEntityToDto.mockImplementation(() => {
        throw error;
      });

      await expect(service.uploadDocument(uploadRequest)).resolves.toEqual({ status: 'error', error });

      expect(logger.error).toHaveBeenCalledWith(error, { [ATTR_ERROR_TYPE]: 'document_upload_failed' });
    });

    it('should not submit an unaudited upload if auditing fails', async () => {
      const error = new Error('audit unavailable');
      auditService.createAudit.mockImplementation(() => {
        throw error;
      });

      await expect(service.uploadDocument(uploadRequest)).resolves.toEqual({ status: 'error', error });

      expect(logger.error).toHaveBeenCalledWith(error, { [ATTR_ERROR_TYPE]: 'document_upload_failed' });
      expect(mapper.mapDocumentUploadRequestDtoToEntity).not.toHaveBeenCalled();
      expect(repository.uploadDocument).not.toHaveBeenCalled();
    });

    it('uses the caller-provided user ID without a request context', async () => {
      const documentTypeService = mock<EvidentiaryDocumentTypeService>();
      documentTypeService.getEvidentiaryDocumentTypeById.mockResolvedValue({
        id: 'receipt',
        code: 'RECEIPT',
        nameEn: 'Receipt',
        nameFr: 'Receipt',
        status: EVIDENTIARY_DOCUMENT_TYPE_STATUS.active,
      });
      service = new DefaultDocumentUploadService(new DefaultDocumentUploadDtoMapper(documentTypeService), repository, auditService);
      repository.uploadDocument.mockResolvedValue({ DocumentFileName: 'stored-document.txt', Error: null });

      await expect(service.uploadDocument({ ...uploadRequest, userId: 'caller-user-456' })).resolves.toEqual({ status: 'success', documentFileName: 'stored-document.txt' });
      expect(repository.uploadDocument).toHaveBeenCalledWith(expect.objectContaining({ transactionEntryUserID: 'caller-user-456' }));
      expect(auditService.createAudit).toHaveBeenCalledExactlyOnceWith('documentupload.upload');
    });
  });

  describe('scanDocument', () => {
    it('should audit, map, and return a successful scan', async () => {
      repository.scanDocument.mockResolvedValue({ DataId: 'scan-123', Error: null });

      await expect(service.scanDocument(scanRequest)).resolves.toEqual({ status: 'success', DataId: 'scan-123' });

      expect(auditService.createAudit).toHaveBeenCalledExactlyOnceWith('documentupload.scan');
      expect(mapper.mapDocumentScanRequestDtoToEntity).toHaveBeenCalledExactlyOnceWith(scanRequest);
      expect(repository.scanDocument).toHaveBeenCalledExactlyOnceWith(scanEntity);
      expect(repository.uploadDocument).not.toHaveBeenCalled();
    });

    it('should return a mapped EWDU scan rejection', async () => {
      repository.scanDocument.mockResolvedValue({ DataId: null, Error: { ErrorCode: 'EWDU_REJECTED', ErrorMessage: 'Document rejected' } });

      await expect(service.scanDocument(scanRequest)).resolves.toEqual({ status: 'rejected', Error: { errorCode: 'EWDU_REJECTED', errorMessage: 'Document rejected' } });

      expect(mapper.mapDocumentUploadErrorEntityToDto).toHaveBeenCalledWith({ ErrorCode: 'EWDU_REJECTED', ErrorMessage: 'Document rejected' });
      expect(logger.warn).toHaveBeenCalledWith('Document scan rejected', { 'cdcp.document.outcome': 'rejected' });
      expect(logger.error).not.toHaveBeenCalled();
    });

    it.each([
      ['400', 'File not safe', 'unsafe'],
      ['400', 'Missing mandatory field', 'rejected'],
      ['400', 'Invalid POST body', 'rejected'],
      ['400', 'file not safe', 'rejected'],
      ['404', 'File not safe', 'rejected'],
    ] as const)('should classify scan rejection %s / %s as %s', async (errorCode, errorMessage, status) => {
      repository.scanDocument.mockResolvedValue({ DataId: null, Error: { ErrorCode: errorCode, ErrorMessage: errorMessage } });

      await expect(service.scanDocument(scanRequest)).resolves.toEqual({ status, Error: { errorCode, errorMessage } });
    });

    it.each([new Error('scan unavailable'), 'non-Error rejection'])('should absorb and log scan repository failures: %s', async (error) => {
      repository.scanDocument.mockRejectedValue(error);

      await expect(service.scanDocument(scanRequest)).resolves.toEqual({ status: 'error' });

      expect(logger.error).toHaveBeenCalledWith('Unexpected document scan error', { [ATTR_ERROR_TYPE]: 'document_scan_failed' });
      expect(repository.scanDocument).toHaveBeenCalledOnce();
    });

    it('should absorb request mapping failures without scanning', async () => {
      const error = new Error('scan request mapping failed');
      mapper.mapDocumentScanRequestDtoToEntity.mockImplementation(() => {
        throw error;
      });

      await expect(service.scanDocument(scanRequest)).resolves.toEqual({ status: 'error' });

      expect(logger.error).toHaveBeenCalledWith('Unexpected document scan error', { [ATTR_ERROR_TYPE]: 'document_scan_failed' });
      expect(repository.scanDocument).not.toHaveBeenCalled();
    });

    it('should absorb rejection mapping failures', async () => {
      const error = new Error('scan response mapping failed');
      repository.scanDocument.mockResolvedValue({ DataId: null, Error: { ErrorCode: 'EWDU_REJECTED', ErrorMessage: 'Document rejected' } });
      mapper.mapDocumentUploadErrorEntityToDto.mockImplementation(() => {
        throw error;
      });

      await expect(service.scanDocument(scanRequest)).resolves.toEqual({ status: 'error' });

      expect(logger.error).toHaveBeenCalledWith('Unexpected document scan error', { [ATTR_ERROR_TYPE]: 'document_scan_failed' });
    });

    it('should not scan an unaudited document if auditing fails', async () => {
      const error = new Error('audit unavailable');
      auditService.createAudit.mockImplementation(() => {
        throw error;
      });

      await expect(service.scanDocument(scanRequest)).resolves.toEqual({ status: 'error' });

      expect(logger.error).toHaveBeenCalledWith('Unexpected document scan error', { [ATTR_ERROR_TYPE]: 'document_scan_failed' });
      expect(repository.scanDocument).not.toHaveBeenCalled();
    });
  });
});
