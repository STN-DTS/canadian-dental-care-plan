import { createContext } from 'react-router';
import type { RouterContextProvider } from 'react-router';

import type { ApplicantDto } from '~/.server/domain/dtos';
import { AppError } from '~/errors/app-error';

type ApplicantContext = ApplicantDto;

/**
 * React Router context containing the current applicant details.
 */
export const applicantContext = createContext<ApplicantContext | null>(null);

/**
 * Retrieves the current applicant from React Router context.
 *
 * @param context React Router context provider containing applicant details.
 * @returns Current {@link ApplicantContext}.
 * @throws If applicant details have not been set in the context.
 */
export function getApplicant(context: Readonly<RouterContextProvider>): ApplicantContext {
  const applicant = context.get(applicantContext);

  if (!applicant) {
    throw new AppError('Applicant context is not available. Ensure that the applicant has been set in the context.');
  }

  return applicant;
}
