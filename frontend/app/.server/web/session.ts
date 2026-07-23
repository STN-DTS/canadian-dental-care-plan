import type { Request } from 'express';
import assert from 'node:assert';
import type { Option } from 'oxide.ts';
import { None, Some } from 'oxide.ts';
import validator from 'validator';

import type { ApplicantDto, LetterDto } from '~/.server/domain/dtos';
import { createLogger } from '~/.server/logging';
import type { Logger } from '~/.server/logging';
import type { ProtectedApplicationState, ProtectedApplicationStateSessionKey } from '~/.server/routes/helpers/protected-application-route-helpers';
import type { PublicApplicationState, PublicApplicationStateSessionKey } from '~/.server/routes/helpers/public-application-route-helpers';
import type { StatusState, StatusStateSessionKey } from '~/.server/routes/helpers/status-route-helpers';
import type { IdToken, UserinfoToken } from '~/.server/utils/raoidc-utils';

/**
 * Defines the mapping of valid session keys to their corresponding value types.
 * Each property represents a key that can be stored in the session, and its value type.
 *
 * Extend this interface to add more session keys and their types as needed.
 */
type SessionTypeMap = {
  [K in PublicApplicationStateSessionKey]: PublicApplicationState;
} & {
  [K in ProtectedApplicationStateSessionKey]: ProtectedApplicationState;
} & {
  [K in StatusStateSessionKey]: StatusState;
} & {
  authCodeVerifier: string;
  authReturnUrl: string;
  authState: string;
  applicant: ApplicantDto;
  csrfToken: string;
  idToken: IdToken;
  lastAccessTime: string;
  letters: ReadonlyArray<LetterDto>;
  userInfoToken: UserinfoToken;
  profileEmailAddressFlowState: {
    emailAddress: string;
    verificationCode: string;
    verificationAttempts: number;
  } & (
    | {
        context?: 'contact';
        preferredLanguage?: undefined;
        preferredMethodSunLife?: undefined;
        preferredMethodGovernmentOfCanada?: undefined;
      }
    | {
        context: 'communication-preferences';
        preferredLanguage: string;
        preferredMethodSunLife: string;
        preferredMethodGovernmentOfCanada: string;
      }
  );
};

/**
 * Represents the set of valid keys for session data.
 * This type is derived from the keys of SessionTypeMap and is used to constrain
 * session operations to only valid, type-safe keys.
 */
export type SessionKey = keyof SessionTypeMap;

/**
 * Interface representing a session management system.
 * This interface defines methods to interact with session data in a type-safe manner.
 *
 * A session is typically a persistent object that stores user-related data across multiple requests.
 * Implementations of this interface should provide access to session data and allow modification or
 * removal of session keys and values.
 */
export interface Session {
  /**
   * The unique ID of the session.
   * @returns The session ID.
   */
  id: string;

  /**
   * Checks whether a specific session key exists.
   *
   * This method allows checking if a key is present in the session.
   *
   * @param key The session key to check.
   * @returns True if the key exists in the session, false otherwise.
   */
  has(key: SessionKey): boolean;

  /**
   * Finds a value in the session by its key.
   *
   * Retrieves the value associated with the given session key, wrapped in an Option.
   * Returns `None` if the key does not exist or is reserved. This method is useful
   * for safely accessing session data without throwing errors.
   *
   * @param key The session key to look up.
   * @returns An Option containing the value if present, or None if not found.
   */
  find<K extends SessionKey>(key: K): Option<SessionTypeMap[K]>;

  /**
   * Retrieves a value from the session by its key.
   *
   * This method works similarly to `find()`, but it throws an error if the key does not exist in the session.
   *
   * @param key The session key to retrieve.
   * @returns The value associated with the session key.
   * @throws Throws an error if the key is not found in the session.
   */
  get<K extends SessionKey>(key: K): SessionTypeMap[K];

  /**
   * Sets a value in the session for a given key.
   *
   * This method allows modifying or adding a new key-value pair in the session.
   *
   * @param key The session key to set.
   * @param value The value to set for the session key.
   */
  set<K extends SessionKey>(key: K, value: SessionTypeMap[K]): void;

  /**
   * Removes a key-value pair from the session.
   *
   * This method unsets a session key and its associated value.
   *
   * @param key The session key to remove.
   * @returns Returns true if the key was removed successfully, false if the key doesn't exist.
   */
  unset(key: SessionKey): boolean;

  /**
   * Destroys the current session.
   *
   * This method will destroy the session, removing all session data and invalidating the session ID.
   *
   * @returns A promise that resolves once the session has been destroyed. The promise will reject if
   * the underlying store destroy operation fails.
   */
  destroy(): Promise<void>;

  /**
   * Saves the current session back to the store.
   *
   * This method will Save the session back to the store, replacing the contents on the store with
   * the contents in memory (though a store may do something else--consult the store's documentation
   * for exact behavior).
   *
   * @returns A promise that resolves once the session has been saved. The promise will reject if
   * the underlying store save operation fails.
   */
  save(): Promise<void>;

  /**
   * Regenerates the current session. Once complete, a new SID and Session instance will be initialized.
   *
   * This is useful to avoid session fixation attacks.
   *
   * @returns A promise that resolves once the session has been regenerated. The promise will reject if
   * the underlying store regenerate operation fails.
   */
  regenerate(): Promise<void>;
}

/**
 * Wrapper around the Express session object. Provides a type-safe and convenient API for session management.
 */
export class ExpressSession implements Session {
  private readonly req: Pick<Request, 'session'>;
  static readonly SESSION_RESERVED_KEYS = ['id', 'cookie', 'regenerate', 'destroy', 'reload', 'resetMaxAge', 'save', 'touch'] as const;

  private readonly log: Logger;

  constructor(req: Pick<Request, 'session'>) {
    assert.ok(req.session, 'req.session object is undefined. Ensure session middleware is properly configured.');
    this.req = req;
    this.log = createLogger('~/.server/web/ExpressSession');
    this.log.trace('Session initialized with ID: %s', this.id);
  }

  private get session(): Request['session'] {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!this.req.session) {
      throw new Error('req.session object is undefined. Session might have been destroyed.');
    }

    return this.req.session;
  }

  get id(): string {
    return this.session.id;
  }

  has(key: SessionKey): boolean {
    const sanitizedKey = this.sanitizeKey(key);
    if (this.isReservedKey(sanitizedKey)) return false;
    const exists = sanitizedKey in this.session;
    this.log.trace('Session [%s]: Checking for key "%s", exists: %s', this.id, key, exists);
    return exists;
  }

  find<K extends SessionKey>(key: K): Option<SessionTypeMap[K]> {
    if (!this.has(key)) {
      this.log.trace('Session [%s]: Key "%s" not found', this.id, key);
      return None;
    }
    const sanitizedKey = this.sanitizeKey(key);
    const value = this.session[sanitizedKey] as SessionTypeMap[K];
    this.log.trace('Session [%s]: Found key "%s"', this.id, key);
    return Some(value);
  }

  get<K extends SessionKey>(key: K): SessionTypeMap[K] {
    const value = this.find(key);
    if (value.isNone()) {
      this.log.error('Session [%s]: Attempted to get non-existent key "%s"', this.id, key);
      throw new Error(`Key '${key}' not found in session [${this.id}]`);
    }

    const unwrappedValue = value.unwrap();
    this.log.trace('Session [%s]: Retrieved value for key "%s": %j', this.id, key, unwrappedValue);
    return unwrappedValue;
  }

  set<K extends SessionKey>(key: K, value: SessionTypeMap[K]): void {
    const sanitizedKey = this.sanitizeKey(key);
    this.assertNotReservedKey(sanitizedKey);
    this.session[sanitizedKey] = value;
    this.log.trace('Session [%s]: Set key "%s" to value: %j', this.id, key, value);
  }

  unset(key: SessionKey): boolean {
    if (!this.has(key)) {
      this.log.warn('Session [%s]: Attempted to unset non-existent key "%s"', this.id, key);
      return false;
    }

    const sanitizedKey = this.sanitizeKey(key);
    this.assertNotReservedKey(sanitizedKey);
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete this.session[sanitizedKey];
    this.log.trace('Session [%s]: Unset key "%s"', this.id, key);
    return true;
  }

  async destroy(): Promise<void> {
    const id = this.id; // Capture ID before destruction for logging
    this.log.debug('Destroying session [%s]', id);
    return await new Promise((resolve, reject) => {
      this.session.destroy((err) => {
        if (err) {
          this.log.error('Failed to destroy session %s: %s', id, err.message);
          return reject(err);
        }

        this.log.info('Session %s destroyed successfully', id);
        resolve();
      });
    });
  }

  async save(): Promise<void> {
    this.log.debug('Saving session [%s]', this.id);
    return await new Promise((resolve, reject) => {
      this.session.save((err) => {
        if (err) {
          this.log.error('Failed to save session %s: %s', this.id, err.message);
          return reject(err);
        }

        this.log.info('Session %s saved successfully', this.id);
        resolve();
      });
    });
  }

  async regenerate(): Promise<void> {
    const originalId = this.id;
    this.log.debug('Regenerating session. Original ID: %s', originalId);

    return await new Promise((resolve, reject) => {
      this.session.regenerate((err) => {
        if (err) {
          this.log.error('Failed to regenerate session %s: %s', originalId, err.message);
          return reject(err);
        }

        this.log.info('Session %s regenerated successfully; new ID: %s', originalId, this.id);
        resolve();
      });
    });
  }

  protected sanitizeKey(key: string): string {
    assert.ok(!validator.isEmpty(key, { ignore_whitespace: true }), 'Session key cannot be empty');
    let sanitized = key.replaceAll(/[^a-zA-Z0-9_$]/g, '_');
    if (!/^[a-zA-Z_$]/.test(sanitized)) {
      sanitized = '_' + sanitized;
    }
    return sanitized;
  }

  protected isReservedKey(key: string): boolean {
    return ExpressSession.SESSION_RESERVED_KEYS.includes(key as (typeof ExpressSession.SESSION_RESERVED_KEYS)[number]);
  }

  protected assertNotReservedKey(key: string): void {
    assert.ok(!this.isReservedKey(key), `Session key '${key}' is reserved and cannot be used.`);
  }
}

/**
 * A session implementation for stateless requests where session management is not needed.
 * This class logs warnings or errors when session-related methods are called to aid debugging.
 */
export class NoopSession implements Session {
  private readonly log = createLogger('~/.server/web/NoopSession');

  get id(): string {
    this.log.error('Accessed "id" on NoopSession. This indicates a misuse of session in a stateless context.');
    throw new Error('No session available in stateless context');
  }

  has(key: SessionKey): boolean {
    this.log.warn('Called "has" on NoopSession for key "%s". Returning false.', key);
    return false;
  }

  find<K extends SessionKey>(key: K): Option<SessionTypeMap[K]> {
    this.log.warn('Called "find" on NoopSession for key "%s". Returning None.', key);
    return None;
  }

  get<K extends SessionKey>(key: K): SessionTypeMap[K] {
    this.log.error('Called "get" on NoopSession for key "%s". This is a misuse of session in a stateless context.', key);
    throw new Error('No session available in stateless context');
  }

  set<K extends SessionKey>(key: K, value: SessionTypeMap[K]): void {
    this.log.error('Called "set" on NoopSession for key "%s". This is a misuse of session in a stateless context.', key);
    throw new Error('No session available in stateless context');
  }

  unset(key: SessionKey): boolean {
    this.log.warn('Called "unset" on NoopSession for key "%s". Returning false.', key);
    return false;
  }

  async destroy(): Promise<void> {
    this.log.warn('Called "destroy" on NoopSession. No operation is performed.');
    // No operation; no session to destroy in a stateless context.
    return await Promise.resolve();
  }

  async save(): Promise<void> {
    this.log.warn('Called "save" on NoopSession. No operation is performed.');
    // No operation; no session to save in a stateless context.
    return await Promise.resolve();
  }

  async regenerate(): Promise<void> {
    this.log.warn('Called "regenerate" on NoopSession. No operation is performed.');
    // No operation; no session to regenerate in a stateless context.
    return await Promise.resolve();
  }
}
