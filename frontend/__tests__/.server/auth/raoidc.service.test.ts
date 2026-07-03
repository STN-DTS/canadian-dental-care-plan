import type { JWTPayload } from 'jose';
import type { Memoized, Options } from 'micro-memoize';
import { subtle } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockProxy } from 'vitest-mock-extended';
import { mock } from 'vitest-mock-extended';

import { DefaultRaoidcService } from '~/.server/auth/raoidc.service';
import type { RaoidcService } from '~/.server/auth/raoidc.service';
import type { ServerConfig } from '~/.server/configs';
import type { HttpClient } from '~/.server/http';
import { generateCryptoKey, generateJwkId } from '~/.server/utils/crypto.utils';
import type { IdToken, JWKSet, ServerMetadata, UserinfoToken } from '~/.server/utils/raoidc.utils';
import { fetchAccessToken, fetchServerMetadata, fetchUserInfo, generateAuthorizationRequest, generateCodeChallenge, generateRandomState } from '~/.server/utils/raoidc.utils';
import { expandTemplate } from '~/utils/string-utils';

vi.mock('node:crypto', () => ({
  randomUUID: vi.fn(),
  subtle: {
    exportKey: vi.fn(),
  },
}));

vi.mock('react-router', () => ({
  redirect: vi.fn((to: string) => `MockedRedirect(${to})`),
}));

vi.mock('micro-memoize');
vi.mock('~/.server/utils/crypto.utils');
vi.mock('~/.server/utils/raoidc.utils');
vi.mock('~/utils/string-utils');

describe('DefaultRaoidcService', () => {
  const mockServerConfig: Pick<ServerConfig, 'AUTH_RAOIDC_BASE_URL' | 'AUTH_RAOIDC_CLIENT_ID' | 'AUTH_RAOIDC_METADATA_CACHE_TTL_SECONDS' | 'AUTH_JWT_PRIVATE_KEY' | 'AUTH_LOGOUT_REDIRECT_URL' | 'HTTP_PROXY_URL'> = {
    AUTH_RAOIDC_BASE_URL: 'https://example.com/auth',
    AUTH_RAOIDC_CLIENT_ID: 'mock_client_id',
    AUTH_RAOIDC_METADATA_CACHE_TTL_SECONDS: 10,
    AUTH_JWT_PRIVATE_KEY: 'mock_private_key',
    AUTH_LOGOUT_REDIRECT_URL: 'https://example.com/auth/logout',
    HTTP_PROXY_URL: 'https://example.com/proxy',
  };

  let mockHttpClient: MockProxy<HttpClient>;
  let service: RaoidcService;

  beforeEach(() => {
    mockHttpClient = mock<HttpClient>();
    service = new DefaultRaoidcService(mockServerConfig, mockHttpClient);
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('sets the correct expires for memoize options', () => {
      class DefaultRaoidcServiceTest extends DefaultRaoidcService {
        public readonly fetchServerMetadataTest = this.fetchServerMetadata;
      }

      const serviceTest = new DefaultRaoidcServiceTest(mockServerConfig, mockHttpClient);

      // Act and Assert
      expect((serviceTest.fetchServerMetadataTest as Memoized<typeof serviceTest.fetchServerMetadataTest, Options<typeof serviceTest.fetchServerMetadataTest>>).options.expires).toBe(10_000); // 10 seconds in milliseconds
    });
  });

  describe('generateSigninRequest', () => {
    it('should generate a signin request', async () => {
      const mockCodeChallenge = 'mock_code_challenge';
      const mockCodeVerifier = 'mock_code_verifier';
      const mockState = 'mock_state';
      const mockAuthUrl = new URL('https://example.com/auth/auth');
      const mockServerMetadata = mock<ServerMetadata>({ authorization_endpoint: mockAuthUrl.toString() });
      const mockJwkSet = mock<JWKSet>();

      vi.mocked(generateCodeChallenge).mockReturnValue({ codeChallenge: mockCodeChallenge, codeVerifier: mockCodeVerifier });
      vi.mocked(generateRandomState).mockReturnValue(mockState);
      vi.mocked(fetchServerMetadata).mockResolvedValue({ serverMetadata: mockServerMetadata, jwkSet: mockJwkSet });
      vi.mocked(generateAuthorizationRequest).mockReturnValue(mockAuthUrl);

      const redirectUri = 'mock_redirect_uri';

      const result = await service.generateSigninRequest(redirectUri);

      expect(result).toEqual({ authUrl: mockAuthUrl, codeVerifier: mockCodeVerifier, state: mockState });
    });
  });

  describe('generateSignoutRequest', () => {
    it('should generate a signout request', () => {
      const sessionId = 'mock_session_id';
      const locale: AppLocale = 'en';
      const expectedSignoutUrl = 'mock_signout_url';

      vi.mocked(expandTemplate).mockReturnValue(expectedSignoutUrl);

      const signoutUrl = service.generateSignoutRequest({ sessionId, locale });

      expect(signoutUrl).toBe(expectedSignoutUrl);
    });
  });

  describe('handleCallback', () => {
    it('should handle a callback', async () => {
      // Implementation for handleCallback test
      const mockRequestUrl = new URL('http://localhost?code=mock_auth_code&state=mock_state');
      const codeVerifier = 'mock_code_verifier';
      const expectedState = 'mock_state';
      const redirectUri = 'mock_redirect_uri';
      const mockAccessToken = 'mock_access_token';
      const mockIdToken = mock<IdToken & JWTPayload>();
      const mockUserInfoToken = mock<UserinfoToken & JWTPayload>();
      const mockPrivateDecryptionKey = mock<CryptoKey>();
      const mockPrivateSigningKey = mock<CryptoKey>();
      const mockPrivateKeyId = 'mock_private_key_id';
      const mockServerMetadata = mock<ServerMetadata>();
      const mockJwkSet = mock<JWKSet>();

      vi.mocked(generateCryptoKey).mockResolvedValueOnce(mockPrivateDecryptionKey).mockResolvedValueOnce(mockPrivateSigningKey);
      vi.mocked(subtle.exportKey).mockImplementationOnce(async () => {
        const json = { name: 'Pankaj', age: 20 };
        const jsonString = JSON.stringify(json);
        const arrayBuffer = new TextEncoder().encode(jsonString).buffer;
        return await Promise.resolve(arrayBuffer);
      });
      vi.mocked(generateJwkId).mockReturnValue(mockPrivateKeyId);
      vi.mocked(fetchServerMetadata).mockResolvedValue({ serverMetadata: mockServerMetadata, jwkSet: mockJwkSet });
      vi.mocked(fetchAccessToken).mockResolvedValue({ accessToken: mockAccessToken, idToken: mockIdToken });
      vi.mocked(fetchUserInfo).mockResolvedValue(mockUserInfoToken);

      const result = await service.handleCallback({ requestUrl: mockRequestUrl, codeVerifier, expectedState, redirectUri });

      expect(result).toEqual({ accessToken: mockAccessToken, idToken: mockIdToken, userInfoToken: mockUserInfoToken });
    });

    it('should handle a callback with error parameter', async () => {
      const mockRequestUrl = new URL('http://localhost?error=mock_error&state=mock_state');
      const codeVerifier = 'mock_code_verifier';
      const expectedState = 'mock_state';
      const redirectUri = 'mock_redirect_uri';

      await expect(service.handleCallback({ requestUrl: mockRequestUrl, codeVerifier, expectedState, redirectUri })).rejects.toThrowError('Unexpected error: mock_error');
    });

    it('should handle a callback with missing authorization code', async () => {
      const mockRequestUrl = new URL('http://localhost?state=mock_state');
      const codeVerifier = 'mock_code_verifier';
      const expectedState = 'mock_state';
      const redirectUri = 'mock_redirect_uri';

      await expect(service.handleCallback({ requestUrl: mockRequestUrl, codeVerifier, expectedState, redirectUri })).rejects.toThrowError('Missing authorization code in response');
    });

    it('should handle a callback with state mismatch', async () => {
      const mockRequestUrl = new URL('http://localhost?code=mock_auth_code&state=wrong_state');
      const codeVerifier = 'mock_code_verifier';
      const expectedState = 'mock_state';
      const redirectUri = 'mock_redirect_uri';

      await expect(service.handleCallback({ requestUrl: mockRequestUrl, codeVerifier, expectedState, redirectUri })).rejects.toThrowError('CSRF error: incoming state [wrong_state] does not match expected state [mock_state]');
    });
  });
});
