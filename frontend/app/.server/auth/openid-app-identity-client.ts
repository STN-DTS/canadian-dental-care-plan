import { Cache, Effect, Equal, Exit, Hash, Redacted, Result } from 'effect';
import { inject, injectable } from 'inversify';
import { ClientSecretPost, clientCredentialsGrant, customFetch, discovery } from 'openid-client';
import type { Configuration, CustomFetch } from 'openid-client';

import type { AppIdentityClient, GetAccessTokenRequest } from '~/.server/auth/app-identity-client';
import { TYPES } from '~/.server/constants';
import type { HttpClient } from '~/.server/http';
import { Traced } from '~/.server/observability/decorator';
import { throwAppError } from '~/.server/utils/error-utils';
import { AppError } from '~/errors/app-error';
import { ErrorCodes } from '~/errors/error-codes';

interface AccessToken {
  readonly value: Redacted.Redacted<string>;
  readonly expiresAt: number;
}

class IdentityKey implements Equal.Equal {
  readonly issuer: string;
  readonly clientId: Redacted.Redacted<string>;
  readonly clientSecret: Redacted.Redacted<string>;
  readonly scope: string;

  constructor(args: GetAccessTokenRequest) {
    this.issuer = args.issuer.href;
    this.clientId = args.clientId;
    this.clientSecret = args.clientSecret;
    this.scope = args.scope;
    Object.freeze(this);
  }

  [Equal.symbol](that: Equal.Equal): boolean {
    return that instanceof IdentityKey && this.issuer === that.issuer && Equal.equals(this.clientId, that.clientId) && Equal.equals(this.clientSecret, that.clientSecret) && this.scope === that.scope;
  }

  [Hash.symbol](): number {
    return Hash.array([this.issuer, this.clientId, this.clientSecret, this.scope]);
  }
}

class AppIdentityError extends AppError {}

@injectable()
export class OpenIdAppIdentityClient implements AppIdentityClient {
  private readonly tokens: Cache.Cache<IdentityKey, AccessToken, AppIdentityError>;
  private readonly configurations: Cache.Cache<IdentityKey, Configuration, AppIdentityError>;
  private readonly httpClient: HttpClient;

  constructor(@inject(TYPES.HttpClient) httpClient: HttpClient) {
    this.httpClient = httpClient;
    this.configurations = Effect.runSync(
      Cache.makeWith(
        (key: IdentityKey) => {
          return Effect.tryPromise({
            try: async () => {
              const issuer = new URL(key.issuer);
              const clientId = Redacted.value(key.clientId);
              const clientAuthentication = ClientSecretPost(Redacted.value(key.clientSecret));

              return await discovery(issuer, clientId, undefined, clientAuthentication, { [customFetch]: this.fetch, timeout: 10 });
            },
            catch: () => new AppIdentityError('App identity token acquisition failed.', ErrorCodes.AUTH_OIDC_APP_IDENTITY_FETCH_FAILED),
          });
        },
        { capacity: 100, timeToLive: (exit) => (Exit.isSuccess(exit) ? Infinity : 0) },
      ),
    );
    this.tokens = Effect.runSync(
      Cache.makeWith(
        (key: IdentityKey) =>
          Effect.tryPromise({
            try: async () => await this.acquireToken(key),
            // Transport and parser errors can contain credentials or response bodies.
            catch: (error) => (error instanceof AppIdentityError ? error : new AppIdentityError('App identity token acquisition failed.', ErrorCodes.AUTH_OIDC_APP_IDENTITY_FETCH_FAILED)),
          }),
        {
          capacity: 100,
          timeToLive: (exit) => (Exit.isSuccess(exit) ? Math.max(0, exit.value.expiresAt - Temporal.Now.instant().epochMilliseconds) : 0),
        },
      ),
    );
  }

  @Traced()
  async getAccessToken(request: GetAccessTokenRequest): Promise<Redacted.Redacted<string>> {
    const { issuer, clientId, clientSecret, scope } = request;

    if (
      issuer.protocol !== 'https:' ||
      issuer.username ||
      issuer.password ||
      issuer.href.includes('?') ||
      issuer.href.includes('#') ||
      issuer.pathname.includes('/.well-known/') ||
      !Redacted.value(clientId).trim() ||
      !Redacted.value(clientSecret).trim() ||
      !scope.trim()
    ) {
      throwAppError('App identity arguments are invalid.', ErrorCodes.AUTH_OIDC_APP_IDENTITY_INVALID_REQUEST);
    }

    const key = new IdentityKey(request);
    const result = await Effect.runPromise(Effect.result(Cache.get(this.tokens, key)));

    if (Result.isFailure(result)) {
      throwAppError(result.failure.message, result.failure.errorCode);
    }

    const token = result.success;

    if (token.expiresAt <= Temporal.Now.instant().epochMilliseconds) {
      throwAppError('App identity token expired before use.', ErrorCodes.AUTH_OIDC_APP_IDENTITY_TOKEN_EXPIRED);
    }

    return token.value;
  }

  private async acquireToken(key: IdentityKey): Promise<AccessToken> {
    const configuration = await Effect.runPromise(Cache.get(this.configurations, key));
    const startedAt = Temporal.Now.instant().epochMilliseconds;
    const response = await clientCredentialsGrant(configuration, { scope: key.scope });

    // The library validates the protocol. Bearer header safety and a usable lifetime are local requirements.
    if (response.token_type !== 'bearer' || !/^[A-Za-z0-9._~+/-]+=*$/.test(response.access_token) || response.expires_in === undefined || !Number.isFinite(response.expires_in) || response.expires_in <= 0) {
      throw new AppIdentityError('App identity token response is invalid.', ErrorCodes.AUTH_OIDC_APP_IDENTITY_INVALID_TOKEN_RESPONSE);
    }

    const lifetimeMs = response.expires_in * 1000;
    const expiresAt = startedAt + lifetimeMs - Math.min(60_000, lifetimeMs * 0.1);

    if (!Number.isFinite(expiresAt) || expiresAt <= Temporal.Now.instant().epochMilliseconds) {
      throw new AppIdentityError('App identity token expired before use.', ErrorCodes.AUTH_OIDC_APP_IDENTITY_TOKEN_EXPIRED);
    }

    return { value: Redacted.make(response.access_token), expiresAt };
  }

  private readonly fetch: CustomFetch = async (url, options) => {
    const response = await this.httpClient.instrumentedFetch(`http.client.app-identity.${options.method === 'GET' ? 'discovery.gets' : 'token.posts'}`, url, {
      ...options,
      redirect: 'error',
      retryOptions: { retries: 0, retryConditions: {} },
    });

    return new globalThis.Response(await response.arrayBuffer(), { status: response.status, statusText: response.statusText, headers: [...response.headers] });
  };
}
