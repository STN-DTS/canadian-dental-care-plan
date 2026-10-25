import { Response } from 'undici';
import { beforeEach, describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';

import type { ServerConfig } from '~/.server/configs';
import type { DocumentUploadRequestEntity } from '~/.server/domain/entities';
import type { DocumentUploadException } from '~/.server/domain/exceptions/document-upload-exception';
import { DefaultDocumentUploadRepository, MockDocumentUploadRepository } from '~/.server/domain/repositories';
import type { HttpClient } from '~/.server/http';

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

  it('classifies fetch rejection as a network failure', async () => {
    httpClientMock.instrumentedFetch.mockRejectedValue(new Error('socket closed'));

    await expect(repository.uploadDocument(uploadRequest)).rejects.toMatchObject({
      name: 'DocumentUploadException',
      kind: 'network',
      httpStatus: undefined,
    } satisfies Partial<DocumentUploadException>);
  });

  it('classifies a non-success HTTP response with its status', async () => {
    httpClientMock.instrumentedFetch.mockResolvedValue(new Response(null, { status: 503 }));

    await expect(repository.uploadDocument(uploadRequest)).rejects.toMatchObject({
      name: 'DocumentUploadException',
      kind: 'http',
      httpStatus: 503,
    } satisfies Partial<DocumentUploadException>);
  });

  it.each([
    ['invalid JSON', new Response('{', { status: 200, headers: { 'Content-Type': 'application/json' } })],
    ['invalid response schema', Response.json({ DocumentFileName: 'document.txt', Error: { ErrorCode: 'unexpected' } })],
  ])('classifies $0 as an unknown upload outcome', async (_caseName, response) => {
    httpClientMock.instrumentedFetch.mockResolvedValue(response);

    await expect(repository.uploadDocument(uploadRequest)).rejects.toMatchObject({
      name: 'DocumentUploadException',
      kind: 'invalid-response',
      httpStatus: 200,
    } satisfies Partial<DocumentUploadException>);
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
        ErrorCode: 'EICAR_DETECTED',
        ErrorMessage: 'EICAR test content detected in the document.',
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
