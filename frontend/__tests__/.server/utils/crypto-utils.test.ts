import { describe, expect, it } from 'vitest';

import { generateCryptoKey, generateJwkId } from '~/.server/utils/crypto-utils';

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
    // prettier-ignore
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
    // prettier-ignore
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
    // prettier-ignore
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
    // prettier-ignore
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
});
