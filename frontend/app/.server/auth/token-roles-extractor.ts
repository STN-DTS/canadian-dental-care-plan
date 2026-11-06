import { ATTR_ERROR_TYPE } from '@opentelemetry/semantic-conventions';
import { injectable } from 'inversify';
import { createRemoteJWKSet, decodeJwt, jwtVerify } from 'jose';

import { createLogger } from '~/.server/logging';
import type { Logger } from '~/.server/logging';

export interface TokenRolesExtractor {
  extract(jwt?: string): Promise<string[]>;
}

@injectable()
export class DefaultTokenRolesExtractor implements TokenRolesExtractor {
  private readonly log: Logger;
  private readonly audience: string;
  private readonly issuer: string;
  private readonly jwksUrl?: string;

  constructor(audience: string, issuer: string, jwksUrl?: string) {
    this.log = createLogger('DefaultTokenRolesExtractor');
    this.audience = audience;
    this.issuer = issuer;
    this.jwksUrl = jwksUrl;
  }

  async extract(jwt?: string): Promise<string[]> {
    this.log.trace('Extracting roles from token');

    if (jwt === undefined) {
      this.log.warn('Could not extract roles: no token provided');
      return [];
    }

    const roles = this.jwksUrl ? await this.decodeAndVerifyJwt(this.jwksUrl, jwt) : this.decodeJwt(jwt);
    this.log.debug('Token role extraction finished');
    return roles;
  }

  private decodeJwt(jwt: string): string[] {
    this.log.warn('JWT verification cannot be performed: JWK endpoint not configured');
    this.log.trace('Decoding token without signature verification');

    try {
      const { roles } = decodeJwt<{ roles?: string[] }>(jwt);
      this.log.trace('Token decoded without signature verification');
      return roles ?? [];
    } catch {
      this.log.error('Could not decode token roles', { [ATTR_ERROR_TYPE]: 'token_decode_failed' });
      return [];
    }
  }

  private async decodeAndVerifyJwt(jwksUrl: string, jwt: string): Promise<string[]> {
    this.log.debug('Verifying token using configured JWK endpoint');

    const getKey = createRemoteJWKSet(new URL(jwksUrl));
    const options = { audience: this.audience, issuer: this.issuer };

    try {
      const { payload } = await jwtVerify<{ roles?: string[] }>(jwt, getKey, options);
      this.log.trace('Token signature and claims verified');
      return payload.roles ?? [];
    } catch {
      this.log.error('Could not verify token roles', { [ATTR_ERROR_TYPE]: 'token_verification_failed' });
      return [];
    }
  }
}
