import { describe, expect, test, vi } from 'vitest';

import type { AttributeRedactorRule } from '../../app/instrumentation/attribute-redactor-types';
import { AttributeRedactor } from '../../app/instrumentation/attribute-redactor.server';

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

  test('redacts strings and string arrays, returning other values as is', () => {
    const numbers = [1, 2];
    const clean = ['a', 'b'];

    expect(redactor.redactValue('mail person@example.test')).toBe('mail [EMAIL]');
    expect(redactor.redactValue(['person@example.test', 'ok'])).toEqual(['[EMAIL]', 'ok']);
    expect(redactor.redactValue(clean)).toBe(clean);
    expect(redactor.redactValue(numbers)).toBe(numbers);
    expect(redactor.redactValue(42)).toBe(42);
    expect(redactor.redactValue(undefined)).toBeUndefined();
  });

  test('uses one rule list for exact keys, key substrings, and value patterns', () => {
    const configured = new AttributeRedactor({
      redactRules: [
        { type: 'key', match: 'exact', value: 'db.statement' },
        { type: 'key', match: 'substring', value: 'token' },
        { type: 'value', pattern: /secret/g, replacement: '[MATCHED]' },
      ],
      replacement: '[KEY]',
    });

    expect(
      configured.redactAttributes({
        'DB.STATEMENT': 'contains secret',
        'request.ACCESS_TOKEN': 'contains secret',
        message: 'contains secret',
      }),
    ).toEqual({
      redacted: true,
      attributes: {
        'DB.STATEMENT': '[KEY]',
        'request.ACCESS_TOKEN': '[KEY]',
        message: 'contains [MATCHED]',
      },
    });
  });

  test('passes the attribute key and value to replacement callbacks', () => {
    const configured = new AttributeRedactor({
      redactRules: [
        { type: 'key', match: 'exact', value: 'customer.id' },
        { type: 'value', pattern: /secret/g, replacement: ({ key, value }) => `[${key}:${typeof value === 'string' ? value.length : 'non-string'}]` },
      ],
      replacement: ({ key, value }) => `[${key}:${typeof value === 'string' ? value.length : 'non-string'}]`,
    });

    expect(configured.redactAttributes({ 'customer.id': 'C123', message: 'secret!' })).toEqual({
      redacted: true,
      attributes: { 'customer.id': '[customer.id:4]', message: '[message:7]!' },
    });
  });

  test.each([/.*credit_card.*/g, /.*credit_card.*/y])('matches multiple keys with %s without sharing regex state', (pattern) => {
    pattern.lastIndex = 5;
    const configured = new AttributeRedactor({
      redactRules: [{ type: 'key', match: 'pattern', value: pattern }],
    });
    const attributes = {
      'billing.credit_card': 'first-canary',
      route: '/apply',
      'shipping.credit_card': 'second-canary',
    };
    const expected = {
      redacted: true,
      attributes: { 'billing.credit_card': '[REDACTED]', route: '/apply', 'shipping.credit_card': '[REDACTED]' },
    };

    expect(configured.redactAttributes(attributes)).toEqual(expected);
    expect(configured.redactAttributes(attributes)).toEqual(expected);
    expect(pattern.lastIndex).toBe(5);
  });

  test('preserves case-sensitivity flags on key patterns', () => {
    const attributes = { 'PAYMENT.CREDIT_CARD': 'card-canary' };
    const caseSensitive = new AttributeRedactor({
      redactRules: [{ type: 'key', match: 'pattern', value: /credit_card/g }],
    });
    const caseInsensitive = new AttributeRedactor({
      redactRules: [{ type: 'key', match: 'pattern', value: /credit_card/gi }],
    });

    expect(caseSensitive.redactAttributes(attributes)).toEqual({ redacted: false });
    expect(caseInsensitive.redactAttributes(attributes)).toEqual({
      redacted: true,
      attributes: { 'PAYMENT.CREDIT_CARD': '[REDACTED]' },
    });
  });

  test.each([
    { name: 'exact key', rule: { type: 'key', match: 'exact', value: 'payment.credit_card' } },
    { name: 'substring key', rule: { type: 'key', match: 'substring', value: 'credit_card' } },
    { name: 'pattern key', rule: { type: 'key', match: 'pattern', value: /.*credit_card.*/g } },
    { name: 'value pattern', rule: { type: 'value', pattern: /secret/g } },
  ] satisfies { name: string; rule: AttributeRedactorRule }[])('$name rule supports optional replacement overrides', ({ rule }) => {
    const attributes = { 'payment.credit_card': 'secret' };
    const fallback = new AttributeRedactor({
      redactRules: [rule],
      replacement: ({ key }) => `[DEFAULT:${key}]`,
    });
    const stringOverride = new AttributeRedactor({
      redactRules: [{ ...rule, replacement: '[RULE]' }],
      replacement: () => '[DEFAULT]',
    });
    const functionOverride = new AttributeRedactor({
      redactRules: [{ ...rule, replacement: ({ key, value }) => `[${key}:${typeof value === 'string' ? value.length : 'non-string'}]` }],
      replacement: '[DEFAULT]',
    });
    const emptyOverride = new AttributeRedactor({
      redactRules: [{ ...rule, replacement: '' }],
      replacement: '[DEFAULT]',
    });

    expect(fallback.redactAttributes(attributes)).toEqual({
      redacted: true,
      attributes: { 'payment.credit_card': '[DEFAULT:payment.credit_card]' },
    });
    expect(stringOverride.redactAttributes(attributes)).toEqual({
      redacted: true,
      attributes: { 'payment.credit_card': '[RULE]' },
    });
    expect(functionOverride.redactAttributes(attributes)).toEqual({
      redacted: true,
      attributes: { 'payment.credit_card': '[payment.credit_card:6]' },
    });
    expect(emptyOverride.redactAttributes(attributes)).toEqual({
      redacted: true,
      attributes: { 'payment.credit_card': '' },
    });
  });

  test('treats a replacement callback result as literal text', () => {
    const configured = new AttributeRedactor({
      redactRules: [{ type: 'value', pattern: /secret/g, replacement: () => '$&' }],
    });

    expect(configured.redactAttributes({ message: 'secret' })).toEqual({
      redacted: true,
      attributes: { message: '$&' },
    });
  });

  test('does not call replacement functions when a value pattern does not match', () => {
    const replacement = vi.fn(() => '[RULE]');
    const configured = new AttributeRedactor({
      redactRules: [{ type: 'value', pattern: /secret/g, replacement }],
    });

    expect(configured.redactAttributes({ message: 'public' })).toEqual({ redacted: false });
    expect(replacement).not.toHaveBeenCalled();
  });

  test('does not stringify attribute objects for static replacements', () => {
    const toString = vi.fn(() => 'do-not-stringify');
    const configured = new AttributeRedactor({
      redactRules: [{ type: 'key', match: 'exact', value: 'sensitive' }],
    });

    expect(configured.redactAttributes({ sensitive: { toString } })).toEqual({
      redacted: true,
      attributes: { sensitive: '[REDACTED]' },
    });
    expect(toString).not.toHaveBeenCalled();
  });

  test('passes non-string values to replacement callbacks without stringifying them', () => {
    const toString = vi.fn(() => 'do-not-stringify');
    const value = { toString };
    const replacement = vi.fn(({ key }: { key: string; value: unknown }) => `[${key}]`);
    const configured = new AttributeRedactor({
      redactRules: [{ type: 'key', match: 'exact', value: 'sensitive', replacement }],
    });

    expect(configured.redactAttributes({ sensitive: value })).toEqual({
      redacted: true,
      attributes: { sensitive: '[sensitive]' },
    });
    expect(replacement).toHaveBeenCalledWith({ key: 'sensitive', value });
    expect(toString).not.toHaveBeenCalled();
  });
});
