import { Redacted, Result } from 'effect';
import { inject, injectable } from 'inversify';
import type { CustomFetch } from 'openid-client';

import type { AppIdentityClient, GetAccessTokenRequest } from '~/.server/auth/app-identity-client';
import { getCachedAccessToken } from '~/.server/auth/app-identity-token-cache';
import { TYPES } from '~/.server/constants';
import type { HttpClient } from '~/.server/http';
import { Traced } from '~/.server/observability/decorator';
import { throwAppError } from '~/.server/utils/error-utils';
import { validateOAuthIssuer } from '~/.server/utils/url-utils';
import { ErrorCodes } from '~/errors/error-codes';

/**
 * Rejects requests that could send credentials to an unsafe or unintended place: an invalid issuer
 * (see `validateOAuthIssuer`) or blank credentials and scope.
 *
 * @throws An application error with `AUTH_OIDC_APP_IDENTITY_INVALID_REQUEST` when the request is invalid.
 */
function assertValidRequest({ issuer, clientId, clientSecret, scope }: GetAccessTokenRequest): void {
  const isInvalid = Result.isFailure(validateOAuthIssuer(issuer.href)) || !Redacted.value(clientId).trim() || !Redacted.value(clientSecret).trim() || !scope.trim();

  if (isInvalid) {
    throwAppError('App identity arguments are invalid.', ErrorCodes.AUTH_OIDC_APP_IDENTITY_INVALID_REQUEST);
  }
}

/** Issues OAuth client-credentials access tokens for the app identity. Caching is handled by {@link getCachedAccessToken}. */
@injectable()
export class OpenIdAppIdentityClient implements AppIdentityClient {
  private readonly httpClient: HttpClient;

  constructor(@inject(TYPES.HttpClient) httpClient: HttpClient) {
    this.httpClient = httpClient;
  }

  /**
   * Returns a bearer token for the given identity, from cache whenever possible.
   *
   * @throws An application error if the request is invalid, the token cannot be acquired, or it has expired.
   */
  @Traced()
  async getAccessToken(request: GetAccessTokenRequest): Promise<Redacted.Redacted<string>> {
    assertValidRequest(request);

    return await getCachedAccessToken(request, this.fetch);
  }

  /**
   * `fetch` handed to openid-client so discovery and token requests go through the instrumented HTTP client.
   * Redirects are refused and retries are disabled so credentials are only sent once, to the intended endpoint.
   */
  private readonly fetch: CustomFetch = async (url, options) => {
    const response = await this.httpClient.instrumentedFetch(`http.client.app-identity.${options.method === 'GET' ? 'discovery.gets' : 'token.posts'}`, url, {
      ...options,
      redirect: 'error',
      retryOptions: { retries: 0, retryConditions: {} },
    });

    return new globalThis.Response(await response.arrayBuffer(), { status: response.status, statusText: response.statusText, headers: [...response.headers] });
  };
}
