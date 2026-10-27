import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import type { DocumentScanRequestDto, DocumentUploadRequestDto } from '~/.server/domain/dtos';
import type { DocumentScanRequestEntity, DocumentUploadRequestEntity } from '~/.server/domain/entities';
import { DocumentUploadException } from '~/.server/domain/exceptions/document-upload-exception';
import type { DocumentUploadDtoMapper } from '~/.server/domain/mappers';
import type { DocumentUploadRepository } from '~/.server/domain/repositories';
import { DefaultDocumentUploadService } from '~/.server/domain/services';
import type { AuditService } from '~/.server/domain/services';
import { createLogger } from '~/.server/logging';
import type { Logger } from '~/.server/logging';

const scanRequest: DocumentScanRequestDto = {
  fileName: 'document.txt',
  binary: 'Y29udGVudA==',
  userId: 'user-123',
};

const uploadRequest: DocumentUploadRequestDto = {
  ...scanRequest,
  clientNumber: 'client-123',
  evidentiaryDocumentTypeId: 'receipt',
  uploadDate: new Date('2026-10-27T12:00:00Z'),
  lastModifiedDate: new Date('2026-10-26T12:00:00Z'),
};

const scanEntity: DocumentScanRequestEntity = { filename: scanRequest.fileName, binary: scanRequest.binary };
const uploadEntity: DocumentUploadRequestEntity = {
  ...scanEntity,
  subjectPersonIdentificationID: uploadRequest.clientNumber,
  documentCategoryText: 'RECEIPT',
  originalDocumentCreationDate: uploadRequest.uploadDate.toISOString(),
  originalDocumentLastModifiedDate: uploadRequest.lastModifiedDate.toISOString(),
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

      expect(auditService.createAudit).toHaveBeenCalledExactlyOnceWith('documentupload.upload', { userId: uploadRequest.userId });
      expect(mapper.mapDocumentUploadRequestDtoToEntity).toHaveBeenCalledExactlyOnceWith(uploadRequest);
      expect(repository.uploadDocument).toHaveBeenCalledExactlyOnceWith(uploadEntity);
      expect(repository.scanDocument).not.toHaveBeenCalled();
    });

    it('should return a mapped EWDU rejection, distinct from a technical failure', async () => {
      repository.uploadDocument.mockResolvedValue({ DocumentFileName: null, Error: { ErrorCode: 'EWDU_REJECTED', ErrorMessage: 'Document rejected' } });

      await expect(service.uploadDocument(uploadRequest)).resolves.toEqual({ status: 'rejected', error: { errorCode: 'EWDU_REJECTED', errorMessage: 'Document rejected' } });

      expect(mapper.mapDocumentUploadErrorEntityToDto).toHaveBeenCalledWith({ ErrorCode: 'EWDU_REJECTED', ErrorMessage: 'Document rejected' });
      expect(logger.warn).toHaveBeenCalledWith('Document upload rejected with code [%s]', 'EWDU_REJECTED');
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
      ['HTTP bad request', new DocumentUploadException('http', 400)],
      ['HTTP service failure', new DocumentUploadException('http', 503)],
      ['network failure', new DocumentUploadException('network')],
      ['invalid response', new DocumentUploadException('invalid-response', 200)],
    ])('should absorb and log a %s without retrying', async (_name, error) => {
      repository.uploadDocument.mockRejectedValue(error);

      await expect(service.uploadDocument(uploadRequest)).resolves.toEqual({ status: 'error', error });

      expect(logger.error).toHaveBeenCalledWith('Technical upload failure; kind [%s]; HTTP status [%s]', error.kind, error.httpStatus);
      expect(repository.uploadDocument).toHaveBeenCalledOnce();
    });

    it.each([new Error('unexpected repository failure'), 'non-Error rejection'])('should absorb and log an unexpected repository failure: %s', async (error) => {
      repository.uploadDocument.mockRejectedValue(error);

      const result = await service.uploadDocument(uploadRequest);

      expect(result).toEqual({ status: 'error', error });
      expect(result.status === 'error' && result.error).toBe(error);

      expect(logger.error).toHaveBeenCalledWith('Unexpected document upload error [%s]', error);
    });

    it('should absorb request mapping failures without submitting the file', async () => {
      const error = new Error('document type lookup failed');
      mapper.mapDocumentUploadRequestDtoToEntity.mockRejectedValue(error);

      await expect(service.uploadDocument(uploadRequest)).resolves.toEqual({ status: 'error', error });

      expect(logger.error).toHaveBeenCalledWith('Unexpected document upload error [%s]', error);
      expect(repository.uploadDocument).not.toHaveBeenCalled();
    });

    it('should absorb rejection mapping failures', async () => {
      const error = new Error('response mapping failed');
      repository.uploadDocument.mockResolvedValue({ DocumentFileName: null, Error: { ErrorCode: 'EWDU_REJECTED', ErrorMessage: 'Document rejected' } });
      mapper.mapDocumentUploadErrorEntityToDto.mockImplementation(() => {
        throw error;
      });

      await expect(service.uploadDocument(uploadRequest)).resolves.toEqual({ status: 'error', error });

      expect(logger.error).toHaveBeenCalledWith('Unexpected document upload error [%s]', error);
    });

    it('should not submit an unaudited upload if auditing fails', async () => {
      const error = new Error('audit unavailable');
      auditService.createAudit.mockImplementation(() => {
        throw error;
      });

      await expect(service.uploadDocument(uploadRequest)).resolves.toEqual({ status: 'error', error });

      expect(logger.error).toHaveBeenCalledWith('Unexpected document upload error [%s]', error);
      expect(mapper.mapDocumentUploadRequestDtoToEntity).not.toHaveBeenCalled();
      expect(repository.uploadDocument).not.toHaveBeenCalled();
    });
  });

  describe('scanDocument', () => {
    it('should audit, map, and return a successful scan', async () => {
      repository.scanDocument.mockResolvedValue({ DataId: 'scan-123', Error: null });

      await expect(service.scanDocument(scanRequest)).resolves.toEqual({ status: 'success', DataId: 'scan-123' });

      expect(auditService.createAudit).toHaveBeenCalledExactlyOnceWith('documentupload.scan', { userId: scanRequest.userId });
      expect(mapper.mapDocumentScanRequestDtoToEntity).toHaveBeenCalledExactlyOnceWith(scanRequest);
      expect(repository.scanDocument).toHaveBeenCalledExactlyOnceWith(scanEntity);
      expect(repository.uploadDocument).not.toHaveBeenCalled();
    });

    it('should return a mapped EWDU scan rejection', async () => {
      repository.scanDocument.mockResolvedValue({ DataId: null, Error: { ErrorCode: 'EWDU_REJECTED', ErrorMessage: 'Document rejected' } });

      await expect(service.scanDocument(scanRequest)).resolves.toEqual({ status: 'rejected', Error: { errorCode: 'EWDU_REJECTED', errorMessage: 'Document rejected' } });

      expect(mapper.mapDocumentUploadErrorEntityToDto).toHaveBeenCalledWith({ ErrorCode: 'EWDU_REJECTED', ErrorMessage: 'Document rejected' });
      expect(logger.warn).toHaveBeenCalledWith('Document scan rejected with code [%s]', 'EWDU_REJECTED');
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

      expect(logger.error).toHaveBeenCalledWith('Unexpected document scan error [%s]', error);
      expect(repository.scanDocument).toHaveBeenCalledOnce();
    });

    it('should absorb request mapping failures without scanning', async () => {
      const error = new Error('scan request mapping failed');
      mapper.mapDocumentScanRequestDtoToEntity.mockImplementation(() => {
        throw error;
      });

      await expect(service.scanDocument(scanRequest)).resolves.toEqual({ status: 'error' });

      expect(logger.error).toHaveBeenCalledWith('Unexpected document scan error [%s]', error);
      expect(repository.scanDocument).not.toHaveBeenCalled();
    });

    it('should absorb rejection mapping failures', async () => {
      const error = new Error('scan response mapping failed');
      repository.scanDocument.mockResolvedValue({ DataId: null, Error: { ErrorCode: 'EWDU_REJECTED', ErrorMessage: 'Document rejected' } });
      mapper.mapDocumentUploadErrorEntityToDto.mockImplementation(() => {
        throw error;
      });

      await expect(service.scanDocument(scanRequest)).resolves.toEqual({ status: 'error' });

      expect(logger.error).toHaveBeenCalledWith('Unexpected document scan error [%s]', error);
    });

    it('should not scan an unaudited document if auditing fails', async () => {
      const error = new Error('audit unavailable');
      auditService.createAudit.mockImplementation(() => {
        throw error;
      });

      await expect(service.scanDocument(scanRequest)).resolves.toEqual({ status: 'error' });

      expect(logger.error).toHaveBeenCalledWith('Unexpected document scan error [%s]', error);
      expect(repository.scanDocument).not.toHaveBeenCalled();
    });
  });
});
