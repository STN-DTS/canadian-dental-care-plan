import { data, redirect, redirectDocument } from 'react-router';
import type { Params } from 'react-router';

import { inject, injectable } from 'inversify';

import type { ServerConfig } from '~/.server/configs';
import { TYPES } from '~/.server/constants';
import type { ApplicantDto, ClientApplicationDto } from '~/.server/domain/dtos';
import type { ApplicantService, ClientApplicationService, ClientEligibilityService } from '~/.server/domain/services';
import { createLogger } from '~/.server/logging';
import type { Logger } from '~/.server/logging';
import { getClientIpAddress } from '~/.server/utils/ip-address.utils';
import type { Session } from '~/.server/web/session';
import type { CsrfTokenValidator, HCaptchaValidator, RaoidcSessionValidator } from '~/.server/web/validators';
import type { FeatureName } from '~/utils/env-utils';
import { getPathById } from '~/utils/route-utils';

/**
 * Parameters for validating the RAOIDC authentication session.
 */
export interface ValidateAuthSessionParams {
  /**  The incoming request URL to validate. */
  requestUrl: URL;

  /**  The session object to validate.*/
  session: Session;
}

/**
 * Parameters for validating the CSRF token.
 */
export interface ValidateCsrfTokenParams {
  /** The CSRF token from the request form data. */
  formData: FormData;

  /** The CSRF token from the session. */
  session: Session;
}

/**
 * Parameters for validating the hCaptcha response.
 */
export interface ValidateHCaptchaResponseParams {
  /** The hCaptcha response from the request form data. */
  formData: FormData;

  /** The incoming request, used to extract the user's IP address. */
  request: Pick<Request, 'headers'>;

  /** The user ID performing the validation (defaults to 'anonymous' if not provided). */
  userId?: string;
}

/**
 * Callback function to invoke if the hCaptcha validation fails.
 */
export type InvalidHCaptchaCallback = () => Promise<void> | void;

/**
 * Parameters for validating the request method.
 */
export interface ValidateRequestMethodParams {
  /** The list of allowed HTTP methods. */
  allowedMethods: Array<'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'>;

  /** The incoming request. */
  request: Pick<Request, 'method' | 'url'>;
}

/**
 * Parameters for requiring client application.
 */
export interface RequireClientApplicationParams {
  applicationYearId?: string;
  params: Params;
  requestUrl: URL;
  session: Session;
  options?: {
    /** Custom URL to redirect to instead of the default data-unavailable route */
    redirectUrl?: string;
  };
}

/**
 * Arguments for requiring applicant.
 */
export interface RequireApplicantArgs {
  params: Params;
  requestUrl: URL;
  session: Session;
}

/**
 * Arguments for requiring enrolled applicant.
 */
export interface RequireEnrolledApplicantArgs {
  clientNumber: string;
  params: Params;
  options?: {
    /** Custom URL to redirect to instead of the default data-unavailable route */
    redirectUrl?: string;
  };
}

/**
 * Security handler interface that defines methods for validating authentication sessions, CSRF tokens, and hCaptcha responses.
 */
export interface SecurityHandler {
  /**
   * Validates the RAOIDC authentication session.
   *
   * @param params - Parameters containing the session and request URL.
   * @throws Throws a redirect response if the session is invalid.
   * @returns Resolves if the session is valid.
   */
  validateAuthSession(params: ValidateAuthSessionParams): Promise<void>;

  /**
   * Validates the CSRF token in the request.
   *
   * @param params - Parameters containing the CSRF token from the request and session.
   * @throws Throws a 403 Forbidden response if the CSRF token is invalid.
   * @returns Resolves if the token is valid.
   */
  validateCsrfToken(params: ValidateCsrfTokenParams): void;

  /**
   * Validates that a given feature is enabled.
   *
   * @param feature - The feature to validate.
   * @throws Throws a 404 Not Found response if the feature is not enabled.
   * @returns Resolves if the feature is enabled.
   */
  validateFeatureEnabled(feature: FeatureName): void;

  /**
   * Validates the hCaptcha response in the request.
   *
   * @param params - Parameters containing the hCaptcha response and an optional callback for invalid responses.
   * @param invalidHCaptchaCallback - Callback function invoked if hCaptcha validation fails.
   * @returns Resolves after validation is complete.
   */
  validateHCaptchaResponse(params: ValidateHCaptchaResponseParams, invalidHCaptchaCallback: InvalidHCaptchaCallback): Promise<void>;

  /**
   * Validates the request method against a list of allowed methods.
   *
   * @param params - Parameters containing the allowed methods and the incoming request.
   * @throws Throws a 405 Method Not Allowed response if the request method is not allowed.
   * @returns Resolves if the request method is allowed.
   */
  validateRequestMethod(params: ValidateRequestMethodParams): void;

  /**
   * Ensures that the user has a client application associated with their SIN.
   *
   * @param params - Parameters containing the request, session, and route params.
   * @throws Throws a redirect response if no client application is found.
   * @returns Resolves if a client application is found.
   */
  requireClientApplication(params: RequireClientApplicationParams): Promise<ClientApplicationDto>;

  /**
   * Ensures that the user has a applicant associated with their SIN.
   *
   * @param args - Parameters containing the request, session, and route params.
   * @throws Throws a redirect response if no applicant is found.
   * @returns Resolves with the applicant DTO if found.
   */
  requireApplicant(args: RequireApplicantArgs): Promise<ApplicantDto>;

  /**
   * Ensures that the applicant with the given client number is enrolled.
   *
   * @param args - Parameters containing the client number, request, session, and route params.
   * @throws Throws a redirect response if the applicant is not enrolled.
   * @returns Resolves if the applicant is enrolled.
   */
  requireEnrolledApplicant(args: RequireEnrolledApplicantArgs): Promise<void>;
}

/**
 * Default implementation of the SecurityHandler interface.
 */
@injectable()
export class DefaultSecurityHandler implements SecurityHandler {
  private readonly log: Logger;
  private readonly serverConfig: Pick<ServerConfig, 'ENABLED_FEATURES' | 'ENROLLMENT_STATUS_CODE_ENROLLED'>;
  private readonly csrfTokenValidator: CsrfTokenValidator;
  private readonly hCaptchaValidator: HCaptchaValidator;
  private readonly raoidcSessionValidator: RaoidcSessionValidator;
  private readonly clientApplicationService: ClientApplicationService;
  private readonly applicantService: ApplicantService;
  private readonly clientEligibilityService: ClientEligibilityService;

  constructor(
    @inject(TYPES.ServerConfig) serverConfig: Pick<ServerConfig, 'ENABLED_FEATURES' | 'ENROLLMENT_STATUS_CODE_ENROLLED'>,
    @inject(TYPES.CsrfTokenValidator) csrfTokenValidator: CsrfTokenValidator,
    @inject(TYPES.HCaptchaValidator) hCaptchaValidator: HCaptchaValidator,
    @inject(TYPES.RaoidcSessionValidator) raoidcSessionValidator: RaoidcSessionValidator,
    @inject(TYPES.ClientApplicationService) clientApplicationService: ClientApplicationService,
    @inject(TYPES.ApplicantService) applicantService: ApplicantService,
    @inject(TYPES.ClientEligibilityService) clientEligibilityService: ClientEligibilityService,
  ) {
    this.log = createLogger('DefaultSecurityHandler');
    this.serverConfig = serverConfig;
    this.csrfTokenValidator = csrfTokenValidator;
    this.hCaptchaValidator = hCaptchaValidator;
    this.raoidcSessionValidator = raoidcSessionValidator;
    this.clientApplicationService = clientApplicationService;
    this.applicantService = applicantService;
    this.clientEligibilityService = clientEligibilityService;
  }

  /**
   * Validates the RAOIDC authentication session.
   *
   * @param params - The session and request URL to validate.
   * @throws {Response} Redirects to the login page if the session is invalid.
   * @returns {Promise<void>} Resolves if the session is valid.
   */
  async validateAuthSession({ requestUrl, session }: ValidateAuthSessionParams): Promise<void> {
    this.log.debug('Validating RAOIDC session [%s]', session.id);
    const result = await this.raoidcSessionValidator.validateRaoidcSession({ session });

    if (!result.isValid) {
      this.log.debug('RAOIDC session [%s] is invalid; errorMessage: %s', session.id, result.errorMessage);
      const { pathname, searchParams } = requestUrl;
      const returnTo = encodeURIComponent(`${pathname}?${searchParams}`);
      throw redirectDocument(`/auth/login?returnto=${returnTo}`);
    }

    this.log.debug('RAOIDC session is valid');
  }

  /**
   * Validates the CSRF token.
   *
   * @param params - Contains the CSRF token from the request and session to validate.
   * @throws {Response} Throws a 403 Forbidden response if the CSRF token is invalid.
   * @returns {void} Resolves if the token is valid.
   */
  validateCsrfToken({ formData, session }: ValidateCsrfTokenParams): void {
    this.log.debug('Validating CSRF token');

    const requestToken = String(formData.get('_csrf'));
    const sessionToken = session.get('csrfToken');

    const result = this.csrfTokenValidator.validateCsrfToken({ requestToken, sessionToken });

    if (!result.isValid) {
      this.log.debug('CSRF token is invalid; errorMessage: %s', result.errorMessage);
      throw data('Invalid CSRF token', { status: 403 });
    }

    this.log.debug('CSRF token is valid');
  }

  /**
   * Validates that a given feature is enabled.
   *
   * @param feature - The feature to validate.
   * @throws {Response} Throws a 404 Not Found response if the feature is not enabled.
   * @returns {void} Resolves if the feature is enabled.
   */
  validateFeatureEnabled(feature: FeatureName): void {
    this.log.debug('Validating feature [%s]', feature);

    if (!this.serverConfig.ENABLED_FEATURES.includes(feature)) {
      this.log.warn('Feature [%s] is not enabled; returning 404 response', feature);
      throw data(null, { status: 404 });
    }

    this.log.debug('Feature [%s] is enabled', feature);
  }

  /**
   * Validates the hCaptcha response.
   *
   * @param params - The hCaptcha response and the request to extract the IP address.
   * @param invalidHCaptchaCallback - Callback function invoked if hCaptcha validation fails.
   * @returns {Promise<void>} Resolves after validation is complete.
   */
  async validateHCaptchaResponse({ formData, request, userId = 'anonymous' }: ValidateHCaptchaResponseParams, invalidHCaptchaCallback: InvalidHCaptchaCallback): Promise<void> {
    this.log.debug('Validating hCaptcha response');

    const isHcaptchaEnabled = this.serverConfig.ENABLED_FEATURES.includes('hcaptcha');
    if (!isHcaptchaEnabled) {
      this.log.debug('hCaptcha feature is disabled; skipping hCaptcha validation');
      return;
    }

    const hCaptchaResponse = String(formData.get('h-captcha-response'));
    const ipAddress = getClientIpAddress(request) ?? undefined;

    const result = await this.hCaptchaValidator.validateHCaptchaResponse({ hCaptchaResponse, ipAddress, userId });
    if (!result.isValid) {
      this.log.debug('hCaptcha response is invalid; errorMessage: %s', result.errorMessage);
      await invalidHCaptchaCallback();
      return;
    }

    this.log.debug('hCaptcha response is valid');
  }

  validateRequestMethod({ allowedMethods, request }: ValidateRequestMethodParams): void {
    type AllowedMethods = ValidateRequestMethodParams['allowedMethods'][number];
    const { pathname } = new URL(request.url);
    const { method } = request;

    this.log.debug('Validating request method [%s] for path [%s] with allowed methods [%s]', method, pathname, allowedMethods);

    if (!allowedMethods.includes(method as AllowedMethods)) {
      this.log.warn('Request method [%s] is not allowed for path [%s] with allowed methods [%s]; returning 405 response', method, pathname, allowedMethods);
      throw data({ message: `Method ${method} not allowed` }, { status: 405 });
    }

    this.log.debug('Request method [%s] is allowed for path [%s] with allowed methods [%s]', method, pathname, allowedMethods);
  }

  async requireClientApplication({ applicationYearId, params, requestUrl, session, options }: RequireClientApplicationParams): Promise<ClientApplicationDto> {
    this.log.debug('Requiring client application for session [%s]', session.id);
    const userInfoToken = session.find('userInfoToken').unwrapUnchecked();

    if (!userInfoToken?.sin) {
      this.log.debug("User's SIN is not available in session [%s]; redirecting to login", session.id);
      const { pathname, searchParams } = requestUrl;
      const returnTo = encodeURIComponent(`${pathname}?${searchParams}`);
      throw redirectDocument(`/auth/login?returnto=${returnTo}`);
    }

    const clientApplicationOption = await this.clientApplicationService.findClientApplicationBySin({
      applicationYearId,
      sin: userInfoToken.sin,
      userId: userInfoToken.sub,
    });

    if (clientApplicationOption.isNone()) {
      const redirectUrl = options?.redirectUrl ?? getPathById('protected/data-unavailable', params);
      this.log.debug('No client application found for SIN [***-***-%s]; session [%s]; redirecting to [%s]', userInfoToken.sin.slice(-3), session.id, redirectUrl);
      throw redirect(redirectUrl);
    }

    this.log.debug('Client application found for SIN [***-***-%s]; session [%s]', userInfoToken.sin.slice(-3), session.id);
    return clientApplicationOption.unwrap();
  }

  async requireApplicant({ params, requestUrl, session }: RequireApplicantArgs): Promise<ApplicantDto> {
    this.log.debug('Requiring applicant for session [%s]', session.id);

    const userInfoToken = session.find('userInfoToken').unwrapUnchecked();

    if (!userInfoToken?.sin) {
      this.log.debug("User's SIN is not available in session [%s]; redirecting to login", session.id);
      const { pathname, searchParams } = requestUrl;
      const returnTo = encodeURIComponent(`${pathname}?${searchParams}`);
      throw redirectDocument(`/auth/login?returnto=${returnTo}`);
    }

    if (session.has('applicant')) {
      const applicant = session.get('applicant');
      this.log.debug('Applicant found in session [%s]', session.id);
      return applicant;
    }

    const applicantOption = await this.applicantService.findApplicantBySin({
      sin: userInfoToken.sin,
      userId: userInfoToken.sub,
    });

    if (applicantOption.isNone()) {
      this.log.debug('No applicant found for SIN [***-***-%s]; session [%s]; redirecting to data unavailable', userInfoToken.sin.slice(-3), session.id);
      throw redirect(getPathById('protected/data-unavailable', params));
    }

    const applicant = applicantOption.unwrap();

    session.set('applicant', applicant);

    this.log.debug('Applicant found for SIN [***-***-%s]; session [%s]', userInfoToken.sin.slice(-3), session.id);
    return applicant;
  }

  async requireEnrolledApplicant({ clientNumber, params, options = {} }: RequireEnrolledApplicantArgs): Promise<void> {
    this.log.debug('Requiring enrolled applicant with client number [%s]', clientNumber);

    const clientEligibilities = await this.clientEligibilityService.listClientEligibilitiesByClientNumbers([clientNumber]);
    const enrollmentStatusCode = clientEligibilities.get(clientNumber)?.enrollmentStatusCode;

    if (enrollmentStatusCode !== this.serverConfig.ENROLLMENT_STATUS_CODE_ENROLLED) {
      const redirectUrl = options.redirectUrl ?? getPathById('protected/data-unavailable', params);
      this.log.debug('Applicant with client number [%s] is not enrolled; enrollmentStatusCode: [%s]; redirecting to [%s]', clientNumber, enrollmentStatusCode, redirectUrl);
      throw redirect(redirectUrl);
    }
  }
}
