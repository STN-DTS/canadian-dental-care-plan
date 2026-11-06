import { data, redirect, redirectDocument } from 'react-router';
import type { Params } from 'react-router';

import { ATTR_HTTP_REQUEST_METHOD, ATTR_URL_PATH } from '@opentelemetry/semantic-conventions';
// session.id is currently an incubating OpenTelemetry convention.
import { ATTR_SESSION_ID } from '@opentelemetry/semantic-conventions/incubating';
import { Option } from 'effect';
import { inject, injectable } from 'inversify';

import type { ServerConfig } from '~/.server/configs';
import { TYPES } from '~/.server/constants';
import type { ApplicantDto, ClientApplicationDto, ProgramApplicantDto } from '~/.server/domain/dtos';
import type { ApplicantService, ClientApplicationService, ClientEligibilityService, ProgramApplicantService } from '~/.server/domain/services';
import { createLogger } from '~/.server/logging';
import type { Logger } from '~/.server/logging';
import { ATTR_CDCP_FEATURE_NAME, ATTR_CDCP_HTTP_ALLOWED_METHODS } from '~/.server/logging/log-attributes';
import { getClientIpAddress } from '~/.server/utils/ip-address-utils';
import type { Session } from '~/.server/web/session';
import type { HCaptchaValidator, RaoidcSessionValidator } from '~/.server/web/validators';
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
   * Ensures that the user has an applicant associated with their SIN.
   *
   * @param args - Parameters containing the request, session, and route params.
   * @throws Throws a redirect response if no applicant is found.
   * @returns Resolves with the applicant DTO if found.
   */
  requireApplicant(args: RequireApplicantArgs): Promise<ApplicantDto>;

  /**
   * Ensures that the user has a program applicant associated with their SIN.
   *
   * @param args - Parameters containing the request, session, and route params.
   * @throws Throws a redirect response if no applicant is found or the applicant has no assigned type.
   * @returns Resolves with the program applicant DTO if found.
   */
  requireProgramApplicant(args: RequireApplicantArgs): Promise<ProgramApplicantDto>;

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
  private readonly hCaptchaValidator: HCaptchaValidator;
  private readonly raoidcSessionValidator: RaoidcSessionValidator;
  private readonly clientApplicationService: ClientApplicationService;
  private readonly applicantService: ApplicantService;
  private readonly programApplicantService: ProgramApplicantService;
  private readonly clientEligibilityService: ClientEligibilityService;

  constructor(
    @inject(TYPES.ServerConfig) serverConfig: Pick<ServerConfig, 'ENABLED_FEATURES' | 'ENROLLMENT_STATUS_CODE_ENROLLED'>,
    @inject(TYPES.HCaptchaValidator) hCaptchaValidator: HCaptchaValidator,
    @inject(TYPES.RaoidcSessionValidator) raoidcSessionValidator: RaoidcSessionValidator,
    @inject(TYPES.ClientApplicationService) clientApplicationService: ClientApplicationService,
    @inject(TYPES.ApplicantService) applicantService: ApplicantService,
    @inject(TYPES.ProgramApplicantService) programApplicantService: ProgramApplicantService,
    @inject(TYPES.ClientEligibilityService) clientEligibilityService: ClientEligibilityService,
  ) {
    this.log = createLogger('DefaultSecurityHandler');
    this.serverConfig = serverConfig;
    this.hCaptchaValidator = hCaptchaValidator;
    this.raoidcSessionValidator = raoidcSessionValidator;
    this.clientApplicationService = clientApplicationService;
    this.applicantService = applicantService;
    this.programApplicantService = programApplicantService;
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
    this.log.debug('Validating RAOIDC session', { [ATTR_SESSION_ID]: session.id });
    const result = await this.raoidcSessionValidator.validateRaoidcSession({ session });

    if (!result.isValid) {
      this.log.debug('RAOIDC session is invalid; redirecting to login', { [ATTR_SESSION_ID]: session.id });
      const { pathname, searchParams } = requestUrl;
      const returnTo = encodeURIComponent(`${pathname}?${searchParams}`);
      throw redirectDocument(`/auth/login?returnto=${returnTo}`);
    }

    this.log.debug('RAOIDC session is valid');
  }

  /**
   * Validates that a given feature is enabled.
   *
   * @param feature - The feature to validate.
   * @throws {Response} Throws a 404 Not Found response if the feature is not enabled.
   * @returns {void} Resolves if the feature is enabled.
   */
  validateFeatureEnabled(feature: FeatureName): void {
    this.log.debug('Validating feature', { [ATTR_CDCP_FEATURE_NAME]: feature });

    if (!this.serverConfig.ENABLED_FEATURES.includes(feature)) {
      this.log.debug('Feature is not enabled; returning 404 response', { [ATTR_CDCP_FEATURE_NAME]: feature });
      throw data(null, { status: 404 });
    }

    this.log.debug('Feature is enabled', { [ATTR_CDCP_FEATURE_NAME]: feature });
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
      this.log.debug('hCaptcha response is invalid; invoking rejection callback');
      await invalidHCaptchaCallback();
      return;
    }

    this.log.debug('hCaptcha response is valid');
  }

  validateRequestMethod({ allowedMethods, request }: ValidateRequestMethodParams): void {
    type AllowedMethods = ValidateRequestMethodParams['allowedMethods'][number];
    const { pathname } = new URL(request.url);
    const { method } = request;

    this.log.debug('Validating request method', { [ATTR_HTTP_REQUEST_METHOD]: method, [ATTR_URL_PATH]: pathname, [ATTR_CDCP_HTTP_ALLOWED_METHODS]: [...allowedMethods] });

    if (!allowedMethods.includes(method as AllowedMethods)) {
      this.log.debug('Request method not allowed; returning 405 response', { [ATTR_HTTP_REQUEST_METHOD]: method, [ATTR_URL_PATH]: pathname, [ATTR_CDCP_HTTP_ALLOWED_METHODS]: [...allowedMethods] });
      throw data({ message: `Method ${method} not allowed` }, { status: 405 });
    }

    this.log.debug('Request method is allowed', { [ATTR_HTTP_REQUEST_METHOD]: method, [ATTR_URL_PATH]: pathname, [ATTR_CDCP_HTTP_ALLOWED_METHODS]: [...allowedMethods] });
  }

  async requireClientApplication({ applicationYearId, params, requestUrl, session, options }: RequireClientApplicationParams): Promise<ClientApplicationDto> {
    this.log.debug('Requiring client application', { [ATTR_SESSION_ID]: session.id });
    const userInfoToken = Option.getOrUndefined(session.find('userInfoToken'));

    if (!userInfoToken?.sin) {
      this.log.debug('Required identity claim missing; redirecting to login', { [ATTR_SESSION_ID]: session.id });
      const { pathname, searchParams } = requestUrl;
      const returnTo = encodeURIComponent(`${pathname}?${searchParams}`);
      throw redirectDocument(`/auth/login?returnto=${returnTo}`);
    }

    const clientApplicationOption = await this.clientApplicationService.findClientApplicationBySin({
      applicationYearId,
      sin: userInfoToken.sin,
      userId: userInfoToken.sub,
    });

    if (Option.isNone(clientApplicationOption)) {
      const redirectUrl = options?.redirectUrl ?? getPathById('protected/data-unavailable', params);
      this.log.debug('No client application found; redirecting', { [ATTR_SESSION_ID]: session.id });
      throw redirect(redirectUrl);
    }

    this.log.debug('Client application found', { [ATTR_SESSION_ID]: session.id });
    return Option.getOrThrow(clientApplicationOption);
  }

  async requireApplicant({ params, requestUrl, session }: RequireApplicantArgs): Promise<ApplicantDto> {
    this.log.debug('Requiring applicant', { [ATTR_SESSION_ID]: session.id });

    const userInfoToken = Option.getOrUndefined(session.find('userInfoToken'));

    if (!userInfoToken?.sin) {
      this.log.debug('Required identity claim missing; redirecting to login', { [ATTR_SESSION_ID]: session.id });
      const { pathname, searchParams } = requestUrl;
      const returnTo = encodeURIComponent(`${pathname}?${searchParams}`);
      throw redirectDocument(`/auth/login?returnto=${returnTo}`);
    }

    if (session.has('applicant')) {
      const applicant = session.get('applicant');
      this.log.debug('Applicant found in session', { [ATTR_SESSION_ID]: session.id });
      return applicant;
    }

    const applicantOption = await this.applicantService.findApplicantBySin({
      sin: userInfoToken.sin,
      userId: userInfoToken.sub,
    });

    if (Option.isNone(applicantOption)) {
      this.log.debug('No applicant found; redirecting to data unavailable', { [ATTR_SESSION_ID]: session.id });
      throw redirect(getPathById('protected/data-unavailable', params));
    }

    const applicant = Option.getOrThrow(applicantOption);

    session.set('applicant', applicant);

    this.log.debug('Applicant found', { [ATTR_SESSION_ID]: session.id });
    return applicant;
  }

  async requireProgramApplicant({ params, requestUrl, session }: RequireApplicantArgs): Promise<ProgramApplicantDto> {
    this.log.debug('Requiring program applicant', { [ATTR_SESSION_ID]: session.id });

    const userInfoToken = Option.getOrUndefined(session.find('userInfoToken'));

    if (!userInfoToken?.sin) {
      this.log.debug('Required identity claim missing; redirecting to login', { [ATTR_SESSION_ID]: session.id });
      const { pathname, searchParams } = requestUrl;
      const returnTo = encodeURIComponent(`${pathname}?${searchParams}`);
      throw redirectDocument(`/auth/login?returnto=${returnTo}`);
    }

    if (session.has('programApplicant')) {
      const programApplicant = session.get('programApplicant');
      this.log.debug('Program applicant found in session', { [ATTR_SESSION_ID]: session.id });
      return programApplicant;
    }

    const programApplicantOption = await this.programApplicantService.findProgramApplicantBySin({
      sin: userInfoToken.sin,
      userId: userInfoToken.sub,
    });

    if (Option.isNone(programApplicantOption)) {
      this.log.debug('No program applicant found; redirecting to data unavailable', { [ATTR_SESSION_ID]: session.id });
      throw redirect(getPathById('protected/data-unavailable', params));
    }

    const programApplicant = Option.getOrThrow(programApplicantOption);

    session.set('programApplicant', programApplicant);

    this.log.debug('Program applicant found', { [ATTR_SESSION_ID]: session.id });
    return programApplicant;
  }

  async requireEnrolledApplicant({ clientNumber, params, options = {} }: RequireEnrolledApplicantArgs): Promise<void> {
    this.log.debug('Requiring enrolled applicant');

    const clientEligibilities = await this.clientEligibilityService.listClientEligibilitiesByClientNumbers([clientNumber]);
    const enrollmentStatusCode = clientEligibilities.get(clientNumber)?.enrollmentStatusCode;

    if (enrollmentStatusCode !== this.serverConfig.ENROLLMENT_STATUS_CODE_ENROLLED) {
      const redirectUrl = options.redirectUrl ?? getPathById('protected/data-unavailable', params);
      this.log.debug('Applicant is not enrolled; redirecting');
      throw redirect(redirectUrl);
    }
  }
}
