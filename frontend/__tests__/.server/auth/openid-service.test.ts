import { Redacted } from 'effect';
import { SignJWT, decodeProtectedHeader, exportJWK, generateKeyPair, jwtVerify } from 'jose';
import type { JWTPayload } from 'jose';
import { createHash, createPublicKey, generateKeyPairSync } from 'node:crypto';
import { inspect } from 'node:util';
import { Response } from 'undici';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import type { AuthCorrelation } from '~/.server/auth/auth-service';
import { DefaultOpenIdService } from '~/.server/auth/openid-service';
import { OpenIdServiceConfig } from '~/.server/auth/openid-service-config';
import type { ServerConfig } from '~/.server/configs';
import type { HttpClient } from '~/.server/http';
import type { Logger } from '~/.server/logging';
import { AppError } from '~/errors/app-error';
import { ErrorCodes } from '~/errors/error-codes';

const logger = vi.hoisted(() => ({ trace: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), fatal: vi.fn() }));

vi.mock(import('~/.server/logging'), async (importOriginal) => ({
  ...(await importOriginal()),
  createLogger: () => logger as unknown as Logger,
}));

const issuer = 'https://isams.example.test/oauth2';
const clientId = 'cdcp-isams-client';
const keyId = 'cdcp-isams-test';
const redirectUri = 'https://cdcp.example.test/auth/callback/oidc';
const proxyUrl = 'http://proxy.example.test:3128';
const authorizationEndpoint = `${issuer}/authorize`;
const tokenEndpoint = `${issuer}/token`;
const jwksUri = `${issuer}/jwks`;
const authCode = 'synthetic-authorization-code';
const accessToken = 'synthetic-access-token';

const clientKeys = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
const providerKeys = await generateKeyPair('RS256');
const attackerKeys = await generateKeyPair('RS256');
const providerJwk = { ...(await exportJWK(providerKeys.publicKey)), kid: 'provider-key', alg: 'RS256', use: 'sig' };

type OidcServerConfig = Pick<ServerConfig, 'HTTP_PROXY_URL'> & {
  AUTH_PROVIDER: 'oidc';
  AUTH_OIDC_ISSUER_URL: string;
  AUTH_OIDC_CLIENT_ID: string;
  AUTH_OIDC_REDIRECT_URI: string;
  AUTH_OIDC_PRIVATE_KEY: Redacted.Redacted<string>;
  AUTH_OIDC_PRIVATE_KEY_ID: string;
  AUTH_OIDC_CLIENT_ASSERTION_AUDIENCE: 'token-endpoint' | 'issuer';
};

function createConfig(overrides: Partial<OidcServerConfig> = {}): OpenIdServiceConfig {
  return new OpenIdServiceConfig({
    HTTP_PROXY_URL: proxyUrl,
    AUTH_PROVIDER: 'oidc',
    AUTH_OIDC_ISSUER_URL: issuer,
    AUTH_OIDC_CLIENT_ID: clientId,
    AUTH_OIDC_REDIRECT_URI: redirectUri,
    AUTH_OIDC_PRIVATE_KEY: Redacted.make(clientKeys.privateKey),
    AUTH_OIDC_PRIVATE_KEY_ID: keyId,
    AUTH_OIDC_CLIENT_ASSERTION_AUDIENCE: 'token-endpoint',
    ...overrides,
  });
}

interface IdTokenOptions {
  claims?: JWTPayload;
  issuer?: string;
  audience?: string;
  expiresAt?: number;
  signingKey?: CryptoKey;
}

async function createIdToken(nonce: string, { claims = {}, issuer: tokenIssuer = issuer, audience = clientId, expiresAt, signingKey = providerKeys.privateKey }: IdTokenOptions = {}) {
  const now = Math.floor(Date.now() / 1000);
  return await new SignJWT({ nonce, ...claims })
    .setProtectedHeader({ alg: 'RS256', kid: providerJwk.kid })
    .setIssuer(tokenIssuer)
    .setAudience(audience)
    .setSubject('synthetic-subject')
    .setIssuedAt(now)
    .setExpirationTime(expiresAt ?? now + 300)
    .sign(signingKey);
}

/**
 * A fake provider: serves discovery and JWKS, and implements the token endpoint, which checks the PKCE verifier
 * against the challenge sent at authorization.
 */
class FakeProvider {
  codeChallenge?: string;
  tokenRequests: URLSearchParams[] = [];
  discovery = (): Response =>
    Response.json({ issuer, authorization_endpoint: authorizationEndpoint, token_endpoint: tokenEndpoint, jwks_uri: jwksUri, response_types_supported: ['code'], subject_types_supported: ['public'], id_token_signing_alg_values_supported: ['RS256'] });
  tokenResponse = async (nonce: string): Promise<Response> => Response.json({ access_token: accessToken, token_type: 'Bearer', expires_in: 300, id_token: await createIdToken(nonce) });
  nonce?: string;

  readonly fetch: HttpClient['instrumentedFetch'] = async (_metricPrefix, input, options) => {
    const url = String(input);

    if (url === `${issuer}/.well-known/openid-configuration`) {
      return this.discovery();
    }

    if (url === jwksUri) {
      return Response.json({ keys: [providerJwk] });
    }

    if (url === tokenEndpoint && options?.method === 'POST') {
      const body = new URLSearchParams(options.body as string | URLSearchParams);
      this.tokenRequests.push(body);
      const verifier = body.get('code_verifier') ?? '';

      if (createHash('sha256').update(verifier).digest('base64url') !== this.codeChallenge) {
        return Response.json({ error: 'invalid_grant', error_description: `synthetic-provider-detail ${verifier}` }, { status: 400 });
      }

      return await this.tokenResponse(this.nonce ?? '');
    }

    return new Response('not found', { status: 404 });
  };
}

function callbackUrl(state: string, params: Record<string, string> = { code: authCode }) {
  return new URL(`${redirectUri}?${new URLSearchParams({ ...params, state })}`);
}

async function rejectionOf(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }

  throw new Error('Expected the promise to reject');
}

/** Nothing sensitive may appear in the thrown error or any log entry. */
function expectNoSensitiveValues(error: unknown, correlation: AuthCorrelation) {
  const exposed = `${inspect(error, { depth: 5 })} ${JSON.stringify(Object.values(logger).map((fn) => fn.mock.calls))}`;

  for (const secret of [authCode, accessToken, correlation.codeVerifier, correlation.nonce, correlation.state, 'PRIVATE KEY', 'synthetic-subject', 'synthetic-provider-detail']) {
    expect(exposed).not.toContain(secret);
  }
}

describe('DefaultOpenIdService', () => {
  let provider: FakeProvider;
  let httpClient: ReturnType<typeof mock<HttpClient>>;

  beforeEach(() => {
    provider = new FakeProvider();
    httpClient = mock<HttpClient>();
    httpClient.instrumentedFetch.mockImplementation(provider.fetch);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  function createService(overrides: Partial<OidcServerConfig> = {}) {
    return new DefaultOpenIdService(createConfig(overrides), httpClient);
  }

  async function startSignin(service: DefaultOpenIdService) {
    const request = await service.generateSigninRequest();
    provider.codeChallenge = request.authUrl.searchParams.get('code_challenge') ?? undefined;
    provider.nonce = request.correlation.nonce;
    return request;
  }

  describe('generateSigninRequest', () => {
    it('uses the discovered authorization endpoint with S256 PKCE, state, nonce and the exact redirect URI', async () => {
      const { authUrl, correlation } = await createService().generateSigninRequest();

      expect(`${authUrl.origin}${authUrl.pathname}`).toBe(authorizationEndpoint);
      expect(Object.fromEntries(authUrl.searchParams)).toEqual({
        client_id: clientId,
        response_type: 'code',
        redirect_uri: redirectUri,
        scope: 'openid',
        code_challenge: createHash('sha256').update(correlation.codeVerifier).digest('base64url'),
        code_challenge_method: 'S256',
        state: correlation.state,
        nonce: correlation.nonce,
      });
    });

    it('creates fresh correlation values for each attempt', async () => {
      const service = createService();
      const first = await service.generateSigninRequest();
      const second = await service.generateSigninRequest();

      expect(second.correlation.state).not.toBe(first.correlation.state);
      expect(second.correlation.nonce).not.toBe(first.correlation.nonce);
      expect(second.correlation.codeVerifier).not.toBe(first.correlation.codeVerifier);
    });

    it('uses the proxy, refuses redirects and disables retries for provider requests', async () => {
      await createService().generateSigninRequest();

      expect(httpClient.instrumentedFetch).toHaveBeenCalledWith('http.client.oidc-connectivity.gets', expect.anything(), expect.objectContaining({ proxyUrl, redirect: 'error', retryOptions: { retries: 0, retryConditions: {} } }));
    });

    it('fails when discovery is unavailable', async () => {
      provider.discovery = () => new Response('unavailable', { status: 503 });

      await expect(createService().generateSigninRequest()).rejects.toMatchObject({ errorCode: ErrorCodes.AUTH_OIDC_CONNECTIVITY_DISCOVERY_FAILED, httpStatusCode: 502, meta: { reason: expect.stringMatching(/^OAUTH_/) } });

      // The auth route owns the failure log; the service leaves only a debug breadcrumb.
      expect(logger.debug).toHaveBeenCalledWith('OIDC connectivity check failed', expect.objectContaining({ 'error.type': expect.stringMatching(/^OAUTH_/) }));
      expect(logger.warn).not.toHaveBeenCalled();
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('fails when the discovered issuer does not match the configured issuer', async () => {
      const original = provider.discovery();
      const metadata = (await original.json()) as Record<string, unknown>;
      provider.discovery = () => Response.json({ ...metadata, issuer: 'https://other.example.test/oauth2' });

      await expect(createService().generateSigninRequest()).rejects.toMatchObject({ errorCode: ErrorCodes.AUTH_OIDC_CONNECTIVITY_DISCOVERY_FAILED });
    });
  });

  describe('handleCallback', () => {
    it('returns a verified connectivity result without tokens or claims', async () => {
      const service = createService();
      const { correlation } = await startSignin(service);

      const result = await service.handleCallback({ callbackUrl: callbackUrl(correlation.state), correlation });

      expect(result).toEqual({ outcome: 'connectivity-verified', authenticated: false, issuer });
      expect(JSON.stringify(result)).not.toContain(accessToken);
    });

    it('sends the code, original verifier, exact redirect URI and an RS256 private_key_jwt assertion to the token endpoint', async () => {
      const service = createService();
      const { correlation } = await startSignin(service);

      await service.handleCallback({ callbackUrl: callbackUrl(correlation.state), correlation });

      const [body] = provider.tokenRequests;
      expect(provider.tokenRequests).toHaveLength(1);
      expect(body?.get('grant_type')).toBe('authorization_code');
      expect(body?.get('code')).toBe(authCode);
      expect(body?.get('code_verifier')).toBe(correlation.codeVerifier);
      expect(body?.get('redirect_uri')).toBe(redirectUri);
      expect(body?.get('client_id')).toBe(clientId);
      expect(body?.get('client_assertion_type')).toBe('urn:ietf:params:oauth:client-assertion-type:jwt-bearer');

      const assertion = body?.get('client_assertion') ?? '';
      expect(decodeProtectedHeader(assertion)).toEqual({ alg: 'RS256', kid: keyId });
      const { payload } = await jwtVerify(assertion, createPublicKey(clientKeys.publicKey), { algorithms: ['RS256'], audience: tokenEndpoint, issuer: clientId, subject: clientId });
      expect(payload.jti).toEqual(expect.any(String));
    });

    it('uses the issuer as the assertion audience when configured', async () => {
      const service = createService({ AUTH_OIDC_CLIENT_ASSERTION_AUDIENCE: 'issuer' });
      const { correlation } = await startSignin(service);

      await service.handleCallback({ callbackUrl: callbackUrl(correlation.state), correlation });

      await expect(jwtVerify(provider.tokenRequests[0]?.get('client_assertion') ?? '', createPublicKey(clientKeys.publicKey), { audience: issuer })).resolves.toBeDefined();
    });

    it('rejects a mismatched state before contacting the provider', async () => {
      const service = createService();
      const { correlation } = await startSignin(service);
      httpClient.instrumentedFetch.mockClear();

      const error = await rejectionOf(service.handleCallback({ callbackUrl: callbackUrl('forged-state'), correlation }));

      expect(error).toBeInstanceOf(AppError);
      expect(error).toMatchObject({ errorCode: ErrorCodes.AUTH_OIDC_CONNECTIVITY_CALLBACK_INVALID });

      expect(httpClient.instrumentedFetch).not.toHaveBeenCalled();
      expectNoSensitiveValues(error, correlation);
    });

    it('rejects a callback without a code', async () => {
      const service = createService();
      const { correlation } = await startSignin(service);

      await expect(service.handleCallback({ callbackUrl: callbackUrl(correlation.state, {}), correlation })).rejects.toMatchObject({ errorCode: ErrorCodes.AUTH_OIDC_CONNECTIVITY_CALLBACK_INVALID });
    });

    it('rejects a callback on a path other than the registered redirect URI', async () => {
      const service = createService();
      const { correlation } = await startSignin(service);
      const url = new URL(`https://cdcp.example.test/auth/callback/raoidc?code=${authCode}&state=${correlation.state}`);

      await expect(service.handleCallback({ callbackUrl: url, correlation })).rejects.toMatchObject({ errorCode: ErrorCodes.AUTH_OIDC_CONNECTIVITY_CALLBACK_INVALID });
    });

    it('rejects a provider error response with only an allowlisted error code as its reason', async () => {
      const service = createService();
      const { correlation } = await startSignin(service);

      const error = await rejectionOf(service.handleCallback({ callbackUrl: callbackUrl(correlation.state, { error: 'access_denied', error_description: 'synthetic-provider-detail' }), correlation }));

      expect(error).toBeInstanceOf(AppError);
      expect(error).toMatchObject({ errorCode: ErrorCodes.AUTH_OIDC_CONNECTIVITY_PROVIDER_ERROR });

      expect(error).toMatchObject({ meta: { reason: 'access_denied' } });
      expect(logger.warn).not.toHaveBeenCalled();
      expect(logger.error).not.toHaveBeenCalled();
      expectNoSensitiveValues(error, correlation);
    });

    it('rejects a wrong PKCE verifier through the provider', async () => {
      const service = createService();
      const { correlation } = await startSignin(service);
      const tampered = { ...correlation, codeVerifier: 'tampered-verifier-tampered-verifier-tampered-verifier' };

      const error = await rejectionOf(service.handleCallback({ callbackUrl: callbackUrl(correlation.state), correlation: tampered }));

      expect(error).toBeInstanceOf(AppError);
      expect(error).toMatchObject({ errorCode: ErrorCodes.AUTH_OIDC_CONNECTIVITY_TOKEN_EXCHANGE_FAILED });

      expect(error).toMatchObject({ meta: { reason: 'invalid_grant' } });
      expect(logger.warn).not.toHaveBeenCalled();
      expect(logger.error).not.toHaveBeenCalled();
      expectNoSensitiveValues(error, tampered);
    });

    it('rejects an ID token with a different nonce', async () => {
      const service = createService();
      const { correlation } = await startSignin(service);
      provider.nonce = 'other-nonce';

      const error = await rejectionOf(service.handleCallback({ callbackUrl: callbackUrl(correlation.state), correlation }));

      expect(error).toBeInstanceOf(AppError);
      expect(error).toMatchObject({ errorCode: ErrorCodes.AUTH_OIDC_CONNECTIVITY_TOKEN_RESPONSE_INVALID });

      expectNoSensitiveValues(error, correlation);
    });

    it.each<[string, IdTokenOptions]>([
      ['an invalid signature', { signingKey: attackerKeys.privateKey }],
      ['an unexpected issuer', { issuer: 'https://other.example.test/oauth2' }],
      ['an unexpected audience', { audience: 'other-client' }],
      ['an expired token', { expiresAt: Math.floor(Date.now() / 1000) - 600 }],
    ])('rejects an ID token with %s', async (_label, options) => {
      const service = createService();
      const { correlation } = await startSignin(service);
      provider.tokenResponse = async (nonce) => Response.json({ access_token: accessToken, token_type: 'Bearer', expires_in: 300, id_token: await createIdToken(nonce, options) });

      const error = await rejectionOf(service.handleCallback({ callbackUrl: callbackUrl(correlation.state), correlation }));

      expect(error).toBeInstanceOf(AppError);
      expect(error).toMatchObject({ errorCode: ErrorCodes.AUTH_OIDC_CONNECTIVITY_TOKEN_RESPONSE_INVALID });

      expectNoSensitiveValues(error, correlation);
    });

    it('rejects a token response without an ID token', async () => {
      const service = createService();
      const { correlation } = await startSignin(service);
      provider.tokenResponse = async () => await Promise.resolve(Response.json({ access_token: accessToken, token_type: 'Bearer', expires_in: 300 }));

      await expect(service.handleCallback({ callbackUrl: callbackUrl(correlation.state), correlation })).rejects.toMatchObject({ errorCode: ErrorCodes.AUTH_OIDC_CONNECTIVITY_TOKEN_RESPONSE_INVALID });
    });

    it.each([
      ['a server error page', () => new Response('<html>synthetic-provider-detail</html>', { status: 500, headers: { 'content-type': 'text/html' } })],
      ['a transport failure', async () => await Promise.reject(new Error('synthetic-provider-detail'))],
    ])('reports %s from the token endpoint as an exchange failure', async (_label, respond) => {
      const service = createService();
      const { correlation } = await startSignin(service);
      provider.tokenResponse = async () => await respond();

      const error = await rejectionOf(service.handleCallback({ callbackUrl: callbackUrl(correlation.state), correlation }));

      expect(error).toBeInstanceOf(AppError);
      expect(error).toMatchObject({ errorCode: ErrorCodes.AUTH_OIDC_CONNECTIVITY_TOKEN_EXCHANGE_FAILED });

      expectNoSensitiveValues(error, correlation);
    });
  });
});

describe('OpenIdServiceConfig', () => {
  it('requires the oidc provider', () => {
    expect(() => new OpenIdServiceConfig({ HTTP_PROXY_URL: undefined, AUTH_PROVIDER: 'raoidc', AUTH_RAOIDC_BASE_URL: 'https://auth.example.test', AUTH_RAOIDC_CLIENT_ID: 'client' })).toThrow(
      expect.objectContaining({ errorCode: ErrorCodes.PLT_CONFIG_AUTH_PROVIDER_INVALID }),
    );
  });
});
