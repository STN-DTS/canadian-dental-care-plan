import { describe, expect, it } from 'vitest';

import { DefaultBearerTokenResolver } from '~/.server/auth/bearer-token-resolver';

describe('DefaultBearerTokenResolver', () => {
  it('should resolve a bearer token from the authorization header', () => {
    const bearerTokenResolver = new DefaultBearerTokenResolver();

    const token = '00000000-0000-0000-0000-000000000000';
    const headers = { authorization: `Bearer ${token}` };
    const request = new Request('https://example.com', { headers: headers });

    expect(bearerTokenResolver.resolve(request)).toEqual(token);
  });

  it('should resolve a bearer token from the authorization header with extra spaces', () => {
    const bearerTokenResolver = new DefaultBearerTokenResolver();

    const token = '00000000-0000-0000-0000-000000000000';
    const headers = { authorization: `Bearer    ${token}` };
    const request = new Request('https://example.com', { headers: headers });

    expect(bearerTokenResolver.resolve(request)).toEqual(token);
  });

  it('should return undefined if the authorization header is not set', () => {
    const bearerTokenResolver = new DefaultBearerTokenResolver();
    const request = new Request('https://example.com');

    expect(bearerTokenResolver.resolve(request)).toBeUndefined();
  });

  it('should return undefined if the authorization header does not contain a bearer token', () => {
    const bearerTokenResolver = new DefaultBearerTokenResolver();

    const headers = { authorization: 'Basic 00000000-0000-0000-0000-000000000000' };
    const request = new Request('https://example.com', { headers: headers });

    expect(bearerTokenResolver.resolve(request)).toBeUndefined();
  });
});
