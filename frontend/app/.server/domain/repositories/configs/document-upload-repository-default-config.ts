import type { Redacted } from 'effect/Redacted';
import { inject, injectable } from 'inversify';

import type { ServerConfig } from '~/.server/configs';
import { TYPES } from '~/.server/constants/types-constant';
import type { DocumentUploadRepositoryConfig } from '~/.server/domain/repositories/configs/document-upload-repository-config-schema';
import { throwAppError } from '~/.server/utils/error-utils';
import { ErrorCodes } from '~/errors/error-codes';

type DocumentUploadRepositoryDefaultConfig_ServerConfig = Pick<ServerConfig, 'INTEROP_API_BASE_URI' | 'INTEROP_API_SUBSCRIPTION_KEY' | 'HTTP_PROXY_URL' | 'INTEROP_API_MAX_RETRIES' | 'INTEROP_API_BACKOFF_MS'> & DocumentUploadRepositoryConfig;

@injectable()
export class DocumentUploadRepositoryDefaultConfig {
  constructor(@inject(TYPES.ServerConfig) serverConfig: DocumentUploadRepositoryDefaultConfig_ServerConfig) {
    if (this.provider !== serverConfig.INTEROP_DOCUMENT_UPLOAD_PROVIDER) {
      throwAppError('Document upload repository requires the default provider.', ErrorCodes.PLT_CONFIG_DOCUMENT_UPLOAD_PROVIDER_INVALID);
    }

    this.baseUri = new URL(serverConfig.INTEROP_DOCUMENT_UPLOAD_BASE_URI ?? serverConfig.INTEROP_API_BASE_URI);
    this.ewduEncapsulationPassword = serverConfig.EWDU_ENCAPSULATION_PASSWORD;
    this.ewduEncapsulationUsername = serverConfig.EWDU_ENCAPSULATION_USERNAME;
    this.ewduProgramActivityId = serverConfig.EWDU_PROGRAM_ACTIVITY_ID;
    this.httpProxyUrl = serverConfig.HTTP_PROXY_URL ? new URL(serverConfig.HTTP_PROXY_URL) : undefined;
    this.oauthClientId = serverConfig.INTEROP_DOCUMENT_UPLOAD_OAUTH_CLIENT_ID;
    this.oauthClientSecret = serverConfig.INTEROP_DOCUMENT_UPLOAD_OAUTH_CLIENT_SECRET;
    this.oauthIssuer = new URL(serverConfig.INTEROP_DOCUMENT_UPLOAD_OAUTH_ISSUER);
    this.oauthScope = serverConfig.INTEROP_DOCUMENT_UPLOAD_OAUTH_SCOPE;
    this.scanRetryCount = serverConfig.INTEROP_API_MAX_RETRIES;
    this.scanRetryBackoffMs = serverConfig.INTEROP_API_BACKOFF_MS;
    this.subscriptionKey = serverConfig.INTEROP_DOCUMENT_UPLOAD_SUBSCRIPTION_KEY ?? serverConfig.INTEROP_API_SUBSCRIPTION_KEY;
  }

  readonly provider = 'default';

  readonly baseUri: URL;
  readonly ewduEncapsulationPassword: Redacted<string>;
  readonly ewduEncapsulationUsername: string;
  readonly ewduProgramActivityId: string;
  readonly httpProxyUrl?: URL;
  readonly oauthClientId: Redacted<string>;
  readonly oauthClientSecret: Redacted<string>;
  readonly oauthIssuer: URL;
  readonly oauthScope: string;
  readonly scanRetryCount: number;
  readonly scanRetryBackoffMs: number;
  readonly subscriptionKey: Redacted<string>;
}
