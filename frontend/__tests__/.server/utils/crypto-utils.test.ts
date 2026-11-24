import { generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { generateCryptoKey, generateJwkId, isPrivateKey, parsePrivateKey } from '~/.server/utils/crypto-utils';

const rsaPem = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } }).privateKey;
const rsaPkcs1Pem = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs1', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } }).privateKey;
const rsaBase64Der = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'der' }, publicKeyEncoding: { type: 'spki', format: 'der' } }).privateKey.toString('base64');
const smallRsaPem = generateKeyPairSync('rsa', { modulusLength: 1024, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } }).privateKey;
const ecPem = generateKeyPairSync('ec', { namedCurve: 'P-256', privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } }).privateKey;
const rsaPublicPem = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } }).publicKey;

describe('crypto-utils', () => {
  it('should return a JWK ID for an empty JWK', () => {
    expect(generateJwkId({})).toEqual('d41d8cd98f00b204e9800998ecf8427e');
  });

  it('should return different JWK IDs for different JWKs', () => {
    const jwkId1 = generateJwkId({ n: 'foo' });
    const jwkId2 = generateJwkId({ n: 'bar' });
    expect(jwkId1).not.toEqual(jwkId2);
  });

  it('should convert a public key from PEM format to an encryption CryptoKey', async () => {
    // oxfmt-ignore
    const publicKeyPem =
      'MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDTuqIc+mTb2MqHo5ayy41fN0Dp' +
      'XlEf7Tqefsd8rdKXm9eRQMGlGRV+dv00YHwfNB0HUmTidSkW0bsJ0QHH6oPfcILM' +
      'JP+WXHrOB1MY3FWmP621l3HbX3T9A8PgpuyabL+OlZFCEYzWjSqzTQ+9NLPUwjPN' +
      '2QATgwfUzK6XUMts2QIDAQAB';

    const cryptoKey = await generateCryptoKey(publicKeyPem, 'encrypt');

    expect(cryptoKey).toBeDefined();
    expect(cryptoKey.algorithm.name).toBe('RSA-OAEP');
    expect(cryptoKey.extractable).toBe(true);
    expect(cryptoKey.usages).toEqual(['encrypt', 'wrapKey']);
  });

  it('should convert a public key from PEM format to an verification CryptoKey', async () => {
    // oxfmt-ignore
    const publicKeyPem =
      'MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDTuqIc+mTb2MqHo5ayy41fN0Dp' +
      'XlEf7Tqefsd8rdKXm9eRQMGlGRV+dv00YHwfNB0HUmTidSkW0bsJ0QHH6oPfcILM' +
      'JP+WXHrOB1MY3FWmP621l3HbX3T9A8PgpuyabL+OlZFCEYzWjSqzTQ+9NLPUwjPN' +
      '2QATgwfUzK6XUMts2QIDAQAB';

    const cryptoKey = await generateCryptoKey(publicKeyPem, 'verify');

    expect(cryptoKey).toBeDefined();
    expect(cryptoKey.algorithm.name).toBe('RSA-PSS');
    expect(cryptoKey.extractable).toBe(true);
    expect(cryptoKey.usages).toEqual(['verify']);
  });

  it('should convert a private key from PEM format to a decryption CryptoKey', async () => {
    // oxfmt-ignore
    const privateKeyPem =
      'MIICeAIBADANBgkqhkiG9w0BAQEFAASCAmIwggJeAgEAAoGBAO8MlyeMy5eFk0+2' +
      'D3Bfuoc1G3ca7o+5BEnWxHdwnZ/V2BVqmjQ/a7Gopxdu/VCU93NLO9Ao9seVU1hB' +
      'o+icz3kl5L+RMYprn+5Tm+CO3deT94+1YxhuP6UHCCQqq3BDKiKyRFex16rn/2AC' +
      '+KGsGjwPHAlD9TOuK9n9g6g8l4TRAgMBAAECgYEAoJcpuHUalLk0pHkfWBPHYGup' +
      '/tLF7yGRIvW32LF8AtOLLaAG5hCxDZHKZrC2Vnss3XRuQ0IxvxSu//xg27T0nxcN' +
      'WdX26l0rtAI++lVblumfUbPvc9qE55FPExgl61NqVlid1JHa3ZUhwnHwWepJJuMu' +
      'uI4qT3Q8ZCIjxg6CR8ECQQD7Uru/iBUjyK2pFkpQaUYdoJ/kPrUOdTLlwwSmgzJC' +
      'gviIWcpK8gNWsoEbOi8AC8zi2pI13jmaS3SxEz6iNYFZAkEA839iszTZlokReZkF' +
      'kw13vLfkwY7d2naO0WoILNJVlyqNmAnFGhnYD7ywLkbBRTUE37zYzKKrWzGVP6XC' +
      'rOx4OQJBAOiTH3uXiziaNVsMbakMQv6X7l9iSFsgygEl/9+3+YLjgOttbG7+l2hb' +
      'uG5h4azBPtGQQ03mYJgQy+QyUvv5V8ECQDfddgufiHxdHkFDtl+yq1IE7trpqETD' +
      'BqlNJmsCJtjzzmCffTUr0MJrjBBR822paGDctvDcMWxOx+s+YJfD+SECQQDWyLeP' +
      'sUwtOf5DhJXHMLhClyegIg1ATMvhhON+b9Yjr8RVdRgFdSupd3y7BT3b1cvNk8nq' +
      'NHtp15rz4RwIA8MW';

    const cryptoKey = await generateCryptoKey(privateKeyPem, 'decrypt');

    expect(cryptoKey).toBeDefined();
    expect(cryptoKey.algorithm.name).toBe('RSA-OAEP');
    expect(cryptoKey.extractable).toBe(true);
    expect(cryptoKey.usages).toEqual(['decrypt', 'unwrapKey']);
  });

  it('should convert a private key from PEM format to a signing CryptoKey', async () => {
    // oxfmt-ignore
    const privateKeyPem =
      'MIICeAIBADANBgkqhkiG9w0BAQEFAASCAmIwggJeAgEAAoGBAO8MlyeMy5eFk0+2' +
      'D3Bfuoc1G3ca7o+5BEnWxHdwnZ/V2BVqmjQ/a7Gopxdu/VCU93NLO9Ao9seVU1hB' +
      'o+icz3kl5L+RMYprn+5Tm+CO3deT94+1YxhuP6UHCCQqq3BDKiKyRFex16rn/2AC' +
      '+KGsGjwPHAlD9TOuK9n9g6g8l4TRAgMBAAECgYEAoJcpuHUalLk0pHkfWBPHYGup' +
      '/tLF7yGRIvW32LF8AtOLLaAG5hCxDZHKZrC2Vnss3XRuQ0IxvxSu//xg27T0nxcN' +
      'WdX26l0rtAI++lVblumfUbPvc9qE55FPExgl61NqVlid1JHa3ZUhwnHwWepJJuMu' +
      'uI4qT3Q8ZCIjxg6CR8ECQQD7Uru/iBUjyK2pFkpQaUYdoJ/kPrUOdTLlwwSmgzJC' +
      'gviIWcpK8gNWsoEbOi8AC8zi2pI13jmaS3SxEz6iNYFZAkEA839iszTZlokReZkF' +
      'kw13vLfkwY7d2naO0WoILNJVlyqNmAnFGhnYD7ywLkbBRTUE37zYzKKrWzGVP6XC' +
      'rOx4OQJBAOiTH3uXiziaNVsMbakMQv6X7l9iSFsgygEl/9+3+YLjgOttbG7+l2hb' +
      'uG5h4azBPtGQQ03mYJgQy+QyUvv5V8ECQDfddgufiHxdHkFDtl+yq1IE7trpqETD' +
      'BqlNJmsCJtjzzmCffTUr0MJrjBBR822paGDctvDcMWxOx+s+YJfD+SECQQDWyLeP' +
      'sUwtOf5DhJXHMLhClyegIg1ATMvhhON+b9Yjr8RVdRgFdSupd3y7BT3b1cvNk8nq' +
      'NHtp15rz4RwIA8MW';

    const cryptoKey = await generateCryptoKey(privateKeyPem, 'sign');

    expect(cryptoKey).toBeDefined();
    expect(cryptoKey.algorithm.name).toBe('RSA-PSS');
    expect(cryptoKey.extractable).toBe(true);
    expect(cryptoKey.usages).toEqual(['sign']);
  });

  describe('parsePrivateKey', () => {
    it.each([
      ['PKCS#8 PEM', rsaPem],
      ['PKCS#1 PEM', rsaPkcs1Pem],
      ['single-line base64 PKCS#8 DER', rsaBase64Der],
      ['PEM with surrounding whitespace', `\n  ${rsaPem}  \n`],
    ])('parses a %s private key', (_label, value) => {
      const key = parsePrivateKey(value);

      expect(key.type).toBe('private');
      expect(key.asymmetricKeyType).toBe('rsa');
    });

    it.each([
      ['a public key', rsaPublicPem],
      ['invalid base64 DER', 'bm90LWEta2V5'],
      ['an empty value', ''],
    ])('throws for %s', (_label, value) => {
      expect(() => parsePrivateKey(value)).toThrow();
    });
  });

  describe('isPrivateKey', () => {
    it('accepts any parseable private key when no requirements are given', () => {
      expect(isPrivateKey(rsaPem)).toBe(true);
      expect(isPrivateKey(ecPem)).toBe(true);
    });

    it('rejects values that are not private keys', () => {
      expect(isPrivateKey('not-a-key')).toBe(false);
      expect(isPrivateKey(rsaPublicPem)).toBe(false);
    });

    it('checks the key type', () => {
      expect(isPrivateKey(rsaBase64Der, { asymmetricKeyType: 'rsa' })).toBe(true);
      expect(isPrivateKey(ecPem, { asymmetricKeyType: 'rsa' })).toBe(false);
      expect(isPrivateKey(ecPem, { asymmetricKeyType: 'ec' })).toBe(true);
    });

    it('checks the minimum RSA modulus length', () => {
      expect(isPrivateKey(rsaPem, { asymmetricKeyType: 'rsa', minModulusLength: 2048 })).toBe(true);
      expect(isPrivateKey(smallRsaPem, { asymmetricKeyType: 'rsa', minModulusLength: 2048 })).toBe(false);
      expect(isPrivateKey(ecPem, { minModulusLength: 2048 })).toBe(false);
    });
  });
});
