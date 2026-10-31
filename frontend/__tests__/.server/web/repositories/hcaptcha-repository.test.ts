import { Request, Response } from 'undici';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock, mockReset } from 'vitest-mock-extended';

import type { ServerConfig } from '~/.server/configs';
import type { HttpClient } from '~/.server/http';
import { createLogger } from '~/.server/logging';
import type { Logger } from '~/.server/logging';
import { DefaultHCaptchaRepository } from '~/.server/web/repositories/hcaptcha-repository';

const mockLogger = mock<Logger>();
const mockServerConfig = mock<Pick<ServerConfig, 'HCAPTCHA_SECRET_KEY' | 'HCAPTCHA_SITE_KEY' | 'HCAPTCHA_VERIFY_URL' | 'HEALTH_PLACEHOLDER_REQUEST_VALUE'>>();
const mockHttpClient = mock<HttpClient>();

describe('DefaultHCaptchaRepository', () => {
  let repository: DefaultHCaptchaRepository;

  beforeEach(() => {
    mockReset(mockLogger);
    mockReset(mockServerConfig);
    mockReset(mockHttpClient);
    vi.mocked(createLogger).mockReturnValue(mockLogger);

    mockServerConfig.HCAPTCHA_SECRET_KEY = 'synthetic-hcaptcha-secret';
    mockServerConfig.HCAPTCHA_SITE_KEY = 'synthetic-hcaptcha-sitekey';
    mockServerConfig.HCAPTCHA_VERIFY_URL = 'https://hcaptcha.example.test/siteverify';
    mockServerConfig.HEALTH_PLACEHOLDER_REQUEST_VALUE = 'synthetic-health-token';

    repository = new DefaultHCaptchaRepository(mockServerConfig, mockHttpClient);
  });

  it('sends verification values in the request body and omits them from diagnostics', async () => {
    mockHttpClient.instrumentedFetch.mockResolvedValueOnce(
      new Response('upstream failure', {
        status: 500,
        statusText: 'Internal Server Error',
      }),
    );

    await expect(
      repository.verifyHCaptchaResponse({
        hCaptchaResponse: 'synthetic-response-token',
        ipAddress: '192.0.2.10',
      }),
    ).rejects.toThrow('Failed to verify hCaptcha');

    const request = mockHttpClient.instrumentedFetch.mock.calls[0]?.[1];

    if (!(request instanceof Request)) {
      throw new Error('Expected the hCaptcha verification request to be a Request');
    }

    expect(request.url).toBe('https://hcaptcha.example.test/siteverify');
    expect(request.method).toBe('POST');
    expect(request.headers.get('content-type')).toContain('application/x-www-form-urlencoded');
    expect(request.url).not.toContain('synthetic-hcaptcha-secret');
    expect(request.url).not.toContain('synthetic-response-token');

    const body = new URLSearchParams(await request.text());
    expect(body.get('sitekey')).toBe('synthetic-hcaptcha-sitekey');
    expect(body.get('secret')).toBe('synthetic-hcaptcha-secret');
    expect(body.get('response')).toBe('synthetic-response-token');
    expect(body.get('remoteip')).toBe('192.0.2.10');

    const diagnostics = JSON.stringify([...mockLogger.trace.mock.calls, ...mockLogger.warn.mock.calls, ...mockLogger.error.mock.calls]);
    expect(diagnostics).not.toContain('synthetic-hcaptcha-secret');
    expect(diagnostics).not.toContain('synthetic-response-token');
    expect(diagnostics).not.toContain('192.0.2.10');
    expect(diagnostics).not.toContain('upstream failure');
  });
});
