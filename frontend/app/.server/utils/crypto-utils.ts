import { Buffer, atob } from 'node:buffer';
import type { KeyObject, webcrypto } from 'node:crypto';
import { createHash, createPrivateKey, subtle } from 'node:crypto';

import { createLogger } from '~/.server/logging';
/**
 * Useful utility functions for crypto stuff.
 */
import { ATTR_CDCP_CRYPTO_KEY_USAGE } from '~/.server/logging/log-attributes';

type CryptoKeyAlgorithm = 'encrypt' | 'decrypt' | 'sign' | 'verify';

/**
 * Generate a JWK ID from the modulus of the JWK.
 */
export function generateJwkId(jwk: webcrypto.JsonWebKey) {
  return createHash('md5')
    .update(jwk.n ?? '')
    .digest('hex');
}

/**
 * Parses a private key given either as PEM (with BEGIN/END lines) or as single-line base64 PKCS#8 DER, the format
 * used by `AUTH_JWT_PRIVATE_KEY`.
 *
 * @throws When the value is not a parseable private key.
 */
export function parsePrivateKey(value: string): KeyObject {
  const trimmed = value.trim();

  if (trimmed.startsWith('-----BEGIN')) {
    return createPrivateKey(trimmed);
  }

  return createPrivateKey({ key: Buffer.from(trimmed, 'base64'), format: 'der', type: 'pkcs8' });
}

interface PrivateKeyRequirements {
  /** Required key type, for example `rsa` or `ec`. */
  readonly asymmetricKeyType?: KeyObject['asymmetricKeyType'];
  /** Minimum RSA modulus length in bits. */
  readonly minModulusLength?: number;
}

/**
 * Returns true if the value parses as a private key (see {@link parsePrivateKey}) that meets the given requirements.
 */
export function isPrivateKey(value: string, { asymmetricKeyType, minModulusLength }: PrivateKeyRequirements = {}): boolean {
  let key: KeyObject;

  try {
    key = parsePrivateKey(value);
  } catch {
    return false;
  }

  if (asymmetricKeyType !== undefined && key.asymmetricKeyType !== asymmetricKeyType) {
    return false;
  }

  return minModulusLength === undefined || (key.asymmetricKeyDetails?.modulusLength ?? 0) >= minModulusLength;
}

/**
 * Converts a PEM encoded string to a webcrypto CryptoKey.
 */
export async function generateCryptoKey(pem: string, algorithm: CryptoKeyAlgorithm): Promise<webcrypto.CryptoKey> {
  const log = createLogger('crypto-utils/generateCryptoKey');
  log.trace('Converting PEM to CryptoKey', { [ATTR_CDCP_CRYPTO_KEY_USAGE]: algorithm });

  switch (algorithm) {
    case 'encrypt': {
      const keyData = Buffer.from(atob(pem), 'ascii');
      const algorithm: webcrypto.RsaHashedImportParams = { name: 'RSA-OAEP', hash: 'SHA-256' } as const;
      const keyUsages: Array<webcrypto.KeyUsage> = ['encrypt', 'wrapKey'] as const;

      return await subtle.importKey('spki', keyData, algorithm, true, keyUsages);
    }

    case 'decrypt': {
      const keyData = Buffer.from(atob(pem), 'ascii');
      const algorithm: webcrypto.RsaHashedImportParams = { name: 'RSA-OAEP', hash: 'SHA-256' } as const;
      const keyUsages: Array<webcrypto.KeyUsage> = ['decrypt', 'unwrapKey'] as const;

      return await subtle.importKey('pkcs8', keyData, algorithm, true, keyUsages);
    }

    case 'sign': {
      const keyData = Buffer.from(atob(pem), 'ascii');
      const algorithm: webcrypto.RsaHashedImportParams = { name: 'RSA-PSS', hash: 'SHA-256' } as const;
      const keyUsages: Array<webcrypto.KeyUsage> = ['sign'] as const;

      return await subtle.importKey('pkcs8', keyData, algorithm, true, keyUsages);
    }

    case 'verify': {
      const keyData = Buffer.from(atob(pem), 'ascii');
      const algorithm: webcrypto.RsaHashedImportParams = { name: 'RSA-PSS', hash: 'SHA-256' } as const;
      const keyUsages: Array<webcrypto.KeyUsage> = ['verify'] as const;

      return await subtle.importKey('spki', keyData, algorithm, true, keyUsages);
    }
  }
}
