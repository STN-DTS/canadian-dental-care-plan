import type { MiddlewareFunction } from 'react-router';

import { TYPES } from '~/.server/constants/';
import { appContext } from '~/.server/context';
import { applicantContext, programApplicantContext } from '~/.server/context/applicant-context';

/**
 * Resolves the applicant for the current route and adds it to React Router context.
 * Requests that cannot resolve an applicant are handled by `SecurityHandler.requireApplicant`.
 */
export const applicantMiddleware: MiddlewareFunction<Response> = async ({ context, params, url }, next) => {
  const { appContainer, session } = context.get(appContext);
  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  const applicant = await securityHandler.requireApplicant({ params, requestUrl: url, session });
  context.set(applicantContext, applicant);
  return await next();
};

/**
 * Resolves the program applicant for the current route and adds it to React Router context.
 * Requests that cannot resolve an applicant are handled by `SecurityHandler.requireProgramApplicant`.
 */
export const programApplicantMiddleware: MiddlewareFunction<Response> = async ({ context, params, url }, next) => {
  const { appContainer, session } = context.get(appContext);
  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  const programApplicant = await securityHandler.requireProgramApplicant({ params, requestUrl: url, session });
  context.set(programApplicantContext, programApplicant);
  return await next();
};
