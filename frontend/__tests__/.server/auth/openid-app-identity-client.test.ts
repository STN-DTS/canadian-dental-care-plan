import { RouterContextProvider } from 'react-router';

import { Redacted } from 'effect';
import { Container } from 'inversify';
import { inspect } from 'node:util';
import { Response } from 'undici';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import type { GetAccessTokenRequest } from '~/.server/auth/app-identity-client';
import { AppIdentityTokenCache } from '~/.server/auth/app-identity-token-cache';
import { AppIdentityTokenCacheConfig } from '~/.server/auth/app-identity-token-cache-config';
import { appIdentityTokenCacheConfigSchema } from '~/.server/auth/app-identity-token-cache-config-schema';
import type { AppIdentityTokenCacheConfigEnv } from '~/.server/auth/app-identity-token-cache-config-schema';
import { OpenIdAppIdentityClient } from '~/.server/auth/openid-app-identity-client';
import type { ServerConfig } from '~/.server/configs';
import { TYPES } from '~/.server/constants';
import { createServicesContainerModule } from '~/.server/container-modules/services-container-module';
import { correlationIdContext } from '~/.server/context/correlation-context';
import type { HttpClient } from '~/.server/http';
import { AppError } from '~/errors/app-error';
import { ErrorCodes } from '~/errors/error-codes';
import { contextStorageMiddleware } from '~/middlewares/context-storage.server';
import { expectDefined } from '~/utils/assert-utils';

const config = {
  HTTP_PROXY_URL: 'http://proxy.example.test',
  ...appIdentityTokenCacheConfigSchema.parse({}),
} satisfies Pick<ServerConfig, 'HTTP_PROXY_URL'> & AppIdentityTokenCacheConfigEnv;

const identity = {
  issuer: new URL('https://identity.example.test/organization'),
  clientId: Redacted.make('client-id'),
  clientSecret: Redacted.make(' secret +&= value '),
  scope: 'documents.write documents.scan',
} satisfies GetAccessTokenRequest;
const discoveryUrl = `${identity.issuer.href}/.well-known/openid-configuration`;
const tokenEndpoint = 'https://tokens.example.test/custom/credentials';
const metadataResponse = (issuer = identity.issuer.href) =>
  Response.json({
    issuer,
    token_endpoint: tokenEndpoint,
    token_endpoint_auth_methods_supported: ['client_secret_post'],
    response_types_supported: ['code'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['RS256'],
    jwks_uri: 'https://identity.example.test/keys',
  });
const tokenResponse = (token = 'access-token', expiresIn = 3600) => Response.json({ access_token: token, token_type: 'Bearer', expires_in: expiresIn });

function deferredResponse() {
  let resolve!: (response: Response) => void;
  let reject!: (error: Error) => void;
  let notifyStarted!: () => void;
  const started = new Promise<void>((onStart) => {
    notifyStarted = onStart;
  });
  const promise = new Promise<Response>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });

  return {
    resolve,
    reject,
    started,
    fetch: async () => {
      notifyStarted();
      return await promise;
    },
  };
}

const FAILURE_TTL_MS = 5_000;
const flushBackgroundRefresh = async () => await vi.advanceTimersByTimeAsync(0);

function createClient(httpClient: HttpClient): OpenIdAppIdentityClient {
  return new OpenIdAppIdentityClient(httpClient, new AppIdentityTokenCache(new AppIdentityTokenCacheConfig(appIdentityTokenCacheConfigSchema.parse({}))));
}

describe('OpenIdAppIdentityClient', () => {
  const httpClient = mock<HttpClient>();
  const tokenFetch = vi.fn<HttpClient['instrumentedFetch']>();
  const discoveryFetch = vi.fn<HttpClient['instrumentedFetch']>();
  let client: OpenIdAppIdentityClient;

  beforeEach(() => {
    vi.useFakeTimers({ now: Temporal.Instant.from('2026-07-01T00:00:00Z') });
    tokenFetch.mockReset();
    discoveryFetch.mockReset().mockImplementation(async () => await Promise.resolve(metadataResponse()));
    httpClient.instrumentedFetch.mockReset().mockImplementation(async (...args) => {
      return await (args[1] === discoveryUrl ? discoveryFetch(...args) : tokenFetch(...args));
    });
    client = createClient(httpClient);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('discovers a provider-independent endpoint and posts an encoded form without a proxy', async () => {
    tokenFetch.mockResolvedValue(tokenResponse());

    const token = await client.getAccessToken(identity);
    expect(Redacted.value(token)).toBe('access-token');
    expect(Redacted.isRedacted(token)).toBe(true);
    expect(JSON.stringify(token)).not.toContain('access-token');
    expect(inspect(token)).not.toContain('access-token');
    expect(inspect(identity)).not.toContain('client-id');
    expect(inspect(identity)).not.toContain('secret +&= value');
    expect(JSON.stringify(identity)).not.toContain('client-id');
    expect(JSON.stringify(identity)).not.toContain('secret +&= value');
    expect(discoveryFetch).toHaveBeenCalledExactlyOnceWith('http.client.app-identity.discovery.gets', discoveryUrl, expect.objectContaining({ method: 'GET' }));
    expect(tokenFetch).toHaveBeenCalledExactlyOnceWith(
      'http.client.app-identity.token.posts',
      tokenEndpoint,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' }),
      }),
    );
    const options = expectDefined(tokenFetch.mock.calls[0]?.[2], 'Expected token request options');
    const form = new URLSearchParams(String(options.body));
    expect(Object.fromEntries(form)).toEqual({
      grant_type: 'client_credentials',
      client_id: 'client-id',
      client_secret: ' secret +&= value ',
      scope: identity.scope,
    });

    for (const [, , request] of httpClient.instrumentedFetch.mock.calls) {
      expect(request).not.toHaveProperty('proxyUrl');
      expect(request).toMatchObject({
        signal: expect.any(AbortSignal),
        redirect: 'error',
        retryOptions: { retries: 0, retryConditions: {} },
      });
    }
  });

  it('reuses a token for equivalent fresh arguments and canonical issuer URLs', async () => {
    tokenFetch.mockResolvedValue(tokenResponse());

    await client.getAccessToken(identity);
    const token = await client.getAccessToken({
      ...identity,
      issuer: new URL('https://IDENTITY.example.test:443/organization'),
      clientId: Redacted.make('client-id'),
      clientSecret: Redacted.make(' secret +&= value '),
    });

    expect(Redacted.value(token)).toBe('access-token');
    expect(discoveryFetch).toHaveBeenCalledOnce();
    expect(tokenFetch).toHaveBeenCalledOnce();
  });

  it.each([
    { name: 'issuer', change: { issuer: new URL('https://other.example.test/organization') } },
    { name: 'client ID', change: { clientId: Redacted.make('other-client-id') } },
    { name: 'client secret', change: { clientSecret: Redacted.make('rotated-secret') } },
    { name: 'scope', change: { scope: 'documents.read' } },
    { name: 'client ID whitespace', change: { clientId: Redacted.make(` ${Redacted.value(identity.clientId)} `) } },
    { name: 'client secret whitespace', change: { clientSecret: Redacted.make(Redacted.value(identity.clientSecret).trim()) } },
    { name: 'scope whitespace', change: { scope: ` ${identity.scope} ` } },
  ])('isolates tokens and discovery for changed $name', async ({ change }) => {
    const other = { ...identity, ...change };

    if (change.issuer) {
      httpClient.instrumentedFetch.mockImplementation(async (...args) => {
        return await (args[2]?.method === 'GET' ? discoveryFetch(...args) : tokenFetch(...args));
      });
    }

    discoveryFetch.mockResolvedValueOnce(metadataResponse()).mockResolvedValueOnce(metadataResponse(other.issuer.href));
    tokenFetch.mockResolvedValueOnce(tokenResponse('original-token', 10)).mockResolvedValueOnce(tokenResponse('other-token', 10)).mockResolvedValueOnce(tokenResponse('original-refresh')).mockResolvedValueOnce(tokenResponse('other-refresh'));

    expect(Redacted.value(await client.getAccessToken(identity))).toBe('original-token');
    expect(Redacted.value(await client.getAccessToken(other))).toBe('other-token');
    expect(Redacted.value(await client.getAccessToken({ ...identity, issuer: new URL(identity.issuer) }))).toBe('original-token');
    expect(Redacted.value(await client.getAccessToken({ ...other, issuer: new URL(other.issuer) }))).toBe('other-token');
    expect(tokenFetch).toHaveBeenCalledTimes(2);
    expect(discoveryFetch).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(9_000);
    expect(Redacted.value(await client.getAccessToken(identity))).toBe('original-token');
    expect(Redacted.value(await client.getAccessToken(other))).toBe('other-token');
    await flushBackgroundRefresh();
    expect(Redacted.value(await client.getAccessToken(identity))).toBe('original-refresh');
    expect(Redacted.value(await client.getAccessToken(other))).toBe('other-refresh');
    expect(discoveryFetch).toHaveBeenCalledTimes(2);
    const forms = tokenFetch.mock.calls.map(([, , options]) => Object.fromEntries(new URLSearchParams(String(options?.body))));
    expect(forms).toEqual(
      [identity, other, identity, other].map((args) => ({
        grant_type: 'client_credentials',
        client_id: Redacted.value(args.clientId),
        client_secret: Redacted.value(args.clientSecret),
        scope: args.scope,
      })),
    );
  });

  it('acquires different identities independently while deduplicating equivalent pending requests', async () => {
    const first = deferredResponse();
    const second = deferredResponse();
    tokenFetch.mockImplementationOnce(first.fetch).mockImplementationOnce(second.fetch);
    const other = { ...identity, clientSecret: Redacted.make('rotated-secret') };
    const originalCallers = Array.from({ length: 100 }, async () => await client.getAccessToken({ ...identity, issuer: new URL(identity.issuer) }));
    const otherCallers = Array.from({ length: 100 }, async () => await client.getAccessToken({ ...other, issuer: new URL(other.issuer) }));

    await Promise.all([first.started, second.started]);
    expect(discoveryFetch).toHaveBeenCalledTimes(2);
    expect(tokenFetch).toHaveBeenCalledTimes(2);
    first.resolve(tokenResponse('original-token'));
    expect((await Promise.all(originalCallers)).every((token) => Redacted.value(token) === 'original-token')).toBe(true);
    second.resolve(tokenResponse('other-token'));
    expect((await Promise.all(otherCallers)).every((token) => Redacted.value(token) === 'other-token')).toBe(true);
  });

  it('snapshots caller-owned arguments before asynchronous discovery', async () => {
    const pending = deferredResponse();
    discoveryFetch.mockImplementationOnce(pending.fetch);
    tokenFetch.mockResolvedValue(tokenResponse());
    const args = { ...identity, issuer: new URL(identity.issuer) };
    const acquisition = client.getAccessToken(args);
    args.issuer.hostname = 'mutated.example.test';
    args.clientId = Redacted.make('mutated-client');
    args.clientSecret = Redacted.make('mutated-secret');
    args.scope = 'mutated.scope';
    await pending.started;
    pending.resolve(metadataResponse());

    expect(Redacted.value(await acquisition)).toBe('access-token');
    expect(discoveryFetch.mock.calls[0]?.[1]).toBe(discoveryUrl);
    const form = new URLSearchParams(String(tokenFetch.mock.calls[0]?.[2]?.body));
    expect(form.get('client_id')).toBe(Redacted.value(identity.clientId));
    expect(form.get('client_secret')).toBe(Redacted.value(identity.clientSecret));
    expect(form.get('scope')).toBe(identity.scope);
    await client.getAccessToken({ ...identity, issuer: new URL(identity.issuer) });
    expect(tokenFetch).toHaveBeenCalledOnce();
  });

  it('bounds retained identities and rediscovers evicted configurations', async () => {
    tokenFetch.mockImplementation(async () => await Promise.resolve(tokenResponse()));

    for (let index = 0; index <= 100; index++) {
      // eslint-disable-next-line no-await-in-loop -- Sequential access establishes the cache eviction order.
      await client.getAccessToken({ ...identity, clientSecret: Redacted.make(`secret-${index}`) });
    }

    await client.getAccessToken({ ...identity, clientSecret: Redacted.make('secret-100') });
    expect(tokenFetch).toHaveBeenCalledTimes(101);
    expect(discoveryFetch).toHaveBeenCalledTimes(101);
    await client.getAccessToken({ ...identity, clientSecret: Redacted.make('secret-0') });
    expect(tokenFetch).toHaveBeenCalledTimes(102);
    expect(discoveryFetch).toHaveBeenCalledTimes(102);
  });

  it('redacts credentials and tokens in retained client state', async () => {
    tokenFetch.mockResolvedValue(tokenResponse('unique-sensitive-access-token'));
    await client.getAccessToken(identity);
    httpClient.instrumentedFetch.mockReset();
    tokenFetch.mockReset();
    discoveryFetch.mockReset();

    expect(inspect(client, { depth: null })).not.toContain(Redacted.value(identity.clientSecret));
    expect(inspect(client, { depth: null })).not.toContain('unique-sensitive-access-token');
    expect(JSON.stringify(client)).not.toContain(Redacted.value(identity.clientSecret));
    expect(JSON.stringify(client)).not.toContain('unique-sensitive-access-token');
  });

  it('shares one cold acquisition and one early refresh across 100 concurrent callers', async () => {
    const cold = deferredResponse();
    tokenFetch.mockImplementationOnce(cold.fetch);
    const callers = Array.from({ length: 100 }, async () => await client.getAccessToken({ ...identity, issuer: new URL(identity.issuer) }));
    cold.resolve(tokenResponse());

    const tokens = await Promise.all(callers);
    expect(tokens.every((token) => Redacted.value(token) === 'access-token')).toBe(true);
    expect(tokenFetch).toHaveBeenCalledOnce();
    expect(discoveryFetch).toHaveBeenCalledOnce();

    vi.advanceTimersByTime(3_539_999);
    expect(Redacted.value(await client.getAccessToken(identity))).toBe('access-token');
    expect(tokenFetch).toHaveBeenCalledOnce();

    vi.advanceTimersByTime(1);
    const refresh = deferredResponse();
    tokenFetch.mockImplementationOnce(refresh.fetch);
    const refreshing = Array.from({ length: 100 }, async () => await client.getAccessToken(identity));

    // Callers are served the still-valid token without waiting for the refresh.
    const servedTokens = await Promise.all(refreshing);
    expect(servedTokens.every((token) => Redacted.value(token) === 'access-token')).toBe(true);
    await refresh.started;
    expect(tokenFetch).toHaveBeenCalledTimes(2);
    refresh.resolve(tokenResponse('refreshed-token'));
    await flushBackgroundRefresh();

    expect(Redacted.value(await client.getAccessToken(identity))).toBe('refreshed-token');
    expect(tokenFetch).toHaveBeenCalledTimes(2);
    expect(discoveryFetch).toHaveBeenCalledOnce();
  });

  it('keeps serving a valid token when the background refresh fails, retrying only after the failure window', async () => {
    tokenFetch.mockResolvedValueOnce(tokenResponse('old-token', 200)).mockRejectedValueOnce(new Error('issuer down'));
    await client.getAccessToken(identity);

    // Refresh point at 180s, hard expiry at 190s.
    vi.advanceTimersByTime(180_000);
    expect(Redacted.value(await client.getAccessToken(identity))).toBe('old-token');
    await flushBackgroundRefresh();
    expect(tokenFetch).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(FAILURE_TTL_MS - 1);
    expect(Redacted.value(await client.getAccessToken(identity))).toBe('old-token');
    await flushBackgroundRefresh();
    expect(tokenFetch).toHaveBeenCalledTimes(2);

    tokenFetch.mockResolvedValueOnce(tokenResponse('new-token'));
    vi.advanceTimersByTime(1);
    expect(Redacted.value(await client.getAccessToken(identity))).toBe('old-token');
    await flushBackgroundRefresh();
    expect(tokenFetch).toHaveBeenCalledTimes(3);
    expect(Redacted.value(await client.getAccessToken(identity))).toBe('new-token');
  });

  it('never serves a token past its hard expiry when refreshes keep failing', async () => {
    tokenFetch.mockResolvedValueOnce(tokenResponse('old-token', 10)).mockRejectedValue(new Error('issuer down'));
    await client.getAccessToken(identity);

    vi.advanceTimersByTime(9_000);
    expect(Redacted.value(await client.getAccessToken(identity))).toBe('old-token');
    await flushBackgroundRefresh();
    vi.advanceTimersByTime(500);

    await expect(client.getAccessToken(identity)).rejects.toMatchObject({ errorCode: ErrorCodes.AUTH_OIDC_APP_IDENTITY_FETCH_FAILED });
  });

  it('rediscovers the endpoint after the configuration lifetime', async () => {
    tokenFetch.mockResolvedValue(tokenResponse('access-token', 3_700));
    await client.getAccessToken(identity);

    vi.advanceTimersByTime(3_599_999);
    await client.getAccessToken(identity);
    await flushBackgroundRefresh();
    expect(discoveryFetch).toHaveBeenCalledOnce();

    // The token reaches its refresh point (3,640s) after the configuration has expired (3,600s).
    vi.advanceTimersByTime(40_001);
    await client.getAccessToken(identity);
    await flushBackgroundRefresh();
    expect(tokenFetch).toHaveBeenCalledTimes(2);
    expect(discoveryFetch).toHaveBeenCalledTimes(2);
  });

  it('keeps each client on its own fetch and discovery, so a separate instance does not reuse another instance cache', async () => {
    const otherHttpClient = mock<HttpClient>();
    otherHttpClient.instrumentedFetch.mockImplementation(async (...args) => await Promise.resolve(args[1] === discoveryUrl ? metadataResponse() : tokenResponse('other-client-token')));
    tokenFetch.mockResolvedValueOnce(tokenResponse('first-client-token'));
    await client.getAccessToken(identity);

    const token = await createClient(otherHttpClient).getAccessToken(identity);

    expect(Redacted.value(token)).toBe('other-client-token');
    expect(otherHttpClient.instrumentedFetch.mock.calls.map(([operation]) => operation)).toEqual(['http.client.app-identity.discovery.gets', 'http.client.app-identity.token.posts']);
    expect(discoveryFetch).toHaveBeenCalledOnce();
    expect(tokenFetch).toHaveBeenCalledOnce();
  });

  it('retains a short-lived token until its proportional refresh margin', async () => {
    tokenFetch.mockResolvedValueOnce(tokenResponse('short-token', 10)).mockResolvedValueOnce(tokenResponse('next-token', 10));

    expect(Redacted.value(await client.getAccessToken(identity))).toBe('short-token');
    vi.advanceTimersByTime(8_999);
    expect(Redacted.value(await client.getAccessToken(identity))).toBe('short-token');
    await flushBackgroundRefresh();
    expect(tokenFetch).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(1);
    expect(Redacted.value(await client.getAccessToken(identity))).toBe('short-token');
    await flushBackgroundRefresh();
    expect(Redacted.value(await client.getAccessToken(identity))).toBe('next-token');
    expect(tokenFetch).toHaveBeenCalledTimes(2);
  });

  it('starts token validity after discovery, not before it', async () => {
    const discovery = deferredResponse();
    discoveryFetch.mockImplementationOnce(discovery.fetch);
    tokenFetch.mockResolvedValueOnce(tokenResponse('short-token', 10)).mockResolvedValueOnce(tokenResponse('next-token'));
    const acquisition = client.getAccessToken(identity);
    await discovery.started;
    vi.advanceTimersByTime(20_000);
    discovery.resolve(metadataResponse());

    expect(Redacted.value(await acquisition)).toBe('short-token');
    vi.advanceTimersByTime(8_999);
    expect(Redacted.value(await client.getAccessToken(identity))).toBe('short-token');
    expect(tokenFetch).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(1);
    expect(Redacted.value(await client.getAccessToken(identity))).toBe('short-token');
    await flushBackgroundRefresh();
    expect(Redacted.value(await client.getAccessToken(identity))).toBe('next-token');
    expect(discoveryFetch).toHaveBeenCalledOnce();
  });

  it('subtracts token request latency from cached validity', async () => {
    const pending = deferredResponse();
    tokenFetch.mockImplementationOnce(pending.fetch).mockResolvedValueOnce(tokenResponse('next-token'));
    const acquisition = client.getAccessToken(identity);
    await pending.started;
    vi.advanceTimersByTime(5_000);
    pending.resolve(tokenResponse('slow-token', 10));

    expect(Redacted.value(await acquisition)).toBe('slow-token');
    vi.advanceTimersByTime(3_999);
    expect(Redacted.value(await client.getAccessToken(identity))).toBe('slow-token');
    expect(tokenFetch).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(1);
    expect(Redacted.value(await client.getAccessToken(identity))).toBe('slow-token');
    await flushBackgroundRefresh();
    expect(Redacted.value(await client.getAccessToken(identity))).toBe('next-token');
    expect(tokenFetch).toHaveBeenCalledTimes(2);
  });

  it('never returns or caches a token that expired during acquisition', async () => {
    const pending = deferredResponse();
    tokenFetch.mockImplementationOnce(pending.fetch).mockResolvedValueOnce(tokenResponse('next-token'));
    const acquisition = client.getAccessToken(identity);
    await pending.started;
    vi.advanceTimersByTime(10_001);
    pending.resolve(tokenResponse('expired-token', 10));

    await expect(acquisition).rejects.toMatchObject({
      name: 'AppError',
      errorCode: ErrorCodes.AUTH_OIDC_APP_IDENTITY_TOKEN_EXPIRED,
    });
    vi.advanceTimersByTime(FAILURE_TTL_MS);
    expect(Redacted.value(await client.getAccessToken(identity))).toBe('next-token');
    expect(tokenFetch).toHaveBeenCalledTimes(2);
  });

  it('shares a cold failure briefly, rediscovers the endpoint, and recovers after the failure window', async () => {
    const pending = deferredResponse();
    tokenFetch.mockImplementationOnce(pending.fetch);
    const callers = Array.from({ length: 100 }, async () => await client.getAccessToken({ ...identity, issuer: new URL(identity.issuer) }));
    const outcomes = Promise.allSettled(callers);
    await pending.started;
    pending.reject(new Error('secret +&= value access-token response-body'));
    const results = await outcomes;

    expect(results.every((result) => result.status === 'rejected')).toBe(true);
    expect(inspect(results)).not.toMatch(/secret|access-token|response-body/);
    expect(tokenFetch).toHaveBeenCalledOnce();

    await expect(client.getAccessToken(identity)).rejects.toThrow('App identity token acquisition failed.');
    expect(tokenFetch).toHaveBeenCalledOnce();

    vi.advanceTimersByTime(FAILURE_TTL_MS);
    tokenFetch.mockResolvedValueOnce(tokenResponse('recovered-token'));
    expect(Redacted.value(await client.getAccessToken(identity))).toBe('recovered-token');
    expect(tokenFetch).toHaveBeenCalledTimes(2);
    expect(discoveryFetch).toHaveBeenCalledTimes(2);
  });

  it('gives concurrent callers their own correlation ID when acquisition fails', async () => {
    const pending = deferredResponse();
    tokenFetch.mockImplementationOnce(pending.fetch);

    const callers = ['request-one', 'request-two'].map(async (correlationId) => {
      const context = new RouterContextProvider();
      context.set(correlationIdContext, correlationId);
      const url = new URL('https://localhost/');
      const request = new Request(url);

      return await contextStorageMiddleware({ context, params: {}, pattern: '', request, url }, async () => {
        const error = await client.getAccessToken(identity).catch((cause: unknown) => cause);

        expect(error).toBeInstanceOf(AppError);
        expect(error).toMatchObject({
          errorCode: ErrorCodes.AUTH_OIDC_APP_IDENTITY_FETCH_FAILED,
          correlationId,
        });
        return new globalThis.Response(null, { status: 204 });
      });
    });

    await pending.started;
    pending.reject(new Error('synthetic private transport error'));
    await Promise.all(callers);
    expect(tokenFetch).toHaveBeenCalledOnce();
  });

  it('shares discovery failure across concurrent callers and retries discovery on the next call', async () => {
    const pending = deferredResponse();
    discoveryFetch.mockImplementationOnce(pending.fetch);
    const outcomes = Promise.allSettled(Array.from({ length: 100 }, async () => await client.getAccessToken({ ...identity, issuer: new URL(identity.issuer) })));
    await pending.started;
    pending.reject(new Error('secret response-body'));
    const results = await outcomes;

    expect(results.every((result) => result.status === 'rejected')).toBe(true);
    expect(inspect(results)).not.toMatch(/secret|response-body/);
    expect(discoveryFetch).toHaveBeenCalledOnce();
    expect(tokenFetch).not.toHaveBeenCalled();
    vi.advanceTimersByTime(FAILURE_TTL_MS);
    tokenFetch.mockResolvedValueOnce(tokenResponse());
    expect(Redacted.value(await client.getAccessToken(identity))).toBe('access-token');
    expect(discoveryFetch).toHaveBeenCalledTimes(2);
  });

  it('rejects mismatched discovery issuers without sending credentials and can recover', async () => {
    discoveryFetch.mockResolvedValueOnce(metadataResponse('https://unexpected.example.test'));
    await expect(client.getAccessToken(identity)).rejects.toThrow('App identity token acquisition failed.');
    expect(tokenFetch).not.toHaveBeenCalled();
    vi.advanceTimersByTime(FAILURE_TTL_MS);
    tokenFetch.mockResolvedValueOnce(tokenResponse());
    expect(Redacted.value(await client.getAccessToken(identity))).toBe('access-token');
    expect(discoveryFetch).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['missing token', { token_type: 'Bearer', expires_in: 3600 }],
    ['empty token', { access_token: '', token_type: 'Bearer', expires_in: 3600 }],
    ['header injection', { access_token: 'secret\r\nInjected: true', token_type: 'Bearer', expires_in: 3600 }],
    ['token with spaces', { access_token: 'secret token', token_type: 'Bearer', expires_in: 3600 }],
    ['wrong token type', { access_token: 'secret', token_type: 'Basic', expires_in: 3600 }],
    ['non-bearer token type', { access_token: 'secret', token_type: 'DPoP', expires_in: 3600 }],
    ['missing lifetime', { access_token: 'secret', token_type: 'Bearer' }],
    ['invalid string lifetime', { access_token: 'secret', token_type: 'Bearer', expires_in: 'invalid' }],
    ['zero lifetime', { access_token: 'secret', token_type: 'Bearer', expires_in: 0 }],
    ['negative lifetime', { access_token: 'secret', token_type: 'Bearer', expires_in: -1 }],
    ['overflowing lifetime', { access_token: 'secret', token_type: 'Bearer', expires_in: Number.MAX_VALUE }],
    ['null response', null],
  ])('rejects a response with %s without exposing its contents and can recover', async (_name, body) => {
    tokenFetch.mockResolvedValueOnce(Response.json(body)).mockResolvedValueOnce(tokenResponse());

    const error = await client.getAccessToken(identity).catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(AppError);
    expect(inspect(error)).not.toContain('secret');
    expect(error).toHaveProperty('cause', undefined);
    vi.advanceTimersByTime(FAILURE_TTL_MS);
    expect(Redacted.value(await client.getAccessToken(identity))).toBe('access-token');
    expect(tokenFetch).toHaveBeenCalledTimes(2);
  });

  it('reports an invalid bearer token with an application error code', async () => {
    tokenFetch.mockResolvedValue(Response.json({ access_token: 'invalid token', token_type: 'Bearer', expires_in: 3600 }));

    await expect(client.getAccessToken(identity)).rejects.toMatchObject({
      name: 'AppError',
      errorCode: ErrorCodes.AUTH_OIDC_APP_IDENTITY_INVALID_TOKEN_RESPONSE,
    });
  });

  it('rejects a nonfinite lifetime parsed from JSON', async () => {
    tokenFetch.mockResolvedValue(new Response('{"access_token":"secret","token_type":"Bearer","expires_in":1e309}'));
    await expect(client.getAccessToken(identity)).rejects.toThrow('App identity token acquisition failed.');
  });

  it('uses the library normalization of Bearer token type and numeric string lifetime', async () => {
    tokenFetch.mockResolvedValue(Response.json({ access_token: 'token', token_type: 'bEaReR', expires_in: '3600' }));
    expect(Redacted.value(await client.getAccessToken(identity))).toBe('token');
  });

  it.each([302, 400, 401, 429, 500, 503])('sanitizes token HTTP %i failures without retaining library errors or retrying', async (status) => {
    tokenFetch.mockResolvedValue(Response.json({ error: 'invalid_client', error_description: 'secret access-token response-body' }, { status }));
    const error = await client.getAccessToken(identity).catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(AppError);
    expect(error).toHaveProperty('errorCode', ErrorCodes.AUTH_OIDC_APP_IDENTITY_FETCH_FAILED);
    expect(inspect(error)).not.toMatch(/secret|access-token|response-body/);
    expect(error).toHaveProperty('cause', undefined);
    expect(tokenFetch).toHaveBeenCalledOnce();
  });

  it('sanitizes JSON parsing errors without retaining their cause', async () => {
    tokenFetch.mockResolvedValue(new Response('secret invalid JSON'));
    const error = await client.getAccessToken(identity).catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(AppError);
    expect(inspect(error)).not.toMatch(/secret|invalid JSON/);
    expect(error).toHaveProperty('cause', undefined);
  });

  it.each(['discovery', 'token'])('uses a ten-second timeout for %s requests', async (operation) => {
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    const pending = deferredResponse();
    tokenFetch.mockResolvedValue(tokenResponse());
    (operation === 'discovery' ? discoveryFetch : tokenFetch).mockImplementationOnce(pending.fetch);
    const acquisition = client.getAccessToken(identity);
    await pending.started;
    const calls = operation === 'discovery' ? discoveryFetch.mock.calls : tokenFetch.mock.calls;
    const signal = expectDefined(calls[0]?.[2]?.signal, 'Expected request signal');
    expect(signal.aborted).toBe(false);
    expect(timeout).toHaveBeenLastCalledWith(10_000);
    pending.reject(new Error('secret timeout'));
    await expect(acquisition).rejects.toThrow('App identity token acquisition failed.');
  });

  it.each([
    'http://identity.example.test/organization',
    'https://user:secret@identity.example.test/organization',
    'https://identity.example.test/organization?secret=value',
    'https://identity.example.test/organization?',
    'https://identity.example.test/organization#secret',
    'https://identity.example.test/organization#',
    discoveryUrl,
    'file:///secret',
  ])('rejects invalid issuer %s before making an HTTP request', async (issuer) => {
    const error = await client.getAccessToken({ ...identity, issuer: new URL(issuer) }).catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(AppError);
    expect(error).toHaveProperty('errorCode', ErrorCodes.AUTH_OIDC_APP_IDENTITY_INVALID_REQUEST);
    expect(inspect(error)).not.toContain('secret');
    expect(error).toHaveProperty('cause', undefined);
    expect(httpClient.instrumentedFetch).not.toHaveBeenCalled();
  });

  it.each(['clientId', 'clientSecret', 'scope'] as const)('rejects blank %s before making an HTTP request', async (key) => {
    const errors = await Promise.all(['', ' \t\n '].map(async (value) => await client.getAccessToken({ ...identity, [key]: key === 'scope' ? value : Redacted.make(value) }).catch((cause: unknown) => cause)));

    for (const error of errors) {
      expect(error).toBeInstanceOf(AppError);
      expect(error).toHaveProperty('errorCode', ErrorCodes.AUTH_OIDC_APP_IDENTITY_INVALID_REQUEST);
      expect(inspect(error)).not.toContain(Redacted.value(identity.clientSecret));
      expect(error).toHaveProperty('cause', undefined);
    }

    expect(httpClient.instrumentedFetch).not.toHaveBeenCalled();
  });

  it('shares the real singleton binding between independently resolved consumers', async () => {
    const container = new Container();
    container.load(createServicesContainerModule({ ENABLED_MOCKS: [], SESSION_STORAGE_TYPE: 'memory' }));
    container.bind(TYPES.ServerConfig).toConstantValue(Object.assign(mock<ServerConfig>(), config));
    const binding = container.rebind(TYPES.HttpClient);
    binding.toConstantValue(httpClient);
    tokenFetch.mockImplementation(async () => await Promise.resolve(tokenResponse()));

    const firstConsumer = container.get(TYPES.AppIdentityClient);
    const secondConsumer = container.get(TYPES.AppIdentityClient);
    const tokens = await Promise.all([firstConsumer.getAccessToken(identity), secondConsumer.getAccessToken({ ...identity, issuer: new URL(identity.issuer) })]);

    expect(firstConsumer).toBe(secondConsumer);
    expect(container.get(TYPES.AppIdentityTokenCache)).toBe(container.get(TYPES.AppIdentityTokenCache));
    expect(tokens.map((token) => Redacted.value(token))).toEqual(['access-token', 'access-token']);
    expect(discoveryFetch).toHaveBeenCalledOnce();
    expect(tokenFetch).toHaveBeenCalledOnce();

    for (const [, , request] of httpClient.instrumentedFetch.mock.calls) {
      expect(request).not.toHaveProperty('proxyUrl');
    }

    expect(Redacted.value(await secondConsumer.getAccessToken({ ...identity, clientSecret: Redacted.make('rotated-secret') }))).toBe('access-token');
    expect(discoveryFetch).toHaveBeenCalledTimes(2);
    expect(tokenFetch).toHaveBeenCalledTimes(2);
  });
});
