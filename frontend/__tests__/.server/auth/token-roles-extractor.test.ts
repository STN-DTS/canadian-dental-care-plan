import type { JWTVerifyResult, ResolvedKey } from 'jose';
import { decodeJwt, jwtVerify } from 'jose';
import { describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { DefaultTokenRolesExtractor } from '~/.server/auth/token-roles-extractor';

vi.mock(import('jose'), () => ({
  createRemoteJWKSet: vi.fn(),
  decodeJwt: vi.fn(),
  jwtVerify: vi.fn(),
}));

describe('DefaultTokenRolesExtractor', () => {
  describe('decodeJwt', () => {
    const tokenRolesExtractor = new DefaultTokenRolesExtractor('audience', 'issuer');

    it('should return an empty array if the token does not contain roles', () => {
      vi.mocked(decodeJwt).mockReturnValue({});
      const roles = tokenRolesExtractor['decodeJwt']('token');
      expect(roles).toEqual([]);
    });

    it('should return the roles from the token', () => {
      vi.mocked(decodeJwt).mockReturnValue({ roles: ['admin'] });
      const roles = tokenRolesExtractor['decodeJwt']('token');
      expect(roles).toEqual(['admin']);
    });
  });

  describe('decodeAndVerifyJwt', () => {
    const tokenRolesExtractor = new DefaultTokenRolesExtractor('audience', 'issuer');

    it('should return an empty array if the token does not contain roles', async () => {
      vi.mocked(jwtVerify).mockResolvedValue(
        mock<JWTVerifyResult & ResolvedKey>({
          payload: { roles: undefined },
        }),
      );

      const roles = await tokenRolesExtractor['decodeAndVerifyJwt']('https://auth.example.com/jwks.json', 'token');
      expect(roles).toEqual([]);
    });

    it('should return the roles from the token', async () => {
      vi.mocked(jwtVerify).mockResolvedValue(
        mock<JWTVerifyResult & ResolvedKey>({
          payload: {
            roles: ['admin'],
          },
        }),
      );

      const roles = await tokenRolesExtractor['decodeAndVerifyJwt']('https://auth.example.com/jwks.json', 'token');
      expect([...roles]).toEqual(['admin']);
    });
  });

  describe('extract', () => {
    const tokenRolesExtractor = new DefaultTokenRolesExtractor('audience', 'issuer');

    it('should return an empty array if the token is undefined', async () => {
      expect(await tokenRolesExtractor.extract(undefined)).toEqual([]);
    });
  });
});
