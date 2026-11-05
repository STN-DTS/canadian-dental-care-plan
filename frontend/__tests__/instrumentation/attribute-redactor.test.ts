import { describe, expect, test, vi } from 'vitest';

import { AttributeRedactor, DEFAULT_REDACT_ATTRIBUTES_OPTIONS } from '../../app/instrumentation/attribute-redactor';

describe('AttributeRedactor', () => {
  const redactor = new AttributeRedactor();

  test('returns an unredacted result without attributes when nothing matches', () => {
    expect(redactor.redactAttributes({ route: '/apply', status: 200 })).toEqual({ redacted: false });
  });

  test('returns a redacted copy and leaves the input unchanged', () => {
    const attributes = { password: 'secret', route: '/apply' };

    expect(redactor.redactAttributes(attributes)).toEqual({ redacted: true, attributes: { password: '[REDACTED]', route: '/apply' } });
    expect(attributes).toEqual({ password: 'secret', route: '/apply' });
  });

  test.each([
    'db.statement',
    'DB.STATEMENT',
    'db.query.text',
    'client.address',
    'http.client_ip',
    'net.peer.ip',
    'http.request.body',
    'user.email',
    'user.password',
    'X_API_KEY',
    'X-API-KEY',
    'app.apikey',
    'refresh_token',
    'http.request.header.authorization',
    'aws.credentials',
    'person.ssn',
    'payment.credit_card',
    'http.request.header.cookie',
    'client_secret',
  ])('redacts the default key %s', (key) => {
    expect(redactor.redactAttributes({ [key]: 'canary' })).toEqual({ redacted: true, attributes: { [key]: '[REDACTED]' } });
  });

  test('never inspects values of unlisted keys', () => {
    const attributes = { message: 'person@example.test Bearer abc.def 4111 1111 1111 1111 AKIAABCDEFGHIJKLMNOP' };

    expect(redactor.redactAttributes(attributes)).toEqual({ redacted: false });
  });

  test('matches SIN as a key component without matching unrelated names', () => {
    expect(redactor.redactAttributes({ 'applicant.sin': 'canary', 'processing.status': 'running' })).toEqual({
      redacted: true,
      attributes: { 'applicant.sin': '[REDACTED]', 'processing.status': 'running' },
    });
  });

  test('replaces every value type of listed keys', () => {
    expect(redactor.redactAttributes({ token: ['a', 'b'], secret: 42, password: true, cookie: undefined })).toEqual({
      redacted: true,
      attributes: { token: '[REDACTED]', secret: '[REDACTED]', password: '[REDACTED]', cookie: '[REDACTED]' },
    });
  });

  test('reports nothing when the value already equals the replacement', () => {
    expect(redactor.redactAttributes({ password: '[REDACTED]' })).toEqual({ redacted: false });
  });

  test('matches string keys ignoring case and accents, and regexes as given', () => {
    const configured = new AttributeRedactor({ attributeKeys: ['customer.numéro', /^billing\./], replacement: '[KEY]' });

    expect(configured.redactAttributes({ 'CUSTOMER.NUMERO': 'a', 'billing.card': 'b', 'BILLING.CARD': 'c', route: 'd' })).toEqual({
      redacted: true,
      attributes: { 'CUSTOMER.NUMERO': '[KEY]', 'billing.card': '[KEY]', 'BILLING.CARD': 'c', route: 'd' },
    });
  });

  test.each([/credit_card/g, /credit_card/y])('matches multiple keys with %s without sharing regex state', (pattern) => {
    pattern.lastIndex = 5;
    const configured = new AttributeRedactor({ attributeKeys: [pattern] });
    const attributes = { 'billing.credit_card': 'first', route: '/apply', 'shipping.credit_card': 'second' };
    const expected = { redacted: true, attributes: { 'billing.credit_card': '[REDACTED]', route: '/apply', 'shipping.credit_card': '[REDACTED]' } };

    expect(configured.redactAttributes(attributes)).toEqual(expected);
    expect(configured.redactAttributes(attributes)).toEqual(expected);
    expect(pattern.lastIndex).toBe(5);
  });

  test('passes the attribute key and value to replacement callbacks', () => {
    const replacement = vi.fn(({ key, value }: { key: string; value: unknown }) => `[${key}:${typeof value === 'string' ? value.length : 'non-string'}]`);
    const configured = new AttributeRedactor({ attributeKeys: ['customer.id'], replacement });

    expect(configured.redactAttributes({ 'customer.id': 'C123', route: '/apply' })).toEqual({
      redacted: true,
      attributes: { 'customer.id': '[customer.id:4]', route: '/apply' },
    });
    expect(replacement).toHaveBeenCalledOnce();
  });

  test('calls a key predicate once per key', () => {
    const predicate = vi.fn((key: string) => key.endsWith('.id'));
    const configured = new AttributeRedactor({ attributeKeys: [predicate] });
    const attributes = { 'customer.id': 'C123', route: '/apply' };

    expect(configured.redactAttributes(attributes)).toEqual({ redacted: true, attributes: { 'customer.id': '[REDACTED]', route: '/apply' } });
    expect(configured.redactAttributes(attributes)).toEqual({ redacted: true, attributes: { 'customer.id': '[REDACTED]', route: '/apply' } });
    expect(predicate).toHaveBeenCalledTimes(2);
  });

  test('supports an empty replacement', () => {
    expect(new AttributeRedactor({ replacement: '' }).redactAttributes({ password: 'secret' })).toEqual({ redacted: true, attributes: { password: '' } });
  });

  test('redacts nothing with an empty key list', () => {
    expect(new AttributeRedactor({ attributeKeys: [] }).redactAttributes({ password: 'secret' })).toEqual({ redacted: false });
  });

  test('extends the default keys', () => {
    const configured = new AttributeRedactor({ attributeKeys: [...DEFAULT_REDACT_ATTRIBUTES_OPTIONS.attributeKeys, 'customer.id'] });

    expect(configured.redactAttributes({ password: 'a', 'customer.id': 'b' })).toEqual({
      redacted: true,
      attributes: { password: '[REDACTED]', 'customer.id': '[REDACTED]' },
    });
  });

  test('returns the same result for repeated keys', () => {
    for (let index = 0; index < 3; index++) {
      expect(redactor.redactAttributes({ password: 'secret', route: '/apply' })).toEqual({ redacted: true, attributes: { password: '[REDACTED]', route: '/apply' } });
    }
  });
});
