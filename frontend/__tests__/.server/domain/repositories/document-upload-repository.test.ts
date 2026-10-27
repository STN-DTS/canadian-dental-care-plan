import { Response } from 'undici';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import type { ServerConfig } from '~/.server/configs';
import type { DocumentScanRequestEntity, DocumentUploadRequestEntity } from '~/.server/domain/entities';
import type { DocumentUploadException } from '~/.server/domain/exceptions/document-upload-exception';
import { DefaultDocumentUploadRepository, MockDocumentUploadRepository } from '~/.server/domain/repositories';
import type { HttpClient } from '~/.server/http';
import { expectDefined } from '~/utils/assert-utils';

const uploadRequest = {
  filename: 'document.txt',
  binary: 'dGVzdA==',
  subjectPersonIdentificationID: 'client-123',
  documentCategoryText: 'receipt',
  originalDocumentCreationDate: '2026-10-06',
  transactionEntryUserID: 'user-123',
  originalDocumentLastModifiedDate: '2026-10-06',
  persist: true,
  commit: true,
} satisfies DocumentUploadRequestEntity;

const scanRequest = { filename: uploadRequest.filename, binary: uploadRequest.binary } satisfies DocumentScanRequestEntity;

const serverConfig = {
  HTTP_PROXY_URL: 'http://proxy.example.test',
  INTEROP_API_SUBSCRIPTION_KEY: 'subscription-key',
  INTEROP_API_BASE_URI: 'https://interop.example.test',
  EWDU_ENCAPSULATION_USERNAME: 'username',
  EWDU_ENCAPSULATION_PASSWORD: 'password',
  EWDU_PROGRAM_ACTIVITY_ID: 'activity-id',
  INTEROP_API_MAX_RETRIES: 3,
  INTEROP_API_BACKOFF_MS: 100,
} satisfies Pick<ServerConfig, 'HTTP_PROXY_URL' | 'INTEROP_API_SUBSCRIPTION_KEY' | 'INTEROP_API_BASE_URI' | 'EWDU_ENCAPSULATION_USERNAME' | 'EWDU_ENCAPSULATION_PASSWORD' | 'EWDU_PROGRAM_ACTIVITY_ID' | 'INTEROP_API_MAX_RETRIES' | 'INTEROP_API_BACKOFF_MS'>;

describe('DefaultDocumentUploadRepository', () => {
  const httpClientMock = mock<HttpClient>();
  let repository: DefaultDocumentUploadRepository;

  beforeEach(() => {
    httpClientMock.instrumentedFetch.mockReset();
    repository = new DefaultDocumentUploadRepository(serverConfig, httpClientMock);
  });

  it('posts once to SPOUploadDocument and returns an accepted response', async () => {
    httpClientMock.instrumentedFetch.mockResolvedValue(Response.json({ DocumentFileName: 'document.txt', Error: null }));

    await expect(repository.uploadDocument(uploadRequest)).resolves.toEqual({ DocumentFileName: 'document.txt', Error: null });
    expect(httpClientMock.instrumentedFetch).toHaveBeenCalledExactlyOnceWith('http.client.document-scan-api.spo-upload-document.posts', 'https://interop.example.test/client-correspondence/document-upload/cct/v1/api/SPOUploadDocument', {
      proxyUrl: serverConfig.HTTP_PROXY_URL,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Ocp-Apim-Subscription-Key': serverConfig.INTEROP_API_SUBSCRIPTION_KEY,
      },
      body: JSON.stringify({
        ...uploadRequest,
        username: serverConfig.EWDU_ENCAPSULATION_USERNAME,
        password: serverConfig.EWDU_ENCAPSULATION_PASSWORD,
        programActivityIdentificationID: serverConfig.EWDU_PROGRAM_ACTIVITY_ID,
      }),
      retryOptions: { retries: 0, retryConditions: {} },
    });
  });

  it('returns a valid service rejection without translating it to a transport failure', async () => {
    const rejection = { DocumentFileName: null, Error: { ErrorCode: 'SERVICE_REJECTED', ErrorMessage: 'Rejected by service' } };
    httpClientMock.instrumentedFetch.mockResolvedValue(Response.json(rejection));

    await expect(repository.uploadDocument(uploadRequest)).resolves.toEqual(rejection);
  });

  it('preserves the confirmed HTTP 400 unsafe-file payload for service classification', async () => {
    const rejection = { DocumentFileName: null, Error: { ErrorCode: '400', ErrorMessage: 'File not safe' } };
    httpClientMock.instrumentedFetch.mockResolvedValue(Response.json(rejection, { status: 400 }));

    await expect(repository.uploadDocument(uploadRequest)).resolves.toEqual(rejection);
    expect(httpClientMock.instrumentedFetch).toHaveBeenCalledOnce();
  });

  it('preserves other structured HTTP 400 rejections without treating them as unsafe', async () => {
    const rejection = { DocumentFileName: null, Error: { ErrorCode: '400', ErrorMessage: 'Missing mandatory field' } };
    httpClientMock.instrumentedFetch.mockResolvedValue(Response.json(rejection, { status: 400 }));

    await expect(repository.uploadDocument(uploadRequest)).resolves.toEqual(rejection);
  });

  it.each([
    ['invalid JSON', new Response('{', { status: 400 })],
    ['unstructured error', Response.json({ message: 'Bad request' }, { status: 400 })],
  ])('reports an invalid response for HTTP 400 with %s', async (_name, response) => {
    httpClientMock.instrumentedFetch.mockResolvedValue(response);

    await expect(repository.uploadDocument(uploadRequest)).rejects.toMatchObject({
      name: 'DocumentUploadException',
      kind: 'invalid-response',
      httpStatus: 400,
    } satisfies Partial<DocumentUploadException>);
  });

  it('classifies fetch rejection as a network failure', async () => {
    const cause = new Error('socket closed');
    httpClientMock.instrumentedFetch.mockRejectedValue(cause);

    await expect(repository.uploadDocument(uploadRequest)).rejects.toMatchObject({
      name: 'DocumentUploadException',
      kind: 'network',
      httpStatus: undefined,
      cause,
    } satisfies Partial<DocumentUploadException>);
  });

  it.each([302, 401, 403, 404, 429, 500, 502, 503, 504])('throws for HTTP %i even with a valid rejection payload', async (status) => {
    httpClientMock.instrumentedFetch.mockResolvedValue(Response.json({ DocumentFileName: null, Error: { ErrorCode: '400', ErrorMessage: 'File not safe' } }, { status }));

    await expect(repository.uploadDocument(uploadRequest)).rejects.toMatchObject({
      name: 'DocumentUploadException',
      kind: 'http',
      httpStatus: status,
    } satisfies Partial<DocumentUploadException>);
  });

  it('cancels the body of a non-success HTTP response before reporting the HTTP failure', async () => {
    const response = new Response('Upstream error details', { status: 503 });
    const cancel = vi.spyOn(expectDefined(response.body, 'Expected response body'), 'cancel');
    httpClientMock.instrumentedFetch.mockResolvedValue(response);

    await expect(repository.uploadDocument(uploadRequest)).rejects.toMatchObject({
      name: 'DocumentUploadException',
      kind: 'http',
      httpStatus: 503,
    } satisfies Partial<DocumentUploadException>);
    expect(cancel).toHaveBeenCalledExactlyOnceWith();
    expect(response.bodyUsed).toBe(true);
  });

  it('preserves the HTTP failure when response body cancellation fails', async () => {
    const response = new Response('Upstream error details', { status: 503 });
    const cancel = vi.spyOn(expectDefined(response.body, 'Expected response body'), 'cancel').mockRejectedValue(new Error('Cancellation failed'));
    httpClientMock.instrumentedFetch.mockResolvedValue(response);

    await expect(repository.uploadDocument(uploadRequest)).rejects.toMatchObject({
      name: 'DocumentUploadException',
      kind: 'http',
      httpStatus: 503,
    } satisfies Partial<DocumentUploadException>);
    expect(cancel).toHaveBeenCalledExactlyOnceWith();
  });

  it.each([
    ['invalid JSON', new Response('{', { status: 200, headers: { 'Content-Type': 'application/json' } })],
    ['invalid response schema', Response.json({ DocumentFileName: 'document.txt', Error: { ErrorCode: 'unexpected' } })],
  ])('classifies %s as an unknown upload outcome', async (_caseName, response) => {
    httpClientMock.instrumentedFetch.mockResolvedValue(response);

    await expect(repository.uploadDocument(uploadRequest)).rejects.toMatchObject({
      name: 'DocumentUploadException',
      kind: 'invalid-response',
      httpStatus: 200,
    } satisfies Partial<DocumentUploadException>);
  });

  it.each([
    ['empty response', new Response(null, { status: 204 })],
    ['empty filename', Response.json({ DocumentFileName: '', Error: null })],
    ['missing error', Response.json({ DocumentFileName: null })],
    ['incomplete rejection', Response.json({ DocumentFileName: null, Error: { ErrorCode: '400' } })],
    ['conflicting outcome', Response.json({ DocumentFileName: 'document.txt', Error: { ErrorCode: '400', ErrorMessage: 'File not safe' } })],
  ])('rejects an upload with %s', async (_name, response) => {
    httpClientMock.instrumentedFetch.mockResolvedValue(response);

    await expect(repository.uploadDocument(uploadRequest)).rejects.toMatchObject({
      name: 'DocumentUploadException',
      kind: 'invalid-response',
      httpStatus: response.status,
    } satisfies Partial<DocumentUploadException>);
  });

  it('posts only scan fields and credentials with the configured scan retry policy', async () => {
    httpClientMock.instrumentedFetch.mockResolvedValue(Response.json({ DataId: 'scan-123', Error: null }));

    await expect(repository.scanDocument(scanRequest)).resolves.toEqual({ DataId: 'scan-123', Error: null });
    expect(httpClientMock.instrumentedFetch).toHaveBeenCalledExactlyOnceWith('http.client.document-scan-api.scan.posts', 'https://interop.example.test/client-correspondence/document-upload/cct/v1/api/Scan', {
      proxyUrl: serverConfig.HTTP_PROXY_URL,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Ocp-Apim-Subscription-Key': serverConfig.INTEROP_API_SUBSCRIPTION_KEY,
      },
      body: JSON.stringify({
        ...scanRequest,
        username: serverConfig.EWDU_ENCAPSULATION_USERNAME,
        password: serverConfig.EWDU_ENCAPSULATION_PASSWORD,
        programActivityIdentificationID: serverConfig.EWDU_PROGRAM_ACTIVITY_ID,
      }),
      retryOptions: {
        retries: serverConfig.INTEROP_API_MAX_RETRIES,
        backoffMs: serverConfig.INTEROP_API_BACKOFF_MS,
        retryConditions: { 502: [], 503: [], 504: [] },
      },
    });
  });

  it.each([
    [201, { DocumentFileName: 'document.txt', Error: null }],
    [400, { DocumentFileName: 'document.txt', Error: null }],
  ])('returns a valid upload response for HTTP %i without business classification', async (status, response) => {
    httpClientMock.instrumentedFetch.mockResolvedValue(Response.json(response, { status }));

    await expect(repository.uploadDocument(uploadRequest)).resolves.toEqual(response);
  });

  it.each([
    ['success', { DataId: 'scan-123', Error: null }],
    ['rejection', { DataId: null, Error: { ErrorCode: '400', ErrorMessage: 'File not safe' } }],
  ])('returns a valid scan %s', async (_name, response) => {
    httpClientMock.instrumentedFetch.mockResolvedValue(Response.json(response));

    await expect(repository.scanDocument(scanRequest)).resolves.toEqual(response);
  });

  it.each([
    [400, { DataId: null, Error: { ErrorCode: '400', ErrorMessage: 'File not safe' } }],
    [400, { DataId: null, Error: { ErrorCode: '400', ErrorMessage: 'Missing mandatory field' } }],
    [400, { DataId: 'scan-123', Error: null }],
    [201, { DataId: 'scan-123', Error: null }],
  ])('returns a valid scan response for HTTP %i without business classification: %j', async (status, response) => {
    httpClientMock.instrumentedFetch.mockResolvedValue(Response.json(response, { status }));

    await expect(repository.scanDocument(scanRequest)).resolves.toEqual(response);
  });

  it.each([302, 401, 403, 404, 429, 500, 502, 503, 504])('throws for scan HTTP %i even with a valid rejection payload', async (status) => {
    httpClientMock.instrumentedFetch.mockResolvedValue(Response.json({ DataId: null, Error: { ErrorCode: '400', ErrorMessage: 'File not safe' } }, { status }));

    await expect(repository.scanDocument(scanRequest)).rejects.toThrow(`Failed to 'POST' for document scan. Status: ${status}`);
  });

  it.each([
    ['invalid JSON', new Response('{', { status: 400 })],
    ['invalid schema', Response.json({ message: 'Bad request' }, { status: 400 })],
  ])('throws for scan HTTP 400 with %s', async (_name, response) => {
    httpClientMock.instrumentedFetch.mockResolvedValue(response);

    await expect(repository.scanDocument(scanRequest)).rejects.toThrow();
  });

  it.each([{}, { DataId: '', Error: null }, { DataId: 'scan-123', Error: { ErrorCode: '400', ErrorMessage: 'File not safe' } }])('rejects malformed scan payloads instead of returning success: %j', async (response) => {
    httpClientMock.instrumentedFetch.mockResolvedValue(Response.json(response));

    await expect(repository.scanDocument(scanRequest)).rejects.toThrow();
  });

  it('propagates scan transport failures', async () => {
    const error = new Error('scan connection failed');
    httpClientMock.instrumentedFetch.mockRejectedValue(error);

    await expect(repository.scanDocument(scanRequest)).rejects.toBe(error);
    expect(httpClientMock.instrumentedFetch).toHaveBeenCalledOnce();
  });
});

describe('MockDocumentUploadRepository', () => {
  it('returns an upload error for mock-upload-failure.txt', async () => {
    const repository = new MockDocumentUploadRepository();

    await expect(repository.uploadDocument({ ...uploadRequest, filename: 'mock-upload-failure.txt' })).resolves.toEqual({
      DocumentFileName: null,
      Error: {
        ErrorCode: 'MOCK_UPLOAD_FAILURE',
        ErrorMessage: 'Mock document upload failed.',
      },
    });
  });

  it('returns success for other filenames', async () => {
    const repository = new MockDocumentUploadRepository();

    await expect(repository.uploadDocument(uploadRequest)).resolves.toEqual({
      DocumentFileName: 'document.txt',
      Error: null,
    });
  });

  it('returns an EICAR rejection during upload', async () => {
    const repository = new MockDocumentUploadRepository();
    const eicar = String.raw`X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*`;

    await expect(repository.uploadDocument({ ...uploadRequest, binary: Buffer.from(eicar).toString('base64') })).resolves.toEqual({
      DocumentFileName: null,
      Error: {
        ErrorCode: '400',
        ErrorMessage: 'File not safe',
      },
    });
  });

  it('returns an invalid-binary rejection during upload', async () => {
    const repository = new MockDocumentUploadRepository();

    await expect(repository.uploadDocument({ ...uploadRequest, binary: 'not valid base64!' })).resolves.toEqual({
      DocumentFileName: null,
      Error: {
        ErrorCode: 'INVALID_BINARY',
        ErrorMessage: 'Failed to decode binary content of the document.',
      },
    });
  });
});
