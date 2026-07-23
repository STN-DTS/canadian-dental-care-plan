/**
 * Useful utility functions for crypto stuff.
 */
import { Buffer, atob } from 'node:buffer';
import type { webcrypto } from 'node:crypto';
import { createHash, subtle } from 'node:crypto';

import { createLogger } from '~/.server/logging';

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
 * Converts a PEM encoded string to a webcrypto CryptoKey.
 */
export async function generateCryptoKey(pem: string, algorithm: CryptoKeyAlgorithm): Promise<webcrypto.CryptoKey> {
  const log = createLogger('crypto-utils/generateCryptoKey');
  log.trace('Converting PEM [%s] to CryptoKey with algorighm [%s]', pem, algorithm);

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
