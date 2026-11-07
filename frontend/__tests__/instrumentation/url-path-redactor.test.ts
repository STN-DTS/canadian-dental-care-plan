import { describe, expect, test } from 'vitest';

import { URL_PATH_ATTRIBUTE_KEYS, UrlPathRedactor } from '../../app/instrumentation/url-path-redactor';

describe('UrlPathRedactor', () => {
  const redactor = new UrlPathRedactor();
  const clientPath = "/dental-care/appeal-upload-eligible/pp/v1/esdc_clients(esdc_clientnumber='path-client-canary')";
  const redactedClientPath = '/dental-care/appeal-upload-eligible/pp/v1/esdc_clients([REDACTED])';

  test.each(URL_PATH_ATTRIBUTE_KEYS)('redacts backend client numbers in %s without mutating input', (key) => {
    const attributes = { [key]: `https://backend.example.test${clientPath}?$select=esdc_clientid`, status: 200 };

    expect(redactor.redactAttributes(attributes)).toEqual({
      redacted: true,
      attributes: { [key]: `https://backend.example.test${redactedClientPath}?$select=esdc_clientid`, status: 200 },
    });

    expect(attributes[key]).toContain('path-client-canary');
  });

  test.each([
    '/dental-care/doc-metadata/pp/v1/esdc_clients(00000000-0000-0000-0000-000000000001)/Microsoft.Dynamics.CRM.esdc_UploadEvidentiaryDocuments',
    '/dental-care/doc-metadata/pp/v1/esdc_clients%2800000000-0000-0000-0000-000000000001%29',
    "/dental-care/doc-metadata/pp/v1/esdc_clients('embedded)/delimiter-canary')",
    "/dental-care/doc-metadata/pp/v1/esdc_clients('line\r\nbreak-canary')",
  ])('drops the entire key-bearing suffix: %s', (value) => {
    expect(redactor.redactAttributes({ 'url.path': value })).toEqual({
      redacted: true,
      attributes: { 'url.path': '/dental-care/doc-metadata/pp/v1/esdc_clients([REDACTED])' },
    });
  });

  test('handles a backend base-path prefix and preserves safe URL components', () => {
    expect(redactor.redactValue(`https://backend.example.test:8443/gateway${clientPath}?lang=en#section`)).toBe(`https://backend.example.test:8443/gateway${redactedClientPath}?lang=en#section`);
  });

  test.each([
    '/en/application/confirmation',
    '/fr/demande/confirmation?lang=fr',
    'https://app.example.test/en/apply?redirect=/dental-care/doc-metadata/pp/v1/esdc_clients(query-canary)',
    'https://app.example.test/#/dental-care/doc-metadata/pp/v1/esdc_clients(fragment-canary)',
    '/dental-care/code-list/pp/v1/esdc_countries',
    'https://backend.example.test/dental-care/doc-metadata/pp/v1/esdc_evidentiarydocuments',
    '',
  ])('preserves application paths, collection paths and non-path components: %s', (value) => {
    expect(redactor.redactAttributes({ 'url.full': value })).toEqual({ redacted: false });
  });

  test.each(['/en/application/confirmation', '/fr/demande/confirmation', '/dental-care/documents/upload'])('preserves approved application request paths: %s', (path) => {
    expect(redactor.redactAttributes({ 'url.path': path })).toEqual({ redacted: false });
  });

  test('redacts string arrays and retains unsupported values', () => {
    const attributes = { 'url.full': [clientPath, '/en/apply'], 'url.path': 123 };

    expect(redactor.redactAttributes(attributes)).toEqual({
      redacted: true,
      attributes: { 'url.full': [redactedClientPath, '/en/apply'], 'url.path': 123 },
    });
    expect(attributes['url.full'][0]).toBe(clientPath);
  });

  test('does not inspect arbitrary attributes or the approved confirmation code', () => {
    expect(redactor.redactAttributes({ message: clientPath, 'cdcp.application.confirmation_code': 'synthetic-confirmation-code' })).toEqual({ redacted: false });
  });
});
