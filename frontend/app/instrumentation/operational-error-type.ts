import { ERROR_TYPE_VALUE_OTHER } from '@opentelemetry/semantic-conventions';
import { isProxy } from 'node:util/types';

const admittedCodes = new Set([
  'ECONNREFUSED',
  'ETIMEDOUT',
  'ERR_SOCKET_CONNECTION_TIMEOUT',
  'ECONNRESET',
  'ENOTFOUND',
  'EAI_AGAIN',
  'EACCES',
  'EPERM',
  'ENOENT',
  'ERR_TLS_CERT_ALTNAME_INVALID',
  'CERT_HAS_EXPIRED',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
]);

/**
 * Reports verified Error constructor names without reading instance-controlled
 * names, messages, codes or causes. Safe for the SDK preload.
 */
export function operationalErrorType(error: unknown): string {
  if (!Error.isError(error)) {
    return ERROR_TYPE_VALUE_OTHER;
  }

  const prototype: object | null = Object.getPrototypeOf(error);

  if (prototype && isProxy(prototype)) {
    return 'Error';
  }

  const constructor: unknown = prototype && Object.getOwnPropertyDescriptor(prototype, 'constructor')?.value;

  if (typeof constructor === 'function' && !isProxy(constructor)) {
    const name: unknown = Object.getOwnPropertyDescriptor(constructor, 'name')?.value;

    if (typeof name === 'string' && /^[A-Za-z_$][\w$]{0,127}$/.test(name)) {
      return name;
    }
  }

  return 'Error';
}

/** Returns only known system codes from verified Errors, without invoking getters. */
export function operationalErrorCode(error: unknown): string | undefined {
  if (!Error.isError(error)) {
    return undefined;
  }

  const code: unknown = Object.getOwnPropertyDescriptor(error, 'code')?.value;

  return typeof code === 'string' && admittedCodes.has(code) ? code : undefined;
}
