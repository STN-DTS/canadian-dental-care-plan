import { describe, expect, test, vi } from 'vitest';

import type { QueryParamsRedactorRule } from '../../app/instrumentation/query-params-redactor-types';
import { DEFAULT_REDACT_QUERY_PARAMS_OPTIONS, QueryParamsRedactor } from '../../app/instrumentation/query-params-redactor.server';

describe('QueryParamsRedactor', () => {
  const redactor = new QueryParamsRedactor();

  test('returns an unredacted result without attributes when no URL attribute has a query', () => {
    expect(redactor.redactAttributes({ 'url.full': 'https://example.test/apply', message: 'a?b=c' })).toEqual({ redacted: false });
  });

  test.each([
    { text: 'request: [/en/apply?token=abc&lang=en], redirectUrl: [/fr/demande]', expected: 'request: [/en/apply?token=%5BREDACTED%5D&lang=%5BREDACTED%5D], redirectUrl: [/fr/demande]' },
    { text: 'Redirecting to https://idp.example.test/authorize?code=abc&state=xyz#top now', expected: 'Redirecting to https://idp.example.test/authorize?code=%5BREDACTED%5D&state=%5BREDACTED%5D#top now' },
    { text: 'first /a?x=1 then (/b?y=2)', expected: 'first /a?x=%5BREDACTED%5D then (/b?y=%5BREDACTED%5D)' },
    { text: "url: 'https://example.test/?q=1'", expected: "url: 'https://example.test/?q=%5BREDACTED%5D'" },
  ])('redacts query parameters of URLs embedded in text: $text', ({ text, expected }) => {
    expect(redactor.redactText(text)).toBe(expected);
  });

  test.each(['Is this ok? yes', 'path /en/apply has no query', 'what?now', 'https://example.test/apply#section=1'])('leaves text without a name=value query unchanged: %s', (text) => {
    expect(redactor.redactText(text)).toBe(text);
  });

  test('limits text redaction to configured parameter names', () => {
    const limited = new QueryParamsRedactor({ redactRules: [{ type: 'key', match: 'exact', value: 'code' }], replacement: '***' });

    expect(limited.redactText('callback /cb?code=abc&lang=en')).toBe('callback /cb?code=***&lang=en');
  });

  test('uses one rule list for exact, substring, and pattern names and parameter values', () => {
    const configured = new QueryParamsRedactor({
      redactRules: [
        { type: 'key', match: 'exact', value: 'CODE' },
        { type: 'key', match: 'substring', value: 'TOKEN' },
        { type: 'key', match: 'pattern', value: /^st(ate)?$/ },
        { type: 'value', pattern: /\d{3}-\d{3}-\d{3}/g, replacement: '[SIN]' },
      ],
      replacement: 'hidden',
    });

    expect(configured.redactText('/cb?code=a&access_token=b&state=c&State=d&note=id+123-456-789&lang=en')).toBe('/cb?code=hidden&access_token=hidden&state=hidden&State=d&note=id+%5BSIN%5D&lang=en');
  });

  test('key rules match decoded parameter names and win over value rules', () => {
    const configured = new QueryParamsRedactor({
      redactRules: [
        { type: 'value', pattern: /secret/g, replacement: '[VALUE]' },
        { type: 'key', match: 'exact', value: 'token', replacement: '[KEY]' },
      ],
    });

    expect(configured.redactAttributes({ 'url.query': '%74oken=secret&other=secret' })).toEqual({
      redacted: true,
      attributes: { 'url.query': 'token=%5BKEY%5D&other=%5BVALUE%5D' },
    });
  });

  test.each([/.*token.*/g, /.*token.*/y])('matches multiple parameter names with %s without sharing regex state', (pattern) => {
    pattern.lastIndex = 4;
    const configured = new QueryParamsRedactor({ redactRules: [{ type: 'key', match: 'pattern', value: pattern }], replacement: 'x' });

    expect(configured.redactText('/a?id_token=1&access_token=2&lang=en')).toBe('/a?id_token=x&access_token=x&lang=en');
    expect(configured.redactText('/a?id_token=1&access_token=2&lang=en')).toBe('/a?id_token=x&access_token=x&lang=en');
    expect(pattern.lastIndex).toBe(4);
  });

  test.each([
    { name: 'exact key', rule: { type: 'key', match: 'exact', value: 'code' } },
    { name: 'substring key', rule: { type: 'key', match: 'substring', value: 'od' } },
    { name: 'pattern key', rule: { type: 'key', match: 'pattern', value: /^code$/g } },
    { name: 'value pattern', rule: { type: 'value', pattern: /^abc$/g } },
  ] satisfies { name: string; rule: QueryParamsRedactorRule }[])('$name rule supports optional replacement overrides', ({ rule }) => {
    const redact = (options: ConstructorParameters<typeof QueryParamsRedactor>[0]) => new QueryParamsRedactor(options).redactText('/cb?code=abc&lang=en');

    expect(redact({ redactRules: [rule], replacement: ({ key }) => `default-${key}` })).toBe('/cb?code=default-code&lang=en');
    expect(redact({ redactRules: [{ ...rule, replacement: 'rule' }], replacement: 'default' })).toBe('/cb?code=rule&lang=en');
    expect(redact({ redactRules: [{ ...rule, replacement: ({ key, value }) => `${key}-${String(value).length}` }], replacement: 'default' })).toBe('/cb?code=code-3&lang=en');
    expect(redact({ redactRules: [{ ...rule, replacement: '' }], replacement: 'default' })).toBe('/cb?code=&lang=en');
  });

  test('encodes replacement text and inserts callback results literally', () => {
    const configured = new QueryParamsRedactor({ redactRules: [{ type: 'value', pattern: /secret/g, replacement: () => '$& &x=1' }] });

    expect(configured.redactText('/cb?q=secret')).toBe('/cb?q=%24%26+%26x%3D1');
  });

  test('does not call replacement functions when no rule matches', () => {
    const replacement = vi.fn(() => 'hidden');
    const configured = new QueryParamsRedactor({
      redactRules: [
        { type: 'key', match: 'exact', value: 'code' },
        { type: 'value', pattern: /secret/g },
      ],
      replacement,
    });

    expect(configured.redactAttributes({ 'url.full': '/cb?lang=en' })).toEqual({ redacted: false });
    expect(replacement).not.toHaveBeenCalled();
  });

  test('redacts every parameter by default and disables parameter redaction with an empty rule list', () => {
    expect(redactor.redactText('/cb?a=1&b=')).toBe('/cb?a=%5BREDACTED%5D&b=%5BREDACTED%5D');
    expect(new QueryParamsRedactor({ redactRules: [] }).redactText('/cb?a=1')).toBe('/cb?a=1');
  });

  test('redacts embedded query parameters in other string attributes and string arrays', () => {
    const attributes = {
      'http.request.header.referer': 'Referer: https://example.test/authorize?code=secret',
      'exception.message': 'Redirecting to /apply?token=secret',
      locations: ['Started at /a?first=secret', 'Completed at /b?second=secret'],
    };

    expect(redactor.redactAttributes(attributes)).toEqual({
      redacted: true,
      attributes: {
        'http.request.header.referer': 'Referer: https://example.test/authorize?code=%5BREDACTED%5D',
        'exception.message': 'Redirecting to /apply?token=%5BREDACTED%5D',
        locations: ['Started at /a?first=%5BREDACTED%5D', 'Completed at /b?second=%5BREDACTED%5D'],
      },
    });
    expect(attributes['exception.message']).toBe('Redirecting to /apply?token=secret');
  });

  test('can disable scanning of attributes outside the configured URL keys', () => {
    const limited = new QueryParamsRedactor({ scanOtherStringAttributes: false });

    expect(
      limited.redactAttributes({
        message: 'Redirecting to /apply?token=secret',
        'url.full': 'https://example.test/apply?token=secret',
      }),
    ).toEqual({
      redacted: true,
      attributes: {
        message: 'Redirecting to /apply?token=secret',
        'url.full': 'https://example.test/apply?token=%5BREDACTED%5D',
      },
    });
  });

  test('supports adding custom embedded URL patterns while retaining the default pattern', () => {
    const customPattern = /provider\?[^,\s]+/iy;
    customPattern.lastIndex = 5;
    const configurable = new QueryParamsRedactor({
      embeddedUrlPatterns: [...DEFAULT_REDACT_QUERY_PARAMS_OPTIONS.embeddedUrlPatterns, customPattern],
    });
    const text = 'Callback provider?code=secret, then /apply?token=secret';

    expect(configurable.redactText(text)).toBe('Callback provider?code=%5BREDACTED%5D, then /apply?token=%5BREDACTED%5D');
    expect(configurable.redactAttributes({ message: text })).toEqual({
      redacted: true,
      attributes: { message: 'Callback provider?code=%5BREDACTED%5D, then /apply?token=%5BREDACTED%5D' },
    });
    expect(customPattern.lastIndex).toBe(5);
  });

  test('replaces embedded URL patterns when options are supplied', () => {
    const customPattern = new QueryParamsRedactor({ embeddedUrlPatterns: [/provider\?[^,\s]+/i] });

    expect(customPattern.redactText('Callback provider?code=secret, then /apply?token=secret')).toBe('Callback provider?code=%5BREDACTED%5D, then /apply?token=secret');
  });
});
