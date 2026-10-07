import { Outlet, redirect } from 'react-router';

import type { Route } from './+types/upload-layout';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import { getApplicant } from '~/.server/context/applicant-context';
import { getPathById } from '~/utils/route-utils';

/**
 * Middleware that permits access to the document upload route only for eligible applicants.
 *
 * Applicants must have at least one application paused due to a T4 mismatch. Ineligible
 * applicants are redirected to the not-required page.
 */
const appealUploadEligibilityMiddleware: Route.MiddlewareFunction = async ({ context, params }) => {
  const { appContainer } = context.get(appContext);
  const applicant = getApplicant(context);

  const appealUploadEligibilityService = appContainer.get(TYPES.AppealUploadEligibilityService);
  const appealUploadEligibility = await appealUploadEligibilityService.findAppealUploadEligibility(applicant.clientNumber);
  const canUploadAppealDocuments = appealUploadEligibility.isSome() && appealUploadEligibility.unwrap().canUploadAppealDocuments;

  if (!canUploadAppealDocuments) {
    throw redirect(getPathById('protected/documents/not-required', params));
  }
};

export const middleware: Route.MiddlewareFunction[] = [appealUploadEligibilityMiddleware];

export default function UploadLayout() {
  return <Outlet />;
}
