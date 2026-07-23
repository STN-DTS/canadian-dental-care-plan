import { None, Some } from 'oxide.ts';
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

vi.mock('~/.server/utils/raoidc-utils');

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
      AUTH_RAOIDC_BASE_URL: 'https://auth.example.com',
      AUTH_RAOIDC_CLIENT_ID: 'client-id',
      HTTP_PROXY_URL: 'https://proxy.example.com',
    };

    mockSession = mock<Session>({ id: 'test-session-id' });

    validator = new DefaultRaoidcSessionValidator(mockServerConfig, mockHttpClient);
  });

  describe('validateRaoidcSession', () => {
    it('should return isValid: false if idToken is not found in session', async () => {
      mockSession.find.calledWith('idToken').mockReturnValueOnce(None);

      const result = await validator.validateRaoidcSession({ session: mockSession });

      expect(result).toEqual({ isValid: false, errorMessage: 'RAOIDC session validation failed; idToken not found in session [test-session-id]' });
      expect(mockLogger.debug).toHaveBeenCalledWith('idToken not found in session [%s]', 'test-session-id');
    });

    it('should return isValid: false if userInfoToken is not found in session', async () => {
      mockSession.find.calledWith('idToken').mockReturnValueOnce(Some({ sid: 'session-id' } as IdToken));
      mockSession.find.calledWith('userInfoToken').mockReturnValueOnce(None);

      const result = await validator.validateRaoidcSession({ session: mockSession });

      expect(result).toEqual({ isValid: false, errorMessage: 'RAOIDC session validation failed; userInfoToken not found in session [test-session-id]' });
      expect(mockLogger.debug).toHaveBeenCalledWith('userInfoToken not found in session [%s]', 'test-session-id');
    });

    it('should return isValid: true if session is mocked', async () => {
      mockSession.find.calledWith('idToken').mockReturnValueOnce(Some({ sid: 'session-id' } as IdToken));
      mockSession.find.calledWith('userInfoToken').mockReturnValueOnce(Some({ mocked: true } as UserinfoToken));

      const result = await validator.validateRaoidcSession({ session: mockSession });

      expect(result).toEqual({ isValid: true });
      expect(mockLogger.debug).toHaveBeenCalledWith('Mocked user; skipping RAOIDC session [%s] validation', 'test-session-id');
    });

    it('should return isValid: false if session is expired', async () => {
      mockSession.find.calledWith('idToken').mockReturnValueOnce(Some({ sid: 'session-id' } as IdToken));
      mockSession.find.calledWith('userInfoToken').mockReturnValueOnce(Some({ mocked: false } as UserinfoToken));
      vi.mocked(validateSession).mockResolvedValueOnce(false);

      const result = await validator.validateRaoidcSession({ session: mockSession });

      expect(result).toEqual({ isValid: false, errorMessage: 'RAOIDC session validation failed; session [test-session-id] has expired' });
      expect(mockLogger.debug).toHaveBeenCalledWith('RAOIDC session [%s] has expired', 'test-session-id');
    });

    it('should return isValid: true if session is valid', async () => {
      mockSession.find.calledWith('idToken').mockReturnValueOnce(Some({ sid: 'session-id' } as IdToken));
      mockSession.find.calledWith('userInfoToken').mockReturnValueOnce(Some({ mocked: false } as UserinfoToken));
      vi.mocked(validateSession).mockResolvedValueOnce(true);

      const result = await validator.validateRaoidcSession({ session: mockSession });

      expect(result).toEqual({ isValid: true });
      expect(mockLogger.debug).toHaveBeenCalledWith('Authentication check passed for RAOIDC session [%s]', 'test-session-id');
    });
  });
});
