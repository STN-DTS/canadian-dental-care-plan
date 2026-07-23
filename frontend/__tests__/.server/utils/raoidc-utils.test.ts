import { MockAgent, fetch } from 'undici';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchServerMetadata, generateAuthorizationRequest, generateCallbackUri, generateCodeChallenge, generateRandomNonce, generateRandomState, generateRandomString, validateSession } from '~/.server/utils/raoidc-utils';

vi.mock('~/utils/logging.server', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    trace: vi.fn(),
  }),
}));

describe('raoidc-utils', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('random string generation utils', () => {
    it('should generate a random nonce', () => {
      expect(generateRandomNonce().length).toEqual(32);
    });

    it('should generate a random code verifier and a code challenge', () => {
      const { codeChallenge, codeVerifier } = generateCodeChallenge();

      expect(codeChallenge.length).toEqual(43);
      expect(codeVerifier.length).toEqual(64);
    });

    it('should generate a random state', () => {
      expect(generateRandomState().length).toEqual(32);
    });

    it('should generate a random string of specified length', () => {
      expect(generateRandomString(32).length).toEqual(32);
    });
  });

  describe('OIDC requests', () => {
    it('should generate an OIDC callback URI', () => {
      const callbackUri = generateCallbackUri('http://localhost:3000', 'provider-id');
      expect(callbackUri).toEqual('http://localhost:3000/auth/callback/provider-id');
    });

    it('should generate an OIDC authorization request', () => {
      const authorizationRequest = generateAuthorizationRequest('https://example.com/auth', 'client-id', 'code-challenge', 'http://localhost:3000/auth/callback/provider-id', 'scope', 'state');
      const searchParams = authorizationRequest.searchParams;

      expect(authorizationRequest.origin).toEqual('https://example.com');
      expect(authorizationRequest.pathname).toEqual('/auth');
      expect(searchParams.get('client_id')).toEqual('client-id');
      expect(searchParams.get('code_challenge')).toEqual('code-challenge');
      expect(searchParams.get('code_challenge_method')).toEqual('S256');
      expect(searchParams.get('nonce')).toBeDefined(); // random so just check if defined
      expect(searchParams.get('redirect_uri')).toEqual('http://localhost:3000/auth/callback/provider-id');
      expect(searchParams.get('response_type')).toEqual('code');
      expect(searchParams.get('scope')).toEqual('scope');
      expect(searchParams.get('state')).toEqual('state');
    });

    it('should fetch server metadata', async () => {
      const mockAgent = new MockAgent();
      const mockPool = mockAgent.get('https://auth.example.com');
      mockPool
        .intercept({ path: '/.well-known/openid-configuration' }) //
        .reply(200, {
          authorization_endpoint: 'https://auth.example.com/authorize',
          issuer: 'https://auth.example.com',
          jwks_uri: 'https://auth.example.com/jwks',
          token_endpoint: 'https://auth.example.com/token',
          userinfo_endpoint: 'https://auth.example.com/userinfo',
        });
      mockPool
        .intercept({ path: '/jwks' }) //
        .reply(200, { keys: [{ kid: 'key-id', kty: 'RSA', n: 'AQAB', e: 'AQAB' }] });

      const fetchFn: typeof fetch = async (input, init) => await fetch(input, { ...init, dispatcher: mockPool });

      const { jwkSet, serverMetadata } = await fetchServerMetadata('https://auth.example.com', fetchFn);

      expect(jwkSet.keys[0]?.kid).toEqual('key-id');
      expect(jwkSet.keys[0]?.kty).toEqual('RSA');
      expect(jwkSet.keys[0]?.n).toEqual('AQAB');
      expect(jwkSet.keys[0]?.e).toEqual('AQAB');

      expect(serverMetadata.issuer).toEqual('https://auth.example.com');
      expect(serverMetadata.authorization_endpoint).toEqual('https://auth.example.com/authorize');
      expect(serverMetadata.jwks_uri).toEqual('https://auth.example.com/jwks');
      expect(serverMetadata.token_endpoint).toEqual('https://auth.example.com/token');
      expect(serverMetadata.userinfo_endpoint).toEqual('https://auth.example.com/userinfo');
    });

    it('should validate session', async () => {
      const mockAgent = new MockAgent();
      const mockPool = mockAgent.get('https://auth.example.com');
      mockPool
        .intercept({
          path: '/validatesession',
          query: {
            client_id: 'client-id',
            shared_session_id: 'session-id',
          },
        })
        .reply(200, 'true');

      const fetchFn: typeof fetch = async (input, init) => await fetch(input, { ...init, dispatcher: mockPool });

      const result = await validateSession('https://auth.example.com', 'client-id', 'session-id', fetchFn);

      expect(result).toEqual(true);
    });
  });
});
