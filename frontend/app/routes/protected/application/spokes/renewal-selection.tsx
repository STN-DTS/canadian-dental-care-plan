import { data, redirect, useFetcher } from 'react-router';

import { invariant } from '@dts-stn/invariant';
import { useTranslation } from 'react-i18next';
import * as z from 'zod';

import type { Route } from './+types/renewal-selection';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import {
  getContextualAgeCategoryFromDate,
  getProtectedApplicationState,
  getTypeOfApplicationFromRenewalSelectionClientIds,
  saveProtectedApplicationState,
  validateProtectedApplicationContext,
} from '~/.server/routes/helpers/protected-application-route-helpers';
import type { ProtectedApplicationChildInformationState, ProtectedApplicationState } from '~/.server/routes/helpers/protected-application-route-helpers';
import { getFixedT } from '~/.server/utils/locale.utils';
import { transformFlattenedError } from '~/.server/utils/zod.utils';
import { AppPageTitle } from '~/components/app-page-title';
import { ButtonLink } from '~/components/buttons';
import { CsrfTokenInput } from '~/components/csrf-token-input';
import { ErrorSummary } from '~/components/error-summary';
import { ErrorSummaryProvider } from '~/components/error-summary-context';
import { InputCheckboxes } from '~/components/input-checkboxes';
import { LoadingButton } from '~/components/loading-button';
import { useFetcherSubmissionState } from '~/hooks';
import { pageIds } from '~/page-ids';
import { mergeMeta } from '~/utils/meta-utils';
import type { RouteHandleData } from '~/utils/route-utils';
import { getPathById } from '~/utils/route-utils';
import { getTitleMetaTags } from '~/utils/seo-utils';

export const handle = {
  pageIdentifier: pageIds.protected.application.spokes.renewalSelection,
} as const satisfies RouteHandleData;

export const meta: Route.MetaFunction = mergeMeta(({ loaderData }) => getTitleMetaTags(loaderData.meta.title));

export async function loader({ context, params, request }: Route.LoaderArgs) {
  const { appContainer, session } = context.get(appContext);
  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  await securityHandler.validateAuthSession({ request, session });

  const state = getProtectedApplicationState({ params, session });
  validateProtectedApplicationContext(state, params, 'renewal');

  const t = await getFixedT(request, ['protectedApplicationSpokes', 'gcweb']);
  const meta = {
    title: t(($) => $.meta.title.template, { ns: 'gcweb', title: t(($) => $.renewalSelection.pageTitle) }),
  };

  return {
    meta,
    state: state.applicantClientIdsToRenew ?? [],
    applicants: getEligibleApplicantsForRenewalSelection(state),
  };
}

/**
 * Generates a list of eligible applicants for the renewal selection step based on the client application data in the
 * protected application state. This function checks the primary applicant and any children applicants against the list
 * of eligible client numbers for the application. Only those applicants whose client numbers are included in the
 * eligible client numbers will be returned as options for selection in the renewal process.
 */
function getEligibleApplicantsForRenewalSelection({ clientApplication }: Pick<ProtectedApplicationState, 'clientApplication'>): ReadonlyArray<{ id: string; name: string }> {
  invariant(clientApplication, 'Expected clientApplication to be defined');
  const eligibleApplicants: Array<{ id: string; name: string }> = [];
  const { applicantInformation, children, eligibleClientNumbers } = clientApplication;

  // The primary applicant is only eligible for selection if their client number is included in the list of eligible
  // client numbers for the application. This ensures that only applicants who are eligible for renewal are presented in
  // the renewal selection step.
  if (eligibleClientNumbers.includes(applicantInformation.clientNumber)) {
    eligibleApplicants.push({ id: applicantInformation.clientId, name: `${applicantInformation.firstName} ${applicantInformation.lastName}` });
  }

  // Children applicants are eligible for selection if their client number is included in the list of eligible client
  // numbers for the application. This ensures that only children who are eligible for renewal are presented in the
  // renewal selection step.
  eligibleApplicants.push(
    ...children //
      .filter(({ information }) => eligibleClientNumbers.includes(information.clientNumber))
      .map(({ information }) => ({ id: information.clientId, name: `${information.firstName} ${information.lastName}` })),
  );

  return eligibleApplicants;
}

export async function action({ context, params, request }: Route.ActionArgs) {
  const { appContainer, session } = context.get(appContext);
  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  await securityHandler.validateAuthSession({ request, session });

  const state = getProtectedApplicationState({ params, session });
  validateProtectedApplicationContext(state, params, 'renewal');
  invariant(state.clientApplication, 'Expected clientApplication to be defined');

  const formData = await request.formData();
  securityHandler.validateCsrfToken({ formData, session });

  const t = await getFixedT(request, 'protectedApplicationSpokes');

  const applicantsSchema = z.object({
    applicants: z.array(z.string().trim()).nonempty(t(($) => $.renewalSelection.errorMessage.renewalSelectionRequired)),
  });

  const parsedDataResult = applicantsSchema.safeParse({ applicants: formData.getAll('applicants') });

  if (!parsedDataResult.success) {
    return data({ errors: transformFlattenedError(z.flattenError(parsedDataResult.error)) }, { status: 400 });
  }

  const applicantClientIdsToRenew = parsedDataResult.data.applicants;
  const typeOfApplication = getTypeOfApplicationFromRenewalSelectionClientIds(state, applicantClientIdsToRenew);
  const children = getChildren(state, applicantClientIdsToRenew);

  saveProtectedApplicationState({
    params,
    session,
    state: {
      typeOfApplication,
      applicantClientIdsToRenew,
      applicantInformation: {
        memberId: state.clientApplication.applicantInformation.clientNumber,
        firstName: state.clientApplication.applicantInformation.firstName,
        lastName: state.clientApplication.applicantInformation.lastName,
        dateOfBirth: state.clientApplication.dateOfBirth,
        socialInsuranceNumber: state.clientApplication.applicantInformation.socialInsuranceNumber,
      },
      children,
    },
  });

  const ageCategory = getContextualAgeCategoryFromDate(state.clientApplication.dateOfBirth, state.applicationYear);

  if (ageCategory === 'youth') {
    return redirect(getPathById('protected/application/$id/living-independently', params));
  }

  if (ageCategory === 'children') {
    return redirect(getPathById('protected/application/$id/parent-or-guardian', params));
  }

  return redirect(getPathById('protected/application/$id/renew', params));
}

/**
 * Generates a list of children for the protected application state based on the selected client IDs in the renewal selection.
 * This function checks the existing children in the state and updates them if they are included in the selected client IDs.
 * If a child is not included in the existing state but is part of the selected client IDs, it creates a new child entry with default values.
 *
 * @param state The current protected application state.
 * @param selectedClientIds The list of selected client IDs from the renewal selection.
 * @returns A list of children for the protected application state.
 */
function getChildren(state: ProtectedApplicationState, selectedClientIds: string[]): ProtectedApplicationState['children'] {
  invariant(state.clientApplication, 'Expected clientApplication to be defined');
  const clientApplicationChildren = state.clientApplication.children.filter((child) => selectedClientIds.includes(child.information.clientId));
  return clientApplicationChildren.map((child) => {
    const existingChild = state.children.find((c) => c.id === child.information.clientId);

    // If the child is already in the existing state, return it as is
    if (existingChild) {
      return existingChild;
    }

    // If the child is not in the existing state but is selected, create a new entry with default values
    return {
      id: child.information.clientId,
      information: {
        memberId: child.information.clientNumber,
        firstName: child.information.firstName,
        lastName: child.information.lastName,
        dateOfBirth: child.information.dateOfBirth,
      } as ProtectedApplicationChildInformationState,
    };
  });
}

export default function ProtectedSpokesRenewalSelection({ loaderData, params }: Route.ComponentProps) {
  const { t } = useTranslation(['protectedApplicationSpokes', 'protectedApplication']);
  const { state, applicants } = loaderData;

  const fetcher = useFetcher<typeof action>();
  const { isSubmitting } = useFetcherSubmissionState(fetcher);
  const errors = fetcher.data?.errors;
  return (
    <>
      <AppPageTitle>{t(($) => $.renewalSelection.pageTitle)}</AppPageTitle>
      <div className="max-w-prose">
        <p className="mb-4 italic">{t(($) => $.requiredLabel, { ns: 'protectedApplication' })}</p>
        <ErrorSummaryProvider actionData={fetcher.data}>
          <ErrorSummary />
          <fetcher.Form method="post" noValidate>
            <CsrfTokenInput />
            <InputCheckboxes
              id="applicants"
              name="applicants"
              legend={t(($) => $.renewalSelection.select)}
              options={applicants.map((applicant) => ({
                value: applicant.id,
                children: applicant.name,
                defaultChecked: state.includes(applicant.id),
              }))}
              errorMessage={errors?.applicants}
              required
            />
            <div className="mt-8 flex flex-row-reverse flex-wrap items-center justify-end gap-3">
              <LoadingButton variant="primary" id="save-button" loading={isSubmitting} data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Spoke:Save - Renewal selection click">
                {t(($) => $.renewalSelection.saveBtn)}
              </LoadingButton>
              <ButtonLink
                id="back-button"
                variant="secondary"
                routeId="protected/application/$id/renew"
                params={params}
                disabled={isSubmitting}
                data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Spoke:Back - Renewal selection click"
              >
                {t(($) => $.renewalSelection.backBtn)}
              </ButtonLink>
            </div>
          </fetcher.Form>
        </ErrorSummaryProvider>
      </div>
    </>
  );
}
