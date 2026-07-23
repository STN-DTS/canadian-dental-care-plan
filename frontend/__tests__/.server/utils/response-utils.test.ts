import { describe, expect, it } from 'vitest';

import { isRedirectResponse, isRedirectStatusCode, isResponse, redirectStatusCodes } from '~/.server/utils/response-utils';

describe('response-utils', () => {
  describe('redirectStatusCodes', () => {
    it('should contain the correct redirect status codes', () => {
      expect(redirectStatusCodes).toEqual(new Set([301, 302, 303, 307, 308]));
    });
  });

  describe('isRedirectStatusCode', () => {
    it('should return true for redirect status codes', () => {
      expect(isRedirectStatusCode(301)).toBe(true);
      expect(isRedirectStatusCode(302)).toBe(true);
      expect(isRedirectStatusCode(303)).toBe(true);
      expect(isRedirectStatusCode(307)).toBe(true);
      expect(isRedirectStatusCode(308)).toBe(true);
    });

    it('should return false for non-redirect status codes', () => {
      expect(isRedirectStatusCode(200)).toBe(false);
      expect(isRedirectStatusCode(404)).toBe(false);
      expect(isRedirectStatusCode(500)).toBe(false);
    });
  });

  describe('isResponse', () => {
    it('should return true for a valid Response object', () => {
      const response = new Response('body', { status: 200, statusText: 'OK', headers: { 'Content-Type': 'text/plain' } });
      expect(isResponse(response)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isResponse(null)).toBe(false);
    });

    it('should return false for various invalid values', () => {
      expect(isResponse(undefined)).toBe(false);
      expect(isResponse({})).toBe(false);
      expect(isResponse({ status: 200 })).toBe(false);
      expect(isResponse({ status: 200, statusText: 'OK' })).toBe(false);
      expect(isResponse({ status: 200, statusText: 'OK', headers: {} })).toBe(false);
      expect(isResponse({ status: '200', statusText: 'OK', headers: {}, body: 'body' })).toBe(false);
      expect(isResponse('string')).toBe(false);
      expect(isResponse(123)).toBe(false);
      expect(isResponse(true)).toBe(false);
    });

    it('should handle a Response object without a body', () => {
      const response = new Response(undefined, { status: 204, statusText: 'No Content' }); // 204 intentionally has no body
      expect(isResponse(response)).toBe(true);
    });
  });

  describe('isRedirectResponse', () => {
    it('should return true for a valid redirect Response', () => {
      const response = new Response(null, { status: 302, headers: { Location: '/home' } });
      expect(isRedirectResponse(response)).toBe(true);
    });

    it('should return false for various invalid values', () => {
      expect(isRedirectResponse(null)).toBe(false);
      expect(isRedirectResponse(undefined)).toBe(false);
      expect(isRedirectResponse({})).toBe(false);
      expect(isRedirectResponse(new Response(null, { status: 200 }))).toBe(false);
      expect(isRedirectResponse(new Response(null, { status: 302 }))).toBe(false);
      expect(isRedirectResponse(new Response(null, { headers: { Location: '/home' } }))).toBe(false);
      expect(isRedirectResponse('string')).toBe(false);
      expect(isRedirectResponse(123)).toBe(false);
      expect(isRedirectResponse(true)).toBe(false);
      expect(isRedirectResponse({ status: 302, headers: { Location: '/home' } })).toBe(false);
    });
  });
});
