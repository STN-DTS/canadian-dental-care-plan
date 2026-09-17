import { createContext } from 'react-router';
import type { RouterContextProvider } from 'react-router';

import type { ApplicantDto, ProgramApplicantDto } from '~/.server/domain/dtos';
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

type ProgramApplicantContext = ProgramApplicantDto;

/**
 * React Router context containing the current program applicant details.
 */
export const programApplicantContext = createContext<ProgramApplicantContext | null>(null);

/**
 * Retrieves the current program applicant from React Router context.
 *
 * @param context React Router context provider containing program applicant details.
 * @returns Current {@link ProgramApplicantContext}.
 * @throws If program applicant details have not been set in the context.
 */
export function getProgramApplicant(context: Readonly<RouterContextProvider>): ProgramApplicantContext {
  const programApplicant = context.get(programApplicantContext);

  if (!programApplicant) {
    throw new AppError('Program applicant context is not available. Ensure that the program applicant has been set in the context.');
  }

  return programApplicant;
}
