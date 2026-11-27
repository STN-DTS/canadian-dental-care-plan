import type { Redacted } from 'effect';
import { inject, injectable } from 'inversify';

import type { AuthProviderConfig } from '~/.server/auth/auth-provider-config-schema';
import type { ServerConfig } from '~/.server/configs';
import { TYPES } from '~/.server/constants/types-constant';
import { throwAppError } from '~/.server/utils/error-utils';
import { ErrorCodes } from '~/errors/error-codes';

type OpenIdServiceConfig_ServerConfig = Pick<ServerConfig, 'HTTP_PROXY_URL'> & AuthProviderConfig;

/**
 * Settings for the iSAMS OIDC connectivity proof, read from the validated server config.
 */
@injectable()
export class OpenIdServiceConfig {
  constructor(@inject(TYPES.ServerConfig) serverConfig: OpenIdServiceConfig_ServerConfig) {
    if (serverConfig.AUTH_PROVIDER !== 'oidc') {
      throwAppError('OpenID service requires the oidc auth provider.', ErrorCodes.PLT_CONFIG_AUTH_PROVIDER_INVALID);
    }

    this.clientAssertionAudience = serverConfig.AUTH_OIDC_CLIENT_ASSERTION_AUDIENCE;
    this.clientId = serverConfig.AUTH_OIDC_CLIENT_ID;
    this.httpProxyUrl = serverConfig.HTTP_PROXY_URL;
    this.issuer = new URL(serverConfig.AUTH_OIDC_ISSUER_URL);
    this.privateKey = serverConfig.AUTH_OIDC_PRIVATE_KEY;
    this.privateKeyId = serverConfig.AUTH_OIDC_PRIVATE_KEY_ID;
    this.redirectUri = new URL(serverConfig.AUTH_OIDC_REDIRECT_URI);
  }

  readonly clientAssertionAudience: 'token-endpoint' | 'issuer';
  readonly clientId: string;
  readonly httpProxyUrl?: string;
  readonly issuer: URL;
  readonly privateKey: Redacted.Redacted<string>;
  readonly privateKeyId: string;
  readonly redirectUri: URL;
}
