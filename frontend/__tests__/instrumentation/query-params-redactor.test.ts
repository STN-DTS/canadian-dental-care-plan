import { describe, expect, test, vi } from 'vitest';

import { DEFAULT_REDACT_QUERY_PARAMS_OPTIONS, QueryParamsRedactor, SAFE_QUERY_PARAMETER_NAMES } from '../../app/instrumentation/query-params-redactor';

describe('QueryParamsRedactor', () => {
  const redactor = new QueryParamsRedactor({ parameterNames: ['token', 'code'] });

  test('redacts every parameter except safe names by default', () => {
    const defaults = new QueryParamsRedactor();

    expect(defaults.redactAttributes({ 'react_router.url': 'https://example.test/en/apply?code=a&state=b&AddressPostalCode=K1A0B1&lang=en&$select=name&LANG=fr' })).toEqual({
      redacted: true,
      attributes: { 'react_router.url': 'https://example.test/en/apply?code=%5BREDACTED%5D&state=%5BREDACTED%5D&AddressPostalCode=%5BREDACTED%5D&lang=en&%24select=name&LANG=%5BREDACTED%5D' },
    });
  });

  test('leaves URLs with only safe parameters unchanged by default', () => {
    const query = [...SAFE_QUERY_PARAMETER_NAMES].map((name) => `${encodeURIComponent(name)}=1`).join('&');

    expect(new QueryParamsRedactor().redactAttributes({ 'url.full': `https://example.test/?${query}` })).toEqual({ redacted: false });
  });

  test('extends the default safe names with a custom predicate', () => {
    const configured = new QueryParamsRedactor({ parameterNames: [(name) => !SAFE_QUERY_PARAMETER_NAMES.has(name) && name !== 'page'] });

    expect(configured.redactAttributes({ 'url.query': 'page=2&id=7' })).toEqual({ redacted: true, attributes: { 'url.query': 'page=2&id=%5BREDACTED%5D' } });
    expect(DEFAULT_REDACT_QUERY_PARAMS_OPTIONS.attributeKeys).toContain('react_router.url');
  });

  test.each([
    ['absolute URL', 'https://example.test/path?token=secret&lang=en#section', 'https://example.test/path?token=%5BREDACTED%5D&lang=en#section'],
    ['path', '/path?code=a&code=b&lang=en', '/path?code=%5BREDACTED%5D&code=%5BREDACTED%5D&lang=en'],
    ['query string', 'token=secret&lang=en', 'token=%5BREDACTED%5D&lang=en'],
    ['query string with ?', '?token=secret', '?token=%5BREDACTED%5D'],
  ])('redacts named parameters in a %s', (_name, value, expected) => {
    expect(redactor.redactAttributes({ 'url.full': value })).toEqual({ redacted: true, attributes: { 'url.full': expected } });
  });

  test.each([
    ['URL without a query', 'https://example.test/path'],
    ['URL with an empty query', 'https://example.test/path?'],
    ['query inside the fragment', 'https://example.test/path#section?token=secret'],
    ['relative text that is not a URL, path or query', 'not-a-url?token=secret'],
    ['unlisted parameters', '/path?lang=en&page=2'],
    ['empty value', ''],
  ])('leaves a %s unchanged', (_name, value) => {
    expect(redactor.redactAttributes({ 'url.full': value })).toEqual({ redacted: false });
  });

  test('only inspects configured attribute keys', () => {
    expect(redactor.redactAttributes({ route: '/apply?token=secret', message: 'see https://example.test/?token=secret' })).toEqual({ redacted: false });
  });

  test('matches attribute keys and parameter names ignoring case and accents, and by regex', () => {
    const configured = new QueryParamsRedactor({ attributeKeys: ['CUSTOM.URL', /^redirect\./], parameterNames: ['Tokén', /_token$/i], replacement: 'x' });

    expect(configured.redactAttributes({ 'custom.url': '/a?TOKEN=1&id_token=2&lang=en', 'redirect.to': '/b?access_TOKEN=3', 'url.full': '/c?token=4' })).toEqual({
      redacted: true,
      attributes: { 'custom.url': '/a?TOKEN=x&id_token=x&lang=en', 'redirect.to': '/b?access_TOKEN=x', 'url.full': '/c?token=4' },
    });
  });

  test('matches attribute keys and parameter names with predicates', () => {
    const keyPredicate = vi.fn((key: string) => key.endsWith('.link'));
    const namePredicate = vi.fn((name: string) => name.startsWith('x-'));
    const configured = new QueryParamsRedactor({ attributeKeys: [keyPredicate], parameterNames: [namePredicate], replacement: 'x' });
    const attributes = { 'app.link': '/a?x-sig=1&lang=en', route: '/b?x-sig=2' };
    const expected = { redacted: true, attributes: { 'app.link': '/a?x-sig=x&lang=en', route: '/b?x-sig=2' } };

    expect(configured.redactAttributes(attributes)).toEqual(expected);
    expect(configured.redactAttributes(attributes)).toEqual(expected);
    expect(keyPredicate).toHaveBeenCalledTimes(2);
    expect(namePredicate).toHaveBeenCalledTimes(4);
  });

  test('matches decoded parameter names', () => {
    expect(redactor.redactAttributes({ 'url.query': '%74oken=secret' })).toEqual({ redacted: true, attributes: { 'url.query': 'token=%5BREDACTED%5D' } });
  });

  test('reuses global and sticky regexes without carrying lastIndex between names', () => {
    const configured = new QueryParamsRedactor({ parameterNames: [/token/gy], replacement: 'x' });

    expect(configured.redactAttributes({ 'url.query': 'token=1&token=2&token=3' })).toEqual({ redacted: true, attributes: { 'url.query': 'token=x&token=x&token=x' } });
  });

  test('passes decoded names and values to a replacement callback and encodes its result', () => {
    const replacement = vi.fn(({ key }: { key: string }) => `[${key}]&x=1`);
    const configured = new QueryParamsRedactor({ parameterNames: ['token'], replacement });

    expect(configured.redactAttributes({ 'url.query': 'token=a%20b' })).toEqual({ redacted: true, attributes: { 'url.query': 'token=%5Btoken%5D%26x%3D1' } });
    expect(replacement).toHaveBeenCalledWith({ key: 'token', value: 'a b' });
  });

  test('redacts string arrays and leaves other values unchanged', () => {
    const attributes = { 'url.full': ['/a?token=1', '/b?lang=en'], 'url.query': 123 };

    expect(redactor.redactAttributes(attributes)).toEqual({ redacted: true, attributes: { 'url.full': ['/a?token=%5BREDACTED%5D', '/b?lang=en'], 'url.query': 123 } });
    expect(attributes['url.full']).toEqual(['/a?token=1', '/b?lang=en']);
  });

  test('empty attribute key or parameter name lists disable redaction', () => {
    expect(new QueryParamsRedactor({ attributeKeys: [], parameterNames: ['token'] }).redactAttributes({ 'url.full': '/a?token=1' })).toEqual({ redacted: false });
    expect(new QueryParamsRedactor({ parameterNames: [] }).redactAttributes({ 'url.full': '/a?token=1' })).toEqual({ redacted: false });
  });
});
