import { None, Some } from 'oxide.ts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockProxy } from 'vitest-mock-extended';
import { anyArray, anyObject, mock } from 'vitest-mock-extended';

import type { ClientApplicationDto } from '~/.server/domain/dtos';
import type { ApplicantService, ClientApplicationService, ClientEligibilityService } from '~/.server/domain/services';
import { createLogger } from '~/.server/logging';
import type { Logger } from '~/.server/logging';
import { DefaultSecurityHandler } from '~/.server/routes/security';
import type { ValidateRequestMethodParams } from '~/.server/routes/security';
import { getClientIpAddress } from '~/.server/utils/ip-address-utils';
import type { UserinfoToken } from '~/.server/utils/raoidc-utils';
import type { Session } from '~/.server/web/session';
import type { CsrfTokenValidator, HCaptchaValidator, RaoidcSessionValidator } from '~/.server/web/validators';
import type { FeatureName } from '~/utils/env-utils';

vi.mock('~/.server/utils/ip-address-utils');

describe('DefaultSecurityHandler', () => {
  let mockLogger: MockProxy<Logger>;
  let mockCsrfTokenValidator: MockProxy<CsrfTokenValidator>;
  let mockHCaptchaValidator: MockProxy<HCaptchaValidator>;
  let mockRaoidcSessionValidator: MockProxy<RaoidcSessionValidator>;
  let mockClientApplicationService: MockProxy<ClientApplicationService>;
  let mockApplicantService: MockProxy<ApplicantService>;
  let mockClientEligibilityService: MockProxy<ClientEligibilityService>;
  let securityHandler: DefaultSecurityHandler;

  beforeEach(() => {
    // Mocking the dependencies
    mockLogger = mock<Logger>();
    vi.mocked(createLogger).mockReturnValue(mockLogger);
    mockCsrfTokenValidator = mock<CsrfTokenValidator>();
    mockHCaptchaValidator = mock<HCaptchaValidator>();
    mockRaoidcSessionValidator = mock<RaoidcSessionValidator>();
    mockClientApplicationService = mock<ClientApplicationService>();
    mockApplicantService = mock<ApplicantService>();
    mockClientEligibilityService = mock<ClientEligibilityService>();

    // Creating an instance of DefaultSecurityHandler with the mocked dependencies
    securityHandler = new DefaultSecurityHandler(
      { ENABLED_FEATURES: ['hcaptcha'], ENROLLMENT_STATUS_CODE_ENROLLED: 'enrolled' }, // Mocked server config
      mockCsrfTokenValidator,
      mockHCaptchaValidator,
      mockRaoidcSessionValidator,
      mockClientApplicationService,
      mockApplicantService,
      mockClientEligibilityService,
    );
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('validateAuthSession', () => {
    it('should throw a redirect response when the RAOIDC session is invalid', async () => {
      // Mocking the result of the RAOIDC session validation
      mockRaoidcSessionValidator.validateRaoidcSession.mockResolvedValue({ isValid: false, errorMessage: 'Invalid session' });

      const mockSession = mock<Session>();
      const mockRequestUrl = new URL('https://localhost:3000/en/protected-page');

      // Capture the thrown error
      const error = await securityHandler.validateAuthSession({ requestUrl: mockRequestUrl, session: mockSession }).catch((error_) => error_);

      // Assert the error is a Response object
      expect(error).toBeInstanceOf(Response);

      // Assert status code
      expect((error as Response).status).toBe(302);

      // Assert headers
      expect((error as Response).headers.get('Location')).toBe('/auth/login?returnto=%2Fen%2Fprotected-page%3F');
      expect((error as Response).headers.get('X-Remix-Reload-Document')).toBe('true');
    });

    it('should not throw anything when the RAOIDC session is valid', async () => {
      // Mocking the result of the RAOIDC session validation
      mockRaoidcSessionValidator.validateRaoidcSession.mockResolvedValue({ isValid: true });

      const mockSession = mock<Session>();
      const mockRequestUrl = new URL('https://localhost:3000/en/protected-page');

      // Expect no error if session is valid
      await expect(securityHandler.validateAuthSession({ requestUrl: mockRequestUrl, session: mockSession })).resolves.not.toThrow();
    });
  });

  describe('validateCsrfToken', () => {
    it('should throw a 403 error if the CSRF token is invalid', () => {
      // Mocking the CSRF token validation to return an invalid result
      mockCsrfTokenValidator.validateCsrfToken.mockReturnValue({ isValid: false, errorMessage: 'Invalid CSRF token' });

      const mockFormData = mock<FormData>();
      mockFormData.get.calledWith('_csrf').mockReturnValue('invalid-token');

      const mockSession = mock<Session>();
      mockSession.get.calledWith('csrfToken').mockReturnValue('session-token');

      // Expect a 403 response if CSRF token is invalid
      expect(() => securityHandler.validateCsrfToken({ formData: mockFormData, session: mockSession })).toThrowError(
        expect.objectContaining({
          data: 'Invalid CSRF token',
          init: { status: 403 },
          type: 'DataWithResponseInit',
        }),
      );
    });

    it('should not throw anything if the CSRF token is valid', () => {
      // Mocking the CSRF token validation to return a valid result
      mockCsrfTokenValidator.validateCsrfToken.mockReturnValue({ isValid: true });

      const mockFormData = mock<FormData>();
      mockFormData.get.calledWith('_csrf').mockReturnValue('valid-token');

      const mockSession = mock<Session>();
      mockSession.get.calledWith('csrfToken').mockReturnValue('valid-token');

      // Expect no error if CSRF token is valid
      expect(() => securityHandler.validateCsrfToken({ formData: mockFormData, session: mockSession })).not.toThrow();
    });
  });

  describe('validateFeatureEnabled', () => {
    it('should throw 404 if feature is not enabled', () => {
      const feature: FeatureName = 'status';

      const securityHandler = new DefaultSecurityHandler(
        { ENABLED_FEATURES: ['hcaptcha'], ENROLLMENT_STATUS_CODE_ENROLLED: 'enrolled' }, // Mocked server config
        mockCsrfTokenValidator,
        mockHCaptchaValidator,
        mockRaoidcSessionValidator,
        mockClientApplicationService,
        mockApplicantService,
        mockClientEligibilityService,
      );

      expect(() => securityHandler.validateFeatureEnabled(feature)).toThrow(
        expect.objectContaining({
          data: null,
          init: { status: 404 },
          type: 'DataWithResponseInit',
        }),
      );
    });

    it('should not throw if feature is enabled', () => {
      const feature: FeatureName = 'hcaptcha';

      const securityHandler = new DefaultSecurityHandler(
        { ENABLED_FEATURES: ['hcaptcha'], ENROLLMENT_STATUS_CODE_ENROLLED: 'enrolled' }, // Mocked server config
        mockCsrfTokenValidator,
        mockHCaptchaValidator,
        mockRaoidcSessionValidator,
        mockClientApplicationService,
        mockApplicantService,

        mockClientEligibilityService,
      );

      expect(() => securityHandler.validateFeatureEnabled(feature)).not.toThrow();
    });
  });

  describe('validateHCaptchaResponse', () => {
    it('should call the onInvalidHCaptcha callback if the hCaptcha response is invalid', async () => {
      // Mocking the hCaptcha validation to return an invalid result
      mockHCaptchaValidator.validateHCaptchaResponse.mockResolvedValue({ isValid: false, errorMessage: 'Invalid hCaptcha' });

      const mockFormData = mock<FormData>();
      mockFormData.get.calledWith('h-captcha-response').mockReturnValue('invalid-response');
      const mockRequest = mock<Request>();
      const mockOnInvalidHCaptcha = vi.fn();
      vi.mocked(getClientIpAddress).mockReturnValue('192.168.0.1');

      const params = {
        formData: mockFormData,
        request: mockRequest,
        userId: 'user-id',
      };

      await securityHandler.validateHCaptchaResponse(params, mockOnInvalidHCaptcha);

      expect(mockFormData.get).toBeCalledWith('h-captcha-response');
      expect(getClientIpAddress).toHaveBeenCalledWith(mockRequest);
      expect(mockOnInvalidHCaptcha).toHaveBeenCalled();
    });

    it('should skip hCaptcha validation if the feature is disabled', async () => {
      // Mocking the server config to disable hCaptcha
      securityHandler = new DefaultSecurityHandler(
        { ENABLED_FEATURES: [], ENROLLMENT_STATUS_CODE_ENROLLED: 'enrolled' }, // hCaptcha feature is not enabled
        mockCsrfTokenValidator,
        mockHCaptchaValidator,
        mockRaoidcSessionValidator,
        mockClientApplicationService,
        mockApplicantService,

        mockClientEligibilityService,
      );

      const mockFormData = mock<FormData>();
      mockFormData.get.calledWith('h-captcha-response').mockReturnValue('some-response');
      const mockRequest = mock<Request>();
      const mockOnInvalidHCaptcha = vi.fn();
      vi.mocked(getClientIpAddress).mockReturnValue('192.168.0.1');

      const params = {
        formData: mockFormData,
        request: mockRequest,
        userId: 'user-id',
      };

      await securityHandler.validateHCaptchaResponse(params, mockOnInvalidHCaptcha);

      // Expect the callback not to be called if hCaptcha feature is disabled
      expect(mockFormData.get).not.toBeCalled();
      expect(getClientIpAddress).not.toHaveBeenCalled();
      expect(mockOnInvalidHCaptcha).not.toHaveBeenCalled();
    });

    it('should not call the onInvalidHCaptcha callback if the hCaptcha response is valid', async () => {
      // Mocking the hCaptcha validation to return a valid result
      mockHCaptchaValidator.validateHCaptchaResponse.mockResolvedValue({ isValid: true });

      const mockFormData = mock<FormData>();
      mockFormData.get.calledWith('h-captcha-response').mockReturnValue('some-response');
      const mockRequest = mock<Request>();
      const mockOnInvalidHCaptcha = vi.fn();
      vi.mocked(getClientIpAddress).mockReturnValue('192.168.0.1');

      const params = {
        formData: mockFormData,
        request: mockRequest,
        userId: 'user-id',
      };

      await securityHandler.validateHCaptchaResponse(params, mockOnInvalidHCaptcha);

      // Expect the callback not to be called if validation passes
      expect(mockOnInvalidHCaptcha).not.toHaveBeenCalled();
      expect(mockFormData.get).toBeCalledWith('h-captcha-response');
      expect(getClientIpAddress).toHaveBeenCalledWith(mockRequest);
    });
  });

  describe('validateRequestMethod', () => {
    it('should allow valid request methods', () => {
      const allowedMethods: ValidateRequestMethodParams['allowedMethods'] = ['GET', 'POST'];
      const request = new Request('https://example.com/test', { method: 'GET' });

      securityHandler.validateRequestMethod({ allowedMethods, request });

      expect(mockLogger.debug).toHaveBeenCalledWith('Validating request method [%s] for path [%s] with allowed methods [%s]', 'GET', '/test', allowedMethods);
      expect(mockLogger.debug).toHaveBeenCalledWith('Request method [%s] is allowed for path [%s] with allowed methods [%s]', 'GET', '/test', allowedMethods);
    });

    it('should throw 405 error for invalid request methods', () => {
      const allowedMethods: ValidateRequestMethodParams['allowedMethods'] = ['GET', 'POST'];
      const request = new Request('https://example.com/test', { method: 'PUT' });

      expect(() => securityHandler.validateRequestMethod({ allowedMethods, request })).toThrow(
        expect.objectContaining({
          data: { message: 'Method PUT not allowed' },
          init: { status: 405 },
          type: 'DataWithResponseInit',
        }),
      );

      expect(mockLogger.debug).toHaveBeenCalledWith('Validating request method [%s] for path [%s] with allowed methods [%s]', 'PUT', '/test', allowedMethods);
      expect(mockLogger.warn).toHaveBeenCalledWith('Request method [%s] is not allowed for path [%s] with allowed methods [%s]; returning 405 response', 'PUT', '/test', allowedMethods);
    });
  });

  describe('requireClientApplication', () => {
    it('should throw redirect to auth/login if the session does not contain a userInfoToken or sin', async () => {
      const mockSession = mock<Session>();
      mockSession.id = 'session-id';
      mockSession.find.calledWith('userInfoToken').mockReturnValue(None);

      const mockRequestUrl = new URL('https://localhost:3000/en/protected-page');
      const params = { lang: 'en' };

      const error = await securityHandler.requireClientApplication({ requestUrl: mockRequestUrl, params, session: mockSession }).catch((error_) => error_);

      expect(error).toBeInstanceOf(Response);
      expect((error as Response).status).toBe(302);
      expect((error as Response).headers.get('Location')).toBe('/auth/login?returnto=%2Fen%2Fprotected-page%3F');
    });

    it('should throw a redirect response to data-unavailable if no client application is found', async () => {
      const mockSession = mock<Session>();
      mockSession.id = 'session-id';
      const userInfoToken = mock<UserinfoToken>({ sin: '123456789', sub: 'user-id' });
      mockSession.find.calledWith('userInfoToken').mockReturnValue(Some(userInfoToken));

      const mockRequestUrl = new URL('https://localhost:3000/en/protected-page');
      const params = { lang: 'en' };

      mockClientApplicationService.findClientApplicationBySin.calledWith(anyObject({ sin: '123456789', applicationYearId: '', sub: 'user-id' })).mockResolvedValueOnce(None);

      const error = await securityHandler.requireClientApplication({ requestUrl: mockRequestUrl, params, session: mockSession }).catch((error_) => error_);

      expect(error).toBeInstanceOf(Response);
      expect((error as Response).status).toBe(302);
      expect((error as Response).headers.get('Location')).toBe('/en/protected/data-unavailable');
    });

    // added test for the new redirectUrl option
    it('should throw a redirect response to the custom redirectUrl if no client application is found', async () => {
      const mockSession = mock<Session>();
      mockSession.id = 'session-id';
      const userInfoToken = mock<UserinfoToken>({ sin: '123456789', sub: 'user-id' });
      mockSession.find.calledWith('userInfoToken').mockReturnValue(Some(userInfoToken));

      const mockRequestUrl = new URL('https://localhost:3000/en/protected-page');
      const params = { lang: 'en' };
      const customRedirectUrl = '/en/custom-data-unavailable';

      mockClientApplicationService.findClientApplicationBySin.calledWith(anyObject({ sin: '123456789', applicationYearId: '', sub: 'user-id' })).mockResolvedValueOnce(None);

      const error = await securityHandler.requireClientApplication({ requestUrl: mockRequestUrl, params, session: mockSession, options: { redirectUrl: customRedirectUrl } }).catch((error_) => error_);

      expect(error).toBeInstanceOf(Response);
      expect((error as Response).status).toBe(302);
      expect((error as Response).headers.get('Location')).toBe(customRedirectUrl);
    });

    it('should return the client application if found', async () => {
      const mockSession = mock<Session>();
      mockSession.id = 'session-id';
      const userInfoToken = mock<UserinfoToken>({ sin: '123456789', sub: 'user-id' });
      mockSession.find.calledWith('userInfoToken').mockReturnValue(Some(userInfoToken));

      const mockRequestUrl = new URL('https://localhost:3000/en/protected-page');
      const params = { lang: 'en' };

      const mockClientApplication = mock<ClientApplicationDto>({
        applicantInformation: {
          firstName: 'John',
          lastName: 'Doe',
          clientId: 'client-id',
          clientNumber: 'client-number',
          maritalStatus: 'single',
          socialInsuranceNumber: '123456789',
        },
      });

      mockClientApplicationService.findClientApplicationBySin.calledWith(anyObject({ sin: '123456789', applicationYearId: '', sub: 'user-id' })).mockResolvedValue(Some(mockClientApplication));

      const clientApplication = await securityHandler.requireClientApplication({ requestUrl: mockRequestUrl, params, session: mockSession });
      expect(clientApplication).toBe(mockClientApplication);
    });
  });

  describe('requireEnrolledApplicant', () => {
    it('should throw redirect to ineligible page if the applicant is not enrolled', async () => {
      const clientNumber = 'client-number-123';
      const params = { lang: 'en' };

      mockClientEligibilityService.listClientEligibilitiesByClientNumbers //
        .calledWith(anyArray([clientNumber]))
        .mockResolvedValueOnce(
          new Map([
            [
              clientNumber,
              {
                clientId: 'client-id-123',
                clientNumber: clientNumber,
                earnings: [],
                firstName: 'John',
                lastName: 'Doe',
                eligibilityStatusCode: 'eligible',
                enrollmentStatusCode: 'not-enrolled',
              },
            ],
          ]),
        );

      const error = await securityHandler.requireEnrolledApplicant({ clientNumber, params }).catch((error_) => error_);

      expect(error).toBeInstanceOf(Response);
      expect((error as Response).status).toBe(302);
      expect((error as Response).headers.get('Location')).toBe('/en/protected/data-unavailable');
    });

    it('should not throw if the applicant is enrolled', async () => {
      const clientNumber = 'client-number-123';
      const params = { lang: 'en' };

      mockClientEligibilityService.listClientEligibilitiesByClientNumbers //
        .calledWith(anyArray([clientNumber]))
        .mockResolvedValueOnce(
          new Map([
            [
              clientNumber,
              {
                clientId: 'client-id-123',
                clientNumber: clientNumber,
                earnings: [],
                firstName: 'John',
                lastName: 'Doe',
                eligibilityStatusCode: 'eligible',
                enrollmentStatusCode: 'enrolled',
              },
            ],
          ]),
        );

      await expect(securityHandler.requireEnrolledApplicant({ clientNumber, params })).resolves.not.toThrow();
    });
  });
});
