import { ATTR_SESSION_ID } from '@opentelemetry/semantic-conventions/incubating';
import { Option, Redacted } from 'effect';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockProxy } from 'vitest-mock-extended';
import { mock } from 'vitest-mock-extended';

import type { HttpClient } from '~/.server/http';
import { createLogger } from '~/.server/logging';
import type { Logger } from '~/.server/logging';
import type { IdToken, UserinfoToken } from '~/.server/utils/raoidc-utils';
import { validateSession } from '~/.server/utils/raoidc-utils';
import type { Session } from '~/.server/web/session';
import { DefaultRaoidcSessionValidator } from '~/.server/web/validators';

vi.mock(import('~/.server/utils/raoidc-utils'));

describe('DefaultRaoidcSessionValidator', () => {
  let mockHttpClient: MockProxy<HttpClient>;

  let mockLogger: MockProxy<Logger>;
  let mockSession: MockProxy<Session>;
  let mockServerConfig;
  let validator: DefaultRaoidcSessionValidator;

  beforeEach(() => {
    mockHttpClient = mock<HttpClient>();
    mockLogger = mock<Logger>();
    vi.mocked(createLogger).mockReturnValue(mockLogger);

    mockServerConfig = {
      AUTH_PROVIDER: 'raoidc' as const,
      AUTH_RAOIDC_BASE_URL: 'https://auth.example.com',
      AUTH_RAOIDC_CLIENT_ID: 'client-id',
      HTTP_PROXY_URL: 'https://proxy.example.com',
    };

    mockSession = mock<Session>({ id: 'test-session-id' });

    validator = new DefaultRaoidcSessionValidator(mockServerConfig, mockHttpClient);
  });

  describe('validateRaoidcSession', () => {
    it('should return isValid: false if idToken is not found in session', async () => {
      mockSession.find.calledWith('idToken').mockReturnValueOnce(Option.none());

      const result = await validator.validateRaoidcSession({ session: mockSession });

      expect(result).toEqual({ isValid: false, errorMessage: 'RAOIDC session validation failed; idToken not found in session [test-session-id]' });
      expect(mockLogger.debug).toHaveBeenCalledWith('ID token not found in session', { [ATTR_SESSION_ID]: 'test-session-id' });
    });

    it('should return isValid: false if userInfoToken is not found in session', async () => {
      mockSession.find.calledWith('idToken').mockReturnValueOnce(Option.some({ sid: 'session-id' } as IdToken));
      mockSession.find.calledWith('userInfoToken').mockReturnValueOnce(Option.none());

      const result = await validator.validateRaoidcSession({ session: mockSession });

      expect(result).toEqual({ isValid: false, errorMessage: 'RAOIDC session validation failed; userInfoToken not found in session [test-session-id]' });
      expect(mockLogger.debug).toHaveBeenCalledWith('User information token not found in session', { [ATTR_SESSION_ID]: 'test-session-id' });
    });

    it('should return isValid: true if session is mocked', async () => {
      mockSession.find.calledWith('idToken').mockReturnValueOnce(Option.some({ sid: 'session-id' } as IdToken));
      mockSession.find.calledWith('userInfoToken').mockReturnValueOnce(Option.some({ mocked: true } as UserinfoToken));

      const result = await validator.validateRaoidcSession({ session: mockSession });

      expect(result).toEqual({ isValid: true });
      expect(mockLogger.debug).toHaveBeenCalledWith('Mocked user; skipping RAOIDC session validation', { [ATTR_SESSION_ID]: 'test-session-id' });
    });

    it('should return isValid: false if session is expired', async () => {
      mockSession.find.calledWith('idToken').mockReturnValueOnce(Option.some({ sid: 'session-id' } as IdToken));
      mockSession.find.calledWith('userInfoToken').mockReturnValueOnce(Option.some({ mocked: false } as UserinfoToken));
      vi.mocked(validateSession).mockResolvedValueOnce(false);

      const result = await validator.validateRaoidcSession({ session: mockSession });

      expect(result).toEqual({ isValid: false, errorMessage: 'RAOIDC session validation failed; session [test-session-id] has expired' });
      expect(mockLogger.debug).toHaveBeenCalledWith('RAOIDC session has expired', { [ATTR_SESSION_ID]: 'test-session-id' });
    });

    it('should return isValid: true if session is valid', async () => {
      mockSession.find.calledWith('idToken').mockReturnValueOnce(Option.some({ sid: 'session-id' } as IdToken));
      mockSession.find.calledWith('userInfoToken').mockReturnValueOnce(Option.some({ mocked: false } as UserinfoToken));
      vi.mocked(validateSession).mockResolvedValueOnce(true);

      const result = await validator.validateRaoidcSession({ session: mockSession });

      expect(result).toEqual({ isValid: true });
      expect(mockLogger.debug).toHaveBeenCalledWith('Authentication check passed for RAOIDC session', { [ATTR_SESSION_ID]: 'test-session-id' });
    });

    it('should return isValid: false without contacting RAOIDC when another auth provider is configured', async () => {
      const oidcValidator = new DefaultRaoidcSessionValidator(
        {
          AUTH_PROVIDER: 'oidc',
          AUTH_OIDC_ISSUER_URL: 'https://isams.example.com/oauth2',
          AUTH_OIDC_CLIENT_ID: 'client-id',
          AUTH_OIDC_REDIRECT_URI: 'https://cdcp.example.com/auth/callback/oidc',
          AUTH_OIDC_PRIVATE_KEY: Redacted.make('key'),
          AUTH_OIDC_PRIVATE_KEY_ID: 'kid',
          AUTH_OIDC_CLIENT_ASSERTION_AUDIENCE: 'token-endpoint',
          HTTP_PROXY_URL: undefined,
        },
        mockHttpClient,
      );
      vi.mocked(validateSession).mockClear();
      mockSession.find.calledWith('idToken').mockReturnValue(Option.some({ sid: 'session-id' } as IdToken));
      mockSession.find.calledWith('userInfoToken').mockReturnValue(Option.some({ mocked: true } as UserinfoToken));

      const result = await oidcValidator.validateRaoidcSession({ session: mockSession });

      expect(result).toEqual({ isValid: false, errorMessage: 'RAOIDC session validation failed; RAOIDC is not the configured auth provider [test-session-id]' });
      expect(validateSession).not.toHaveBeenCalled();
    });
  });
});
