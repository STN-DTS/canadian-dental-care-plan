import { ATTR_SESSION_ID, ATTR_SESSION_PREVIOUS_ID } from '@opentelemetry/semantic-conventions/incubating';
import { Option } from 'effect';
import type { Request } from 'express';
import assert from 'node:assert';

import { deleteSessionStorage } from '~/.server/data/session-storage';
import type { ApplicantDto, LetterDto, ProgramApplicantDto } from '~/.server/domain/dtos';
import { createLogger } from '~/.server/logging';
import type { Logger } from '~/.server/logging';
// Session attributes are currently incubating OpenTelemetry conventions.
import { ATTR_CDCP_SESSION_KEY, ATTR_CDCP_SESSION_KEY_EXISTS } from '~/.server/logging/log-attributes';
import { Traced } from '~/.server/observability/decorator';
import { throwAppError } from '~/.server/utils/error-utils';
import type { IdToken, UserinfoToken } from '~/.server/utils/raoidc-utils';
import { ErrorCodes } from '~/errors/error-codes';
import { isEmpty } from '~/utils/string-utils';

/**
 * Defines the mapping of valid session keys to their corresponding value types.
 * Each property represents a key that can be stored in the session, and its value type.
 *
 * Extend this interface to add more session keys and their types as needed.
 */
type SessionTypeMap = {
  applicant: ApplicantDto;
  authCodeVerifier: string;
  authReturnUrl: string;
  authState: string;
  idToken: IdToken;
  letters: ReadonlyArray<LetterDto>;
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
  programApplicant: ProgramApplicantDto;
  userInfoToken: UserinfoToken;
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
  find<K extends SessionKey>(key: K): Option.Option<SessionTypeMap[K]>;

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
   * Marks an otherwise empty session as initialized so `express-session`
   * persists it and sends a session cookie even when `saveUninitialized` is `false`.
   *
   * Has no effect if the session already holds data, avoiding redundant saves
   * when `resave` is `false`.
   */
  initialize(): void;

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
  private static readonly SESSION_INITIALIZED_KEY = '__initializedAt';
  static readonly SESSION_RESERVED_KEYS = ['id', 'cookie', 'regenerate', 'destroy', 'reload', 'resetMaxAge', 'save', 'touch'] as const;

  private readonly log: Logger;

  constructor(req: Pick<Request, 'session'>) {
    assert.ok(req.session, 'req.session object is undefined. Ensure session middleware is properly configured.');
    this.req = req;
    this.log = createLogger('~/.server/web/ExpressSession');
    this.log.trace('Session initialized', { [ATTR_SESSION_ID]: this.id });
  }

  private get session(): Request['session'] {
    // oxlint-disable-next-line typescript/no-unnecessary-condition
    if (!this.req.session) {
      throwAppError('Express session missing or destroyed.', ErrorCodes.PLT_SESS_EXPRESS_SESSION_UNAVAILABLE);
    }

    return this.req.session;
  }

  get id(): string {
    return this.session.id;
  }

  has(key: SessionKey): boolean {
    const sanitizedKey = this.sanitizeKey(key);

    if (this.isReservedKey(sanitizedKey)) {
      return false;
    }

    const exists = sanitizedKey in this.session;
    this.log.trace('Checking for session key', { [ATTR_SESSION_ID]: this.id, [ATTR_CDCP_SESSION_KEY]: key, [ATTR_CDCP_SESSION_KEY_EXISTS]: exists });
    return exists;
  }

  find<K extends SessionKey>(key: K): Option.Option<SessionTypeMap[K]> {
    if (!this.has(key)) {
      this.log.trace('Session key not found', { [ATTR_SESSION_ID]: this.id, [ATTR_CDCP_SESSION_KEY]: key });
      return Option.none();
    }

    const sanitizedKey = this.sanitizeKey(key);
    const value = this.session[sanitizedKey] as SessionTypeMap[K];
    this.log.trace('Session key found', { [ATTR_SESSION_ID]: this.id, [ATTR_CDCP_SESSION_KEY]: key });
    return Option.some(value);
  }

  get<K extends SessionKey>(key: K): SessionTypeMap[K] {
    const value = this.find(key);

    if (Option.isNone(value)) {
      throwAppError('Required active-session key absent.', ErrorCodes.PLT_SESS_KEY_NOT_FOUND);
    }

    const unwrappedValue = Option.getOrThrow(value);
    this.log.trace('Session value retrieved', { [ATTR_SESSION_ID]: this.id, [ATTR_CDCP_SESSION_KEY]: key });
    return unwrappedValue;
  }

  set<K extends SessionKey>(key: K, value: SessionTypeMap[K]): void {
    const sanitizedKey = this.sanitizeKey(key);
    this.assertNotReservedKey(sanitizedKey);
    this.session[sanitizedKey] = value;
    this.log.trace('Session value set', { [ATTR_SESSION_ID]: this.id, [ATTR_CDCP_SESSION_KEY]: key });
  }

  unset(key: SessionKey): boolean {
    if (!this.has(key)) {
      this.log.debug('Cannot unset missing session key', { [ATTR_SESSION_ID]: this.id, [ATTR_CDCP_SESSION_KEY]: key });
      return false;
    }

    const sanitizedKey = this.sanitizeKey(key);
    this.assertNotReservedKey(sanitizedKey);
    delete this.session[sanitizedKey];
    this.log.trace('Session key unset', { [ATTR_SESSION_ID]: this.id, [ATTR_CDCP_SESSION_KEY]: key });
    return true;
  }

  initialize(): void {
    const hasSessionData = Object.keys(this.session).some((key) => !this.isReservedKey(key));

    if (!hasSessionData) {
      this.session[ExpressSession.SESSION_INITIALIZED_KEY] = Temporal.Now.instant().toString();
      this.log.trace('Session marked as initialized', { [ATTR_SESSION_ID]: this.id });
    }
  }

  @Traced()
  async destroy(): Promise<void> {
    const id = this.id; // Capture ID before destruction for logging
    this.log.debug('Destroying session', { [ATTR_SESSION_ID]: id });
    const expressSession = this.session;
    await Promise.all([
      deleteSessionStorage(id),
      new Promise<void>((resolve, reject) => {
        expressSession.destroy((err) => {
          if (err) {
            return reject(err);
          }

          this.log.debug('Session destroyed successfully', { [ATTR_SESSION_ID]: id });
          resolve();
        });
      }),
    ]);
  }

  @Traced()
  async save(): Promise<void> {
    this.log.debug('Saving session', { [ATTR_SESSION_ID]: this.id });
    return await new Promise((resolve, reject) => {
      this.session.save((err) => {
        if (err) {
          return reject(err);
        }

        this.log.debug('Session saved successfully', { [ATTR_SESSION_ID]: this.id });
        resolve();
      });
    });
  }

  @Traced()
  async regenerate(): Promise<void> {
    const originalId = this.id;
    this.log.debug('Regenerating session', { [ATTR_SESSION_ID]: originalId });
    const expressSession = this.session;
    await Promise.all([
      deleteSessionStorage(originalId),
      new Promise<void>((resolve, reject) => {
        expressSession.regenerate((err) => {
          if (err) {
            return reject(err);
          }

          this.log.debug('Session regenerated successfully', { [ATTR_SESSION_ID]: this.id, [ATTR_SESSION_PREVIOUS_ID]: originalId });
          resolve();
        });
      }),
    ]);
  }

  protected sanitizeKey(key: string): string {
    assert.ok(!isEmpty(key, { ignore_whitespace: true }), 'Session key cannot be empty');
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
    throw new Error('No session available in stateless context');
  }

  has(key: SessionKey): boolean {
    this.log.warn('Called "has" on NoopSession; returning false', { [ATTR_CDCP_SESSION_KEY]: key });
    return false;
  }

  find<K extends SessionKey>(key: K): Option.Option<SessionTypeMap[K]> {
    this.log.warn('Called "find" on NoopSession; returning None', { [ATTR_CDCP_SESSION_KEY]: key });
    return Option.none();
  }

  get<K extends SessionKey>(key: K): SessionTypeMap[K] {
    throw new Error('No session available in stateless context');
  }

  set<K extends SessionKey>(key: K, value: SessionTypeMap[K]): void {
    throw new Error('No session available in stateless context');
  }

  unset(key: SessionKey): boolean {
    this.log.warn('Called "unset" on NoopSession; returning false', { [ATTR_CDCP_SESSION_KEY]: key });
    return false;
  }

  initialize(): void {
    throw new Error('No session available in stateless context');
  }

  @Traced()
  async destroy(): Promise<void> {
    this.log.warn('Called "destroy" on NoopSession. No operation is performed.');
    // No operation; no session to destroy in a stateless context.
    return await Promise.resolve();
  }

  @Traced()
  async save(): Promise<void> {
    this.log.warn('Called "save" on NoopSession. No operation is performed.');
    // No operation; no session to save in a stateless context.
    return await Promise.resolve();
  }

  @Traced()
  async regenerate(): Promise<void> {
    this.log.warn('Called "regenerate" on NoopSession. No operation is performed.');
    // No operation; no session to regenerate in a stateless context.
    return await Promise.resolve();
  }
}
