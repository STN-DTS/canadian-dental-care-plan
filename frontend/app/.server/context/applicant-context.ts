import { createContext } from 'react-router';
import type { RouterContextProvider } from 'react-router';

import type { ApplicantDto, ProgramApplicantDto } from '~/.server/domain/dtos';
import { AppError } from '~/errors/app-error';
import { getContext } from '~/middlewares/context-storage.server';

type ApplicantContext = ApplicantDto;

/**
 * React Router context containing the current applicant details.
 */
export const applicantContext = createContext<ApplicantContext | null>(null);

/**
 * Gets applicant details from provided router context or current request context.
 *
 * @param context - Optional router context provider. Defaults to current request context.
 * @returns Applicant details associated with selected context.
 * @throws {AppError} When applicant context has not been populated.
 */
export function getApplicant(context?: Readonly<RouterContextProvider>): ApplicantContext {
  const ctx = context ?? getContext();
  const applicant = ctx.get(applicantContext);

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
 * Gets program applicant details from provided router context or current request context.
 *
 * @param context - Optional router context provider. Defaults to current request context.
 * @returns Program applicant details associated with selected context.
 * @throws {AppError} When program applicant context has not been populated.
 */
export function getProgramApplicant(context?: Readonly<RouterContextProvider>): ProgramApplicantContext {
  const ctx = context ?? getContext();
  const programApplicant = ctx.get(programApplicantContext);

  if (!programApplicant) {
    throw new AppError('Program applicant context is not available. Ensure that the program applicant has been set in the context.');
  }

  return programApplicant;
}
