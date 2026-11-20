import { Redacted } from 'effect';
import { Container } from 'inversify';
import { inspect } from 'node:util';
import { Response } from 'undici';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import type { AppIdentityClient } from '~/.server/auth/app-identity-client';
import type { ServerConfig } from '~/.server/configs';
import { TYPES } from '~/.server/constants';
import { createRepositoriesContainerModule } from '~/.server/container-modules/repositories-container-module';
import type { DocumentScanRequestEntity, DocumentUploadRequestEntity } from '~/.server/domain/entities';
import { DefaultDocumentUploadRepository, MockDocumentUploadRepository } from '~/.server/domain/repositories';
import type { DocumentUploadRepositoryConfig } from '~/.server/domain/repositories/configs/document-upload-repository-config-schema';
import { DocumentUploadRepositoryDefaultConfig } from '~/.server/domain/repositories/configs/document-upload-repository-default-config';
import type { HttpClient } from '~/.server/http';
import { DefaultHttpClient } from '~/.server/http/http-client';
import type { InstrumentationService } from '~/.server/observability';
import { AppError } from '~/errors/app-error';
import { ErrorCodes } from '~/errors/error-codes';
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
  INTEROP_DOCUMENT_UPLOAD_PROVIDER: 'default',
  HTTP_PROXY_URL: 'http://proxy.example.test',
  INTEROP_API_SUBSCRIPTION_KEY: Redacted.make('subscription-key'),
  INTEROP_API_BASE_URI: 'https://interop.example.test',
  INTEROP_DOCUMENT_UPLOAD_SPO_UPLOAD_DOCUMENT_PATHNAME: '/client-correspondence/document-upload/upload/v1/api/SPOUploadDocument',
  INTEROP_DOCUMENT_UPLOAD_SCAN_PATHNAME: '/client-correspondence/document-upload/upload/v1/api/Scan',
  EWDU_ENCAPSULATION_USERNAME: 'username',
  EWDU_ENCAPSULATION_PASSWORD: Redacted.make('password'),
  EWDU_PROGRAM_ACTIVITY_ID: 'activity-id',
  INTEROP_API_MAX_RETRIES: 3,
  INTEROP_API_BACKOFF_MS: 100,
  INTEROP_DOCUMENT_UPLOAD_OAUTH_ISSUER: 'https://identity.example.test/organization',
  INTEROP_DOCUMENT_UPLOAD_OAUTH_CLIENT_ID: Redacted.make('client-id'),
  INTEROP_DOCUMENT_UPLOAD_OAUTH_CLIENT_SECRET: Redacted.make(' secret +&= value '),
  INTEROP_DOCUMENT_UPLOAD_OAUTH_SCOPE: 'documents.write documents.scan',
} satisfies Pick<ServerConfig, 'HTTP_PROXY_URL' | 'INTEROP_API_SUBSCRIPTION_KEY' | 'INTEROP_API_BASE_URI' | 'INTEROP_API_MAX_RETRIES' | 'INTEROP_API_BACKOFF_MS'> & Extract<DocumentUploadRepositoryConfig, { INTEROP_DOCUMENT_UPLOAD_PROVIDER: 'default' }>;

describe('DefaultDocumentUploadRepository', () => {
  const httpClientMock = mock<HttpClient>();
  const appIdentityClient = mock<AppIdentityClient>();
  let repository: DefaultDocumentUploadRepository;

  beforeEach(() => {
    httpClientMock.instrumentedFetch.mockReset();
    appIdentityClient.getAccessToken.mockReset().mockResolvedValue(Redacted.make('access-token'));
    repository = new DefaultDocumentUploadRepository(new DocumentUploadRepositoryDefaultConfig(serverConfig), httpClientMock, appIdentityClient);
  });

  function createRepositoryWithHttpClient(retries: number) {
    const fetch = vi.fn();
    const httpClient = new DefaultHttpClient(mock<InstrumentationService>());
    vi.spyOn(httpClient, 'getFetchFn').mockReturnValue(fetch);

    const config = new DocumentUploadRepositoryDefaultConfig({ ...serverConfig, INTEROP_API_MAX_RETRIES: retries, INTEROP_API_BACKOFF_MS: 0 });
    return { fetch, repository: new DefaultDocumentUploadRepository(config, httpClient, appIdentityClient) };
  }

  it('posts once to SPOUploadDocument and returns an accepted response', async () => {
    httpClientMock.instrumentedFetch.mockResolvedValue(Response.json({ DocumentFileName: 'document.txt', Error: null }));

    await expect(repository.uploadDocument(uploadRequest)).resolves.toEqual({ DocumentFileName: 'document.txt', Error: null });
    expect(appIdentityClient.getAccessToken).toHaveBeenCalledExactlyOnceWith({
      issuer: new URL(serverConfig.INTEROP_DOCUMENT_UPLOAD_OAUTH_ISSUER),
      clientId: serverConfig.INTEROP_DOCUMENT_UPLOAD_OAUTH_CLIENT_ID,
      clientSecret: serverConfig.INTEROP_DOCUMENT_UPLOAD_OAUTH_CLIENT_SECRET,
      scope: serverConfig.INTEROP_DOCUMENT_UPLOAD_OAUTH_SCOPE,
    });
    const identityRequest = expectDefined(appIdentityClient.getAccessToken.mock.calls[0]?.[0], 'Expected identity request');
    expect(Redacted.isRedacted(identityRequest.clientId)).toBe(true);
    expect(Redacted.isRedacted(identityRequest.clientSecret)).toBe(true);
    expect(Redacted.value(identityRequest.clientId)).toBe('client-id');
    expect(Redacted.value(identityRequest.clientSecret)).toBe(' secret +&= value ');
    expect(JSON.stringify(identityRequest)).not.toContain('client-id');
    expect(JSON.stringify(identityRequest)).not.toContain('secret +&= value');
    expect(httpClientMock.instrumentedFetch).toHaveBeenCalledExactlyOnceWith('http.client.document-scan-api.spo-upload-document.posts', 'https://interop.example.test/client-correspondence/document-upload/upload/v1/api/SPOUploadDocument', {
      proxyUrl: new URL(serverConfig.HTTP_PROXY_URL).href,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Ocp-Apim-Subscription-Key': 'subscription-key',
        Authorization: 'Bearer access-token',
      },
      body: JSON.stringify({
        ...uploadRequest,
        username: serverConfig.EWDU_ENCAPSULATION_USERNAME,
        password: 'password',
        programActivityIdentificationID: serverConfig.EWDU_PROGRAM_ACTIVITY_ID,
      }),
      retryOptions: { retries: 0, retryConditions: {} },
      expectedStatuses: [400],
    });
  });

  it('uses the document upload endpoint and subscription key overrides', async () => {
    const config = new DocumentUploadRepositoryDefaultConfig({
      ...serverConfig,
      INTEROP_DOCUMENT_UPLOAD_BASE_URI: 'https://upload.example.test/root/',
      INTEROP_DOCUMENT_UPLOAD_SUBSCRIPTION_KEY: Redacted.make('upload-key'),
    });
    const overridden = new DefaultDocumentUploadRepository(config, httpClientMock, appIdentityClient);
    httpClientMock.instrumentedFetch.mockResolvedValue(Response.json({ DocumentFileName: 'document.txt', Error: null }));

    await overridden.uploadDocument(uploadRequest);

    expect(httpClientMock.instrumentedFetch).toHaveBeenCalledWith(
      expect.any(String),
      'https://upload.example.test/root/client-correspondence/document-upload/upload/v1/api/SPOUploadDocument',
      expect.objectContaining({ headers: expect.objectContaining({ 'Ocp-Apim-Subscription-Key': 'upload-key' }) }),
    );
  });

  it('uses configured upload and scan pathnames', async () => {
    const config = new DocumentUploadRepositoryDefaultConfig({
      ...serverConfig,
      INTEROP_DOCUMENT_UPLOAD_BASE_URI: 'https://upload.example.test/root/',
      INTEROP_DOCUMENT_UPLOAD_SPO_UPLOAD_DOCUMENT_PATHNAME: '/relocated/v2/SPOUploadDocument',
      INTEROP_DOCUMENT_UPLOAD_SCAN_PATHNAME: '/relocated/v2/Scan',
    });
    const overridden = new DefaultDocumentUploadRepository(config, httpClientMock, appIdentityClient);
    httpClientMock.instrumentedFetch.mockResolvedValueOnce(Response.json({ DocumentFileName: 'document.txt', Error: null }));
    httpClientMock.instrumentedFetch.mockResolvedValueOnce(Response.json({ DataId: 'health-scan', Error: null }));

    await overridden.uploadDocument(uploadRequest);
    await overridden.checkHealth();

    expect(httpClientMock.instrumentedFetch.mock.calls.map(([, url]) => url)).toEqual(['https://upload.example.test/root/relocated/v2/SPOUploadDocument', 'https://upload.example.test/root/relocated/v2/Scan']);
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
    ['identity', 'Document upload failed during authentication or request.'],
    ['transport', 'Document upload failed during authentication or request.'],
    ['HTTP', 'Document upload failed with HTTP 404.'],
    ['invalid response', 'Document upload returned an invalid response (HTTP 200).'],
  ] as const)('reports the upload-specific error code and message for a %s failure', async (failure, message) => {
    if (failure === 'identity') {
      appIdentityClient.getAccessToken.mockRejectedValue(new AppError('Identity failed', ErrorCodes.AUTH_OIDC_APP_IDENTITY_FETCH_FAILED));
    } else if (failure === 'transport') {
      httpClientMock.instrumentedFetch.mockRejectedValue(new Error('Transport failed'));
    } else {
      httpClientMock.instrumentedFetch.mockResolvedValue(failure === 'HTTP' ? new Response(null, { status: 404 }) : Response.json({ unexpected: true }));
    }

    await expect(repository.uploadDocument(uploadRequest)).rejects.toMatchObject({ errorCode: ErrorCodes.API_DOC_UPLOAD_FAILED, message });
    expect(httpClientMock.instrumentedFetch).toHaveBeenCalledTimes(failure === 'identity' ? 0 : 1);
  });

  it.each([
    ['invalid JSON', new Response('{', { status: 400 })],
    ['unstructured error', Response.json({ message: 'Bad request' }, { status: 400 })],
  ])('reports an invalid response for HTTP 400 with %s', async (_name, response) => {
    httpClientMock.instrumentedFetch.mockResolvedValue(response);

    await expect(repository.uploadDocument(uploadRequest)).rejects.toMatchObject({
      name: 'AppError',
      errorCode: ErrorCodes.API_DOC_UPLOAD_FAILED,
      message: 'Document upload returned an invalid response (HTTP 400).',
      httpStatusCode: 400,
    });
  });

  it('classifies fetch rejection without exposing transport details', async () => {
    const cause = new Error('synthetic-bearer-canary');
    httpClientMock.instrumentedFetch.mockRejectedValue(cause);

    const error = await repository.uploadDocument(uploadRequest).catch((cause: unknown) => cause);

    expect(inspect(error)).not.toContain('synthetic-bearer-canary');
    expect(error).toMatchObject({ name: 'AppError', errorCode: ErrorCodes.API_DOC_UPLOAD_FAILED });
    expect(error).toHaveProperty('cause', undefined);
  });

  it.each([302, 401, 403, 404, 429, 500, 502, 503, 504])('throws for HTTP %i even with a valid rejection payload', async (status) => {
    httpClientMock.instrumentedFetch.mockResolvedValue(Response.json({ DocumentFileName: null, Error: { ErrorCode: '400', ErrorMessage: 'File not safe' } }, { status }));

    await expect(repository.uploadDocument(uploadRequest)).rejects.toMatchObject({
      name: 'AppError',
      errorCode: ErrorCodes.API_DOC_UPLOAD_FAILED,
      httpStatusCode: status,
      message: `Document upload failed with HTTP ${status}.`,
    });
  });

  it('cancels the body of a non-success HTTP response before reporting the HTTP failure', async () => {
    const response = new Response('Upstream error details', { status: 503 });
    const cancel = vi.spyOn(expectDefined(response.body, 'Expected response body'), 'cancel');
    httpClientMock.instrumentedFetch.mockResolvedValue(response);

    await expect(repository.uploadDocument(uploadRequest)).rejects.toMatchObject({
      name: 'AppError',
      errorCode: ErrorCodes.API_DOC_UPLOAD_FAILED,
      httpStatusCode: 503,
    });
    expect(cancel).toHaveBeenCalledExactlyOnceWith();
    expect(response.bodyUsed).toBe(true);
  });

  it('preserves the HTTP failure when response body cancellation fails', async () => {
    const response = new Response('Upstream error details', { status: 503 });
    const cancel = vi.spyOn(expectDefined(response.body, 'Expected response body'), 'cancel').mockRejectedValue(new Error('Cancellation failed'));
    httpClientMock.instrumentedFetch.mockResolvedValue(response);

    await expect(repository.uploadDocument(uploadRequest)).rejects.toMatchObject({
      name: 'AppError',
      errorCode: ErrorCodes.API_DOC_UPLOAD_FAILED,
      httpStatusCode: 503,
    });
    expect(cancel).toHaveBeenCalledExactlyOnceWith();
  });

  it.each([
    ['invalid JSON', new Response('{', { status: 200, headers: { 'Content-Type': 'application/json' } })],
    ['invalid response schema', Response.json({ DocumentFileName: 'document.txt', Error: { ErrorCode: 'unexpected' } })],
  ])('classifies %s as an unknown upload outcome', async (_caseName, response) => {
    httpClientMock.instrumentedFetch.mockResolvedValue(response);

    await expect(repository.uploadDocument(uploadRequest)).rejects.toMatchObject({
      name: 'AppError',
      errorCode: ErrorCodes.API_DOC_UPLOAD_FAILED,
      message: 'Document upload returned an invalid response (HTTP 200).',
      httpStatusCode: 200,
    });
  });

  it('does not retain an invalid upload response in the failure cause', async () => {
    httpClientMock.instrumentedFetch.mockResolvedValue(new Response('["abc","TOKEN",!]'));

    const error = await repository.uploadDocument(uploadRequest).catch((cause: unknown) => cause);

    expect(inspect(error)).not.toContain('TOKEN');
    expect(error).toMatchObject({ name: 'AppError', errorCode: ErrorCodes.API_DOC_UPLOAD_FAILED });
    expect(error).toHaveProperty('cause', undefined);
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
      name: 'AppError',
      errorCode: ErrorCodes.API_DOC_UPLOAD_FAILED,
      message: `Document upload returned an invalid response (HTTP ${response.status}).`,
      httpStatusCode: response.status,
    });
  });

  it('posts only scan fields and credentials with the configured retry policy', async () => {
    httpClientMock.instrumentedFetch.mockResolvedValue(Response.json({ DataId: 'scan-123', Error: null }));

    await expect(repository.scanDocument(scanRequest)).resolves.toEqual({ DataId: 'scan-123', Error: null });
    expect(appIdentityClient.getAccessToken).toHaveBeenCalledExactlyOnceWith({
      issuer: new URL(serverConfig.INTEROP_DOCUMENT_UPLOAD_OAUTH_ISSUER),
      clientId: serverConfig.INTEROP_DOCUMENT_UPLOAD_OAUTH_CLIENT_ID,
      clientSecret: serverConfig.INTEROP_DOCUMENT_UPLOAD_OAUTH_CLIENT_SECRET,
      scope: serverConfig.INTEROP_DOCUMENT_UPLOAD_OAUTH_SCOPE,
    });
    expect(httpClientMock.instrumentedFetch).toHaveBeenCalledExactlyOnceWith('http.client.document-scan-api.scan.posts', 'https://interop.example.test/client-correspondence/document-upload/upload/v1/api/Scan', {
      proxyUrl: new URL(serverConfig.HTTP_PROXY_URL).href,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Ocp-Apim-Subscription-Key': 'subscription-key',
        Authorization: 'Bearer access-token',
      },
      body: JSON.stringify({
        ...scanRequest,
        username: serverConfig.EWDU_ENCAPSULATION_USERNAME,
        password: 'password',
        programActivityIdentificationID: serverConfig.EWDU_PROGRAM_ACTIVITY_ID,
      }),
      retryOptions: {
        retries: serverConfig.INTEROP_API_MAX_RETRIES,
        backoffMs: serverConfig.INTEROP_API_BACKOFF_MS,
        retryConditions: { 502: [], 503: [], 504: [] },
      },
      expectedStatuses: [400],
    });
  });

  it.each(['HTTP error', 'network error'] as const)('does not retry an upload POST after %s', async (failure) => {
    const { fetch, repository: realHttpRepository } = createRepositoryWithHttpClient(2);

    if (failure === 'HTTP error') {
      fetch.mockResolvedValue(new Response(null, { status: 503 }));
    } else {
      fetch.mockRejectedValue(new Error('Network failure'));
    }

    await expect(realHttpRepository.uploadDocument(uploadRequest)).rejects.toThrow();
    expect(fetch).toHaveBeenCalledOnce();
  });

  it.each([502, 503, 504])('retries a scan after HTTP %i', async (status) => {
    const { fetch, repository: realHttpRepository } = createRepositoryWithHttpClient(1);
    fetch.mockResolvedValueOnce(new Response(null, { status })).mockResolvedValueOnce(Response.json({ DataId: 'scan-123', Error: null }));

    await expect(realHttpRepository.scanDocument(scanRequest)).resolves.toEqual({ DataId: 'scan-123', Error: null });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('retries a scan after a network error', async () => {
    const { fetch, repository: realHttpRepository } = createRepositoryWithHttpClient(1);
    fetch.mockRejectedValueOnce(new Error('Network failure')).mockResolvedValueOnce(Response.json({ DataId: 'scan-123', Error: null }));

    await expect(realHttpRepository.scanDocument(scanRequest)).resolves.toEqual({ DataId: 'scan-123', Error: null });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it.each([0, 2])('limits scan retries to the configured count of %i', async (retries) => {
    const { fetch, repository: realHttpRepository } = createRepositoryWithHttpClient(retries);
    fetch.mockResolvedValue(new Response(null, { status: 503 }));

    await expect(realHttpRepository.scanDocument(scanRequest)).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(retries + 1);
  });

  it('does not retry a scan for an unconfigured HTTP status', async () => {
    const { fetch, repository: realHttpRepository } = createRepositoryWithHttpClient(2);
    fetch.mockResolvedValue(new Response(null, { status: 500 }));

    await expect(realHttpRepository.scanDocument(scanRequest)).rejects.toMatchObject({ errorCode: ErrorCodes.API_DOC_SCAN_FAILED });
    expect(fetch).toHaveBeenCalledOnce();
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

    await expect(repository.scanDocument(scanRequest)).rejects.toMatchObject({
      errorCode: ErrorCodes.API_DOC_SCAN_FAILED,
      message: 'Scan call failed, preserving scan catch.',
    });
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

  it('retains the scan transport error as the failure cause', async () => {
    const cause = new Error('Synthetic transport failure');
    httpClientMock.instrumentedFetch.mockRejectedValue(cause);

    const error = await repository.scanDocument(scanRequest).catch((cause: unknown) => cause);

    expect(error).toMatchObject({
      name: 'AppError',
      errorCode: ErrorCodes.API_DOC_SCAN_FAILED,
      message: 'Scan call failed, preserving scan catch.',
      cause,
    });
    expect(error).toBeInstanceOf(AppError);
    expect(error).toHaveProperty('cause', cause);
    expect(httpClientMock.instrumentedFetch).toHaveBeenCalledOnce();
  });

  it('wraps scan identity failures with the scan error code and original cause', async () => {
    const cause = new AppError('Identity request failed.', ErrorCodes.AUTH_OIDC_APP_IDENTITY_FETCH_FAILED);
    appIdentityClient.getAccessToken.mockRejectedValue(cause);

    const error = await repository.scanDocument(scanRequest).catch((error: unknown) => error);

    expect(error).toMatchObject({
      name: 'AppError',
      errorCode: ErrorCodes.API_DOC_SCAN_FAILED,
      message: 'App identity token acquisition failed.',
      cause,
    });
    expect(error).toHaveProperty('cause', cause);
    expect(httpClientMock.instrumentedFetch).not.toHaveBeenCalled();
  });

  it('authenticates health checks through scan', async () => {
    httpClientMock.instrumentedFetch.mockResolvedValue(Response.json({ DataId: 'health-scan', Error: null }));

    await repository.checkHealth();

    expect(httpClientMock.instrumentedFetch).toHaveBeenCalledExactlyOnceWith(
      'http.client.document-scan-api.scan.posts',
      expect.stringContaining('/Scan'),
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer access-token' }) }),
    );
  });

  it('wraps token failures as per-file technical errors without sending an upload', async () => {
    appIdentityClient.getAccessToken.mockRejectedValue(new AppError('synthetic-sensitive-error', ErrorCodes.AUTH_OIDC_APP_IDENTITY_FETCH_FAILED));

    const error = await repository.uploadDocument(uploadRequest).catch((cause: unknown) => cause);

    expect(error).toMatchObject({
      name: 'AppError',
      errorCode: ErrorCodes.API_DOC_UPLOAD_FAILED,
      message: 'Document upload failed during authentication or request.',
    });
    expect(inspect(error)).not.toContain('synthetic-sensitive-error');
    expect(error).toHaveProperty('cause', undefined);
    expect(httpClientMock.instrumentedFetch).not.toHaveBeenCalled();
  });

  it('does not send scans or health checks when a token is unavailable', async () => {
    appIdentityClient.getAccessToken.mockRejectedValue(new Error('App identity token acquisition failed.'));

    await expect(repository.scanDocument(scanRequest)).rejects.toThrow('App identity');
    await expect(repository.checkHealth()).rejects.toThrow('App identity');
    expect(httpClientMock.instrumentedFetch).not.toHaveBeenCalled();
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

describe('document upload repository bindings', () => {
  it('reports a mismatched provider with an application error code', () => {
    expect(() => new DocumentUploadRepositoryDefaultConfig({ ...serverConfig, INTEROP_DOCUMENT_UPLOAD_PROVIDER: 'mock' })).toThrow(expect.objectContaining({ name: 'AppError', errorCode: ErrorCodes.PLT_CONFIG_DOCUMENT_UPLOAD_PROVIDER_INVALID }));
  });

  it('resolves the default repository with its configuration', () => {
    const container = new Container();
    container.load(createRepositoriesContainerModule({ ENABLED_MOCKS: [], INTEROP_DOCUMENT_UPLOAD_PROVIDER: 'default' }));
    container.bind(TYPES.ServerConfig).toConstantValue(
      mock<ServerConfig>({
        ...serverConfig,
        ENABLED_MOCKS: [],
        INTEROP_DOCUMENT_UPLOAD_BASE_URI: serverConfig.INTEROP_API_BASE_URI,
        INTEROP_DOCUMENT_UPLOAD_SUBSCRIPTION_KEY: serverConfig.INTEROP_API_SUBSCRIPTION_KEY,
      }),
    );
    container.bind(TYPES.HttpClient).toConstantValue(mock<HttpClient>());
    container.bind(TYPES.AppIdentityClient).toConstantValue(mock<AppIdentityClient>());

    expect(container.get(TYPES.DocumentUploadRepository)).toBeInstanceOf(DefaultDocumentUploadRepository);
    expect(container.get(TYPES.DocumentUploadRepository).getMetadata()).toEqual({
      scanUrl: 'https://interop.example.test/client-correspondence/document-upload/upload/v1/api/Scan',
      spoUploadDocumentUrl: 'https://interop.example.test/client-correspondence/document-upload/upload/v1/api/SPOUploadDocument',
    });
  });

  it('resolves the mock without default repository credentials', () => {
    const container = new Container();
    container.load(createRepositoriesContainerModule({ ENABLED_MOCKS: [], INTEROP_DOCUMENT_UPLOAD_PROVIDER: 'mock' }));

    expect(container.get(TYPES.DocumentUploadRepository)).toBeInstanceOf(MockDocumentUploadRepository);
  });
});
