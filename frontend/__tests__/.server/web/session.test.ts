import { Option } from 'effect';
import type { Request } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { MockProxy } from 'vitest-mock-extended';

import { createLogger } from '~/.server/logging';
import type { Logger } from '~/.server/logging';
import { ExpressSession, NoopSession } from '~/.server/web/session';
import type { SessionKey } from '~/.server/web/session';

describe('Session', () => {
  describe('ExpressSession', () => {
    let mockLogger: MockProxy<Logger>;
    let mockRequest: Pick<Request, 'session'>;

    beforeEach(() => {
      mockLogger = mock<Logger>();

      vi.mocked(createLogger).mockReturnValue(mockLogger);
      mockRequest = {
        session: {
          cookie: mock<Request['session']['cookie']>(),
          destroy: vi.fn().mockImplementation((callback: (err: unknown) => void) => callback(undefined)),
          id: 'mockSessionId',
          regenerate: vi.fn().mockImplementation((callback: (err: unknown) => void) => callback(undefined)),
          reload: vi.fn(),
          resetMaxAge: vi.fn(),
          save: vi.fn().mockImplementation((callback: (err: unknown) => void) => callback(undefined)),
          touch: vi.fn(),
        },
      };
    });

    it('should initialize correctly', () => {
      const session = new ExpressSession(mockRequest);
      expect(session.id).toBe('mockSessionId');
    });

    describe('has', () => {
      it('should return true if key exists', () => {
        mockRequest.session.key = 'value';
        const session = new ExpressSession(mockRequest);
        expect(session.has('key' as SessionKey)).toBe(true);
      });

      it('should return false if key does not exist', () => {
        const session = new ExpressSession(mockRequest);
        expect(session.has('key' as SessionKey)).toBe(false);
      });

      it('should return false if key is reserved', () => {
        const session = new ExpressSession(mockRequest);
        expect(session.has('id' as SessionKey)).toBe(false);
      });

      it('should sanitize the key', () => {
        mockRequest.session['_sanitized_key___$__'] = 'value';
        const session = new ExpressSession(mockRequest);
        expect(session.has(' sanitized key!@#$%^' as SessionKey)).toBe(true);
      });
    });

    describe('find', () => {
      it('should return the value if key exists', () => {
        mockRequest.session.key = 'value';
        const session = new ExpressSession(mockRequest);
        expect(Option.getOrThrow(session.find('key' as SessionKey))).toBe('value');
      });

      it.each([null, undefined])('should preserve a present key with a nullish value [%s]', (value) => {
        mockRequest.session['authReturnUrl'] = value;
        const session = new ExpressSession(mockRequest);
        const result = session.find('authReturnUrl');

        expect(Option.isSome(result)).toBe(true);
        expect(Option.getOrThrow(result)).toBe(value);
      });

      it('should return undefined if key does not exist', () => {
        const session = new ExpressSession(mockRequest);
        expect(Option.isNone(session.find('key' as SessionKey))).toBe(true);
      });

      it('should sanitize the key', () => {
        mockRequest.session['_sanitized_key___$__'] = 'value';
        const session = new ExpressSession(mockRequest);
        expect(Option.getOrThrow(session.find(' sanitized key!@#$%^' as SessionKey))).toBe('value');
      });
    });

    describe('get', () => {
      it('should return the value if key exists', () => {
        mockRequest.session.key = 'value';
        const session = new ExpressSession(mockRequest);
        expect(session.get('key' as SessionKey)).toBe('value');
      });

      it('should throw an error if key does not exist', () => {
        const session = new ExpressSession(mockRequest);
        expect(() => session.get('key' as SessionKey)).toThrowError("Key 'key' not found in session [mockSessionId]");
      });

      it('should sanitize the key', () => {
        mockRequest.session['_sanitized_key___$__'] = 'value';
        const session = new ExpressSession(mockRequest);
        expect(session.get(' sanitized key!@#$%^' as SessionKey)).toBe('value');
      });
    });

    describe('set', () => {
      it('should set the value and call save', () => {
        const session = new ExpressSession(mockRequest);
        session.set('key' as SessionKey, 'value');
        expect(mockRequest.session.key).toBe('value');
      });

      it('should sanitize the key', () => {
        const session = new ExpressSession(mockRequest);
        session.set(' sanitized key!@#$%^' as SessionKey, 'value');
        expect(mockRequest.session['_sanitized_key___$__']).toBe('value');
      });
    });

    describe('unset', () => {
      it('should unset the value and call save', () => {
        mockRequest.session.key = 'value';
        const session = new ExpressSession(mockRequest);
        expect(session.unset('key' as SessionKey)).toBe(true);
      });

      it('should return false if key does not exist', () => {
        const session = new ExpressSession(mockRequest);
        expect(session.unset('key' as SessionKey)).toBe(false);
        expect(mockRequest.session.save).not.toHaveBeenCalled();
      });

      it('should sanitize the key', () => {
        mockRequest.session._sanitized_key___$__ = 'value';
        const session = new ExpressSession(mockRequest);
        expect(session.unset(' sanitized key!@#$%^' as SessionKey)).toBe(true);
        expect(mockRequest.session['_sanitized_key___$__']).toBeUndefined();
      });
    });

    describe('destroy', () => {
      it('should destroy the session', async () => {
        const session = new ExpressSession(mockRequest);
        await session.destroy();
        expect(mockRequest.session.destroy).toHaveBeenCalledOnce();
      });
    });

    describe('save', () => {
      it('should save the session', async () => {
        const session = new ExpressSession(mockRequest);
        await session.save();
        expect(mockRequest.session.save).toHaveBeenCalledOnce();
      });
    });

    describe('sanitizeKey', () => {
      it('should sanitize the key', () => {
        const session = new ExpressSession(mockRequest);
        const sanitizedKey = session['sanitizeKey'](' sanitized key!@#$%^');
        expect(sanitizedKey).toBe('_sanitized_key___$__');
      });

      it('should throw an error if key is empty', () => {
        const session = new ExpressSession(mockRequest);
        expect(() => session['sanitizeKey'](' ')).toThrowError('Session key cannot be empty');
      });

      it('should prepend an underscore if the key starts with a number', () => {
        const session = new ExpressSession(mockRequest);
        const sanitizedKey = session['sanitizeKey']('123key');
        expect(sanitizedKey).toBe('_123key');
      });
    });

    describe('assertNotReservedKey', () => {
      it('should not throw an error if the key is not reserved', () => {
        const session = new ExpressSession(mockRequest);
        expect(() => session['assertNotReservedKey']('test-key')).not.toThrowError();
      });

      it.each(ExpressSession.SESSION_RESERVED_KEYS)('should throw an error if the key [%s] is reserved', (key) => {
        const session = new ExpressSession(mockRequest);
        expect(() => session['assertNotReservedKey'](key)).toThrowError(`Session key '${key}' is reserved`);
      });
    });
  });

  describe('NoopSession', () => {
    let session: NoopSession;

    beforeEach(() => {
      session = new NoopSession();
    });

    it('should throw error on id access', () => {
      expect(() => session.id).toThrowError('No session available in stateless context');
    });

    it('should always return false for has', () => {
      expect(session.has('anyKey' as SessionKey)).toBe(false);
    });

    it('should always return undefined for find', () => {
      expect(Option.isNone(session.find('anyKey' as SessionKey))).toBe(true);
    });

    it('should throw error on get', () => {
      expect(() => session.get('anyKey' as SessionKey)).toThrowError('No session available in stateless context');
    });

    it('should throw error on set', () => {
      expect(() => session.set('anyKey' as SessionKey, 'anyValue')).toThrowError('No session available in stateless context');
    });

    it('should always return false for unset', () => {
      expect(session.unset('anyKey' as SessionKey)).toBe(false);
    });

    it('should not throw error on destroy', async () => {
      await expect(session.destroy()).resolves.toBeUndefined();
    });

    it('should not throw error on save', async () => {
      await expect(session.save()).resolves.toBeUndefined();
    });
  });
});
