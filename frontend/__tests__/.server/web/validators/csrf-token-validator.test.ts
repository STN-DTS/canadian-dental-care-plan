import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockProxy } from 'vitest-mock-extended';
import { mock } from 'vitest-mock-extended';

import { createLogger } from '~/.server/logging';
import type { Logger } from '~/.server/logging';
import { DefaultCsrfTokenValidator } from '~/.server/web/validators';

describe('DefaultCsrfTokenValidator', () => {
  let logMock: MockProxy<Logger>;
  let csrfTokenValidator: DefaultCsrfTokenValidator;

  beforeEach(() => {
    logMock = mock<Logger>();

    vi.mocked(createLogger).mockReturnValue(logMock);

    csrfTokenValidator = new DefaultCsrfTokenValidator();
  });

  it('should return { isValid: true } when tokens match', () => {
    const result = csrfTokenValidator.validateCsrfToken({
      requestToken: 'valid-token',
      sessionToken: 'valid-token',
    });

    expect(result).toEqual({ isValid: true });
    expect(logMock.debug).toHaveBeenCalledWith('Starting CSRF token validation; requestToken: %s, sessionToken: %s', 'valid-token', 'valid-token');
    expect(logMock.debug).toHaveBeenCalledWith('CSRF token validation successful; requestToken: [%s], sessionToken: [%s]', 'valid-token', 'valid-token');
  });

  it('should return { isValid: false, errorMessage: string } when tokens do not match', () => {
    const result = csrfTokenValidator.validateCsrfToken({
      requestToken: 'invalid-token',
      sessionToken: 'valid-token',
    });

    expect(result).toEqual({
      isValid: false,
      errorMessage: 'CSRF token validation failed; Invalid CSRF token detected',
    });
    expect(logMock.debug).toHaveBeenCalledWith('Starting CSRF token validation; requestToken: %s, sessionToken: %s', 'invalid-token', 'valid-token');
    expect(logMock.warn).toHaveBeenCalledWith('Invalid CSRF token detected; requestToken: [%s], sessionToken: [%s]', 'invalid-token', 'valid-token');
  });

  it('should log the validation process correctly', () => {
    csrfTokenValidator.validateCsrfToken({
      requestToken: 'test-token',
      sessionToken: 'test-token',
    });

    expect(logMock.debug).toHaveBeenCalledTimes(2);
    expect(logMock.debug).toHaveBeenCalledWith('Starting CSRF token validation; requestToken: %s, sessionToken: %s', 'test-token', 'test-token');
    expect(logMock.debug).toHaveBeenCalledWith('CSRF token validation successful; requestToken: [%s], sessionToken: [%s]', 'test-token', 'test-token');
  });
});
