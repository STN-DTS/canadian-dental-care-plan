import { Redacted } from 'effect';
import { inject, injectable } from 'inversify';
import type { Response } from 'undici';
import * as z from 'zod';

import type { AppIdentityClient, GetAccessTokenRequest } from '~/.server/auth/app-identity-client';
import { TYPES } from '~/.server/constants';
import type { DocumentScanRequestEntity, DocumentScanResponseEntity, DocumentUploadRequestEntity, DocumentUploadResponseEntity } from '~/.server/domain/entities';
import type { DocumentUploadRepositoryDefaultConfig } from '~/.server/domain/repositories/configs/document-upload-repository-default-config';
import type { DocumentUploadRepository } from '~/.server/domain/repositories/document-upload-repository';
import type { HttpClient } from '~/.server/http';
import type { Logger } from '~/.server/logging';
import { createLogger } from '~/.server/logging';
import { Traced } from '~/.server/observability/decorator';
import { throwAppError } from '~/.server/utils/error-utils';
import { HttpStatusCodes } from '~/constants/http-status-codes';
import { ErrorCodes } from '~/errors/error-codes';

const errorSchema = z.object({ ErrorCode: z.string(), ErrorMessage: z.string() });
const uploadResponseSchema = z.union([z.object({ DocumentFileName: z.string().nonempty(), Error: z.null() }), z.object({ DocumentFileName: z.null(), Error: errorSchema })]);
const scanResponseSchema = z.union([z.object({ DataId: z.string().nonempty(), Error: z.null() }), z.object({ DataId: z.null(), Error: errorSchema })]);

@injectable()
export class DefaultDocumentUploadRepository implements DocumentUploadRepository {
  private readonly log: Logger;
  private readonly config: DocumentUploadRepositoryDefaultConfig;
  private readonly httpClient: HttpClient;
  private readonly appIdentityClient: AppIdentityClient;
  private readonly baseUrl: string;

  constructor(@inject(TYPES.DocumentUploadRepositoryDefaultConfig) config: DocumentUploadRepositoryDefaultConfig, @inject(TYPES.HttpClient) httpClient: HttpClient, @inject(TYPES.AppIdentityClient) appIdentityClient: AppIdentityClient) {
    this.log = createLogger('DefaultDocumentUploadRepository');
    this.config = config;
    this.httpClient = httpClient;
    this.appIdentityClient = appIdentityClient;
    this.baseUrl = `${this.config.baseUri.href.replace(/\/+$/, '')}/client-correspondence/document-upload/cct/v1/api`;
  }

  private getAccessTokenRequest(): GetAccessTokenRequest {
    return {
      issuer: this.config.oauthIssuer,
      clientId: this.config.oauthClientId,
      clientSecret: this.config.oauthClientSecret,
      scope: this.config.oauthScope,
    };
  }

  private addCredentialsToRequestBody<T extends object>(requestBody: T): T & { username: string; password?: string; programActivityIdentificationID: string } {
    return {
      ...requestBody,
      username: this.config.ewduEncapsulationUsername,
      password: Redacted.value(this.config.ewduEncapsulationPassword),
      programActivityIdentificationID: this.config.ewduProgramActivityId,
    };
  }

  @Traced()
  async uploadDocument(documentUploadRequestEntity: DocumentUploadRequestEntity): Promise<DocumentUploadResponseEntity> {
    this.log.trace('Uploading document');

    const url = `${this.baseUrl}/SPOUploadDocument`;

    const requestBody = this.addCredentialsToRequestBody(documentUploadRequestEntity);

    let response: Response;

    try {
      const token = await this.appIdentityClient.getAccessToken(this.getAccessTokenRequest());
      response = await this.httpClient.instrumentedFetch('http.client.document-scan-api.spo-upload-document.posts', url, {
        proxyUrl: this.config.httpProxyUrl?.href,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Ocp-Apim-Subscription-Key': Redacted.value(this.config.subscriptionKey),
          Authorization: `Bearer ${Redacted.value(token)}`,
        },
        body: JSON.stringify(requestBody),
        // A retry can save the same file twice if the first response was lost.
        // Keep HTTP responses available for classification instead of retrying them.
        retryOptions: { retries: 0, retryConditions: {} },
      });
    } catch {
      throwAppError('Document upload failed during authentication or request.', ErrorCodes.API_DOC_UPLOAD_FAILED);
    }

    if (!response.ok && response.status !== HttpStatusCodes.BAD_REQUEST) {
      await response.body?.cancel().catch(() => {
        // Preserve the original HTTP failure if cleanup fails.
      });

      throw throwAppError(`Document upload failed with HTTP ${response.status}.`, ErrorCodes.API_DOC_UPLOAD_FAILED, { meta: { httpStatusCode: response.status } });
    }

    try {
      return uploadResponseSchema.parse(await response.json());
    } catch {
      throwAppError(`Document upload returned an invalid response (HTTP ${response.status}).`, ErrorCodes.API_DOC_UPLOAD_FAILED, { meta: { httpStatusCode: response.status } });
    }
  }

  @Traced()
  async scanDocument(scanDocumentRequestEntity: DocumentScanRequestEntity): Promise<DocumentScanResponseEntity> {
    this.log.trace('Scanning document');

    const url = `${this.baseUrl}/Scan`;
    let token: Redacted.Redacted<string>;

    try {
      token = await this.appIdentityClient.getAccessToken(this.getAccessTokenRequest());
    } catch (cause) {
      throwAppError('App identity token acquisition failed.', ErrorCodes.API_DOC_SCAN_FAILED, { cause });
    }

    try {
      const response = await this.httpClient.instrumentedFetch('http.client.document-scan-api.scan.posts', url, {
        proxyUrl: this.config.httpProxyUrl?.href,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Ocp-Apim-Subscription-Key': Redacted.value(this.config.subscriptionKey),
          Authorization: `Bearer ${Redacted.value(token)}`,
        },
        body: JSON.stringify(this.addCredentialsToRequestBody(scanDocumentRequestEntity)),
        retryOptions: {
          retries: this.config.scanRetryCount,
          backoffMs: this.config.scanRetryBackoffMs,
          retryConditions: {
            [HttpStatusCodes.BAD_GATEWAY]: [],
            [HttpStatusCodes.SERVICE_UNAVAILABLE]: [],
            [HttpStatusCodes.GATEWAY_TIMEOUT]: [],
          },
        },
      });

      if (!response.ok && response.status !== HttpStatusCodes.BAD_REQUEST) {
        await response.text();

        throwAppError('Scan call failed, preserving scan catch.', ErrorCodes.API_DOC_SCAN_FAILED, { meta: { httpStatusCode: response.status } });
      }

      return scanResponseSchema.parse(await response.json());
    } catch (cause) {
      throwAppError('Scan call failed, preserving scan catch.', ErrorCodes.API_DOC_SCAN_FAILED, { cause });
    }
  }

  getMetadata(): Record<string, string> {
    return {
      baseUrl: this.baseUrl,
    };
  }

  async checkHealth(): Promise<void> {
    await this.scanDocument({ filename: '', binary: '' });
  }
}
