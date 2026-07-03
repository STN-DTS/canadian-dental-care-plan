import { data, redirect, useFetcher } from 'react-router';

import { useTranslation } from 'react-i18next';
import * as z from 'zod';

import type { Route } from './+types/child-social-insurance-number';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import { isSinReserved } from '~/.server/routes/helpers/base-application-route-helpers';
import type { ProtectedApplicationChildInformationState } from '~/.server/routes/helpers/protected-application-route-helpers';
import {
  getProtectedApplicantSin,
  getProtectedApplicationState,
  getProtectedChildrenSins,
  getProtectedPartnerSin,
  getSingleChildState,
  saveProtectedApplicationState,
  validateApplicationFlow,
} from '~/.server/routes/helpers/protected-application-route-helpers';
import { getFixedT } from '~/.server/utils/locale.utils';
import { transformFlattenedError } from '~/.server/utils/zod.utils';
import { AppPageTitle } from '~/components/app-page-title';
import { ButtonLink } from '~/components/buttons';
import { CsrfTokenInput } from '~/components/csrf-token-input';
import { ErrorSummary } from '~/components/error-summary';
import { ErrorSummaryProvider } from '~/components/error-summary-context';
import { InputPatternField } from '~/components/input-pattern-field';
import { LoadingButton } from '~/components/loading-button';
import { useFetcherSubmissionState } from '~/hooks';
import { pageIds } from '~/page-ids';
import { mergeMeta } from '~/utils/meta-utils';
import { getPathById } from '~/utils/route-utils';
import type { RouteHandleData } from '~/utils/route-utils';
import { getTitleMetaTags } from '~/utils/seo-utils';
import { isValidSin, sinInputPatternFormat } from '~/utils/sin-utils';

export const handle = {
  pageIdentifier: pageIds.protected.application.spokes.childSocialInsuranceNumber,
} as const satisfies RouteHandleData;

export const meta: Route.MetaFunction = mergeMeta(({ loaderData }) => getTitleMetaTags(loaderData.meta.title));

export async function loader({ context, params, request }: Route.LoaderArgs) {
  const { appContainer, session } = context.get(appContext);
  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  await securityHandler.validateAuthSession({ request, session });

  const state = getProtectedApplicationState({ params, session });
  validateApplicationFlow(state, params, ['intake-children', 'intake-family', 'renewal-children', 'renewal-family']);
  const childState = getSingleChildState({ params, session });

  const t = await getFixedT(request, ['protectedApplicationSpokes', 'gcweb']);

  const childNumber = t(($) => $.children.childNumber, {
    childNumber: childState.childNumber,
  });
  const childName = childState.information?.firstName ?? childNumber;

  const meta = {
    title: t(($) => $.meta.title.template, {
      title: t(($) => $.children.socialInsuranceNumber.pageTitle, {
        childName: childName,
      }),

      ns: 'gcweb',
    }),
    dcTermsTitle: t(($) => $.meta.title.template, {
      title: t(($) => $.children.socialInsuranceNumber.pageTitle, {
        childName: childNumber,
      }),

      ns: 'gcweb',
    }),
  };

  return {
    meta,
    childSin: childState.information?.socialInsuranceNumber,
    childName,
    applicationFlow: `${state.context}-${state.typeOfApplication}`,
  };
}

export async function action({ context, params, request }: Route.ActionArgs) {
  const { appContainer, session } = context.get(appContext);
  const state = getProtectedApplicationState({ params, session });
  validateApplicationFlow(state, params, ['intake-children', 'intake-family', 'renewal-children', 'renewal-family']);

  const formData = await request.formData();

  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  await securityHandler.validateAuthSession({ request, session });
  securityHandler.validateCsrfToken({ formData, session });

  const childState = getSingleChildState({ params, session });

  const t = await getFixedT(request, 'protectedApplicationSpokes');

  const sinSchema = z.object({
    socialInsuranceNumber: z
      .string()
      .trim()
      .optional()
      .superRefine((sin, ctx) => {
        if (sin && !isValidSin(sin)) {
          ctx.addIssue({ code: 'custom', path: ['socialInsuranceNumber'], message: t(($) => $.children.socialInsuranceNumber.sinValid) });
          return;
        }

        if (sin && isSinReserved(sin, [getProtectedApplicantSin(state), getProtectedPartnerSin(state), ...getProtectedChildrenSins(state, childState.id)])) {
          ctx.addIssue({ code: 'custom', path: ['socialInsuranceNumber'], message: t(($) => $.children.socialInsuranceNumber.sinUnique) });
        }
      }),
  });

  const sin = formData.get('socialInsuranceNumber');
  const parsedDataResult = sinSchema.safeParse({
    socialInsuranceNumber: sin ? sin.toString() : undefined,
  });

  if (!parsedDataResult.success) {
    return data({ errors: transformFlattenedError(z.flattenError(parsedDataResult.error)) }, { status: 400 });
  }

  saveProtectedApplicationState({
    params,
    session,
    state: {
      children: state.children.map((child) => {
        if (child.id !== childState.id) return child;
        return {
          ...child,
          information: {
            ...child.information,
            socialInsuranceNumber: parsedDataResult.data.socialInsuranceNumber,
          } as ProtectedApplicationChildInformationState,
        };
      }),
    },
  });

  return redirect(getPathById(`protected/application/$id/${state.context}-${state.typeOfApplication}/childrens-application`, params));
}

export default function ChildSocialInsuranceNumber({ loaderData, params }: Route.ComponentProps) {
  const { t } = useTranslation(['protectedApplicationSpokes', 'protectedApplication']);
  const { childSin, applicationFlow, childName } = loaderData;

  const fetcher = useFetcher<typeof action>();
  const { isSubmitting } = useFetcherSubmissionState(fetcher);

  const errors = typeof fetcher.data === 'object' && 'errors' in fetcher.data ? fetcher.data.errors : undefined;

  return (
    <>
      <AppPageTitle>{t(($) => $.children.socialInsuranceNumber.pageTitle)}</AppPageTitle>
      <div className="max-w-prose">
        <ErrorSummaryProvider actionData={fetcher.data}>
          <ErrorSummary />
          <fetcher.Form method="post" noValidate>
            <CsrfTokenInput />
            <p className="mb-4 italic">{t(($) => $.allOptional, { ns: 'protectedApplication' })}</p>
            <div className="mb-6">
              <InputPatternField
                id="social-insurance-number"
                name="socialInsuranceNumber"
                format={sinInputPatternFormat}
                label={t(($) => $.children.socialInsuranceNumber.legend, {
                  childName: childName,
                })}
                inputMode="numeric"
                helpMessagePrimary={t(($) => $.children.socialInsuranceNumber.helpMessage)}
                helpMessagePrimaryClassName="text-black"
                defaultValue={childSin ?? ''}
                errorMessage={errors?.socialInsuranceNumber}
              />
            </div>
            <div className="flex flex-row-reverse flex-wrap items-center justify-end gap-3">
              <LoadingButton variant="primary" id="save-button" loading={isSubmitting} data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Spoke:Continue - Child social insurance number click">
                {t(($) => $.children.socialInsuranceNumber.saveBtn)}
              </LoadingButton>
              <ButtonLink
                id="back-button"
                variant="secondary"
                routeId={`protected/application/$id/${applicationFlow}/childrens-application`}
                params={params}
                disabled={isSubmitting}
                data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Spoke:Back - Child social insurance number click"
              >
                {t(($) => $.children.socialInsuranceNumber.backBtn)}
              </ButtonLink>
            </div>
          </fetcher.Form>
        </ErrorSummaryProvider>
      </div>
    </>
  );
}
