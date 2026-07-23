import { data, redirect, useFetcher } from 'react-router';

import { useTranslation } from 'react-i18next';
import * as z from 'zod';

import type { Route } from './+types/parent-guardian';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import { getProtectedApplicationState, getSingleChildState, saveProtectedApplicationState, validateApplicationFlow } from '~/.server/routes/helpers/protected-application-route-helpers';
import type { ProtectedApplicationChildInformationState } from '~/.server/routes/helpers/protected-application-route-helpers';
import { getFixedT } from '~/.server/utils/locale-utils';
import { transformFlattenedError } from '~/.server/utils/zod-utils';
import { AppPageTitle } from '~/components/app-page-title';
import { ButtonLink } from '~/components/buttons';
import { CsrfTokenInput } from '~/components/csrf-token-input';
import { InputRadios } from '~/components/input-radios';
import { LoadingButton } from '~/components/loading-button';
import { useFetcherSubmissionState } from '~/hooks';
import { pageIds } from '~/page-ids';
import { mergeMeta } from '~/utils/meta-utils';
import { getPathById } from '~/utils/route-utils';
import type { RouteHandleData } from '~/utils/route-utils';
import { getTitleMetaTags } from '~/utils/seo-utils';

const YES_NO_OPTION = {
  yes: 'yes',
  no: 'no',
} as const;

export const handle = {
  pageIdentifier: pageIds.protected.application.spokes.parentGuardian,
} as const satisfies RouteHandleData;

export const meta: Route.MetaFunction = mergeMeta(({ loaderData }) => getTitleMetaTags(loaderData.meta.title));

export async function loader({ context, params, url }: Route.LoaderArgs) {
  const { appContainer, session } = context.get(appContext);
  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  await securityHandler.validateAuthSession({ requestUrl: url, session });

  const state = getProtectedApplicationState({ params, session });
  validateApplicationFlow(state, params, ['intake-children', 'intake-family', 'renewal-children', 'renewal-family']);
  const childState = getSingleChildState({ params, session });

  const t = await getFixedT(url, ['protectedApplicationSpokes', 'gcweb']);

  const childNumber = t(($) => $.children.childNumber, {
    childNumber: childState.childNumber,
  });
  const childName = childState.information?.firstName ?? childNumber;

  const meta = {
    title: t(($) => $.meta.title.template, { ns: 'gcweb', title: t(($) => $.children.parentGuardian.pageTitle) }),
  };

  return { meta, defaultState: childState.information, childName, applicationFlow: `${state.context}-${state.typeOfApplication}` as const };
}

export async function action({ context, params, request, url }: Route.ActionArgs) {
  const { appContainer, session } = context.get(appContext);
  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  await securityHandler.validateAuthSession({ requestUrl: url, session });

  const state = getProtectedApplicationState({ params, session });
  validateApplicationFlow(state, params, ['intake-children', 'intake-family', 'renewal-children', 'renewal-family']);
  const childState = getSingleChildState({ params, session });

  const formData = await request.formData();
  securityHandler.validateCsrfToken({ formData, session });

  const t = await getFixedT(url, 'protectedApplicationSpokes');

  const parentGuardianSchema = z.object({
    isParent: z.boolean({
      error: t(($) => $.children.parentGuardian.isParent),
    }),
  });

  const parsedDataResult = parentGuardianSchema.safeParse({
    isParent: formData.get('isParent') ? formData.get('isParent') === YES_NO_OPTION.yes : undefined,
  });

  if (!parsedDataResult.success) {
    return data({ errors: transformFlattenedError(z.flattenError(parsedDataResult.error)) }, { status: 400 });
  }

  if (!parsedDataResult.data.isParent) {
    return redirect(getPathById('protected/application/$id/children/$childId/parent-or-guardian', params));
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
            isParent: parsedDataResult.data.isParent,
          } as ProtectedApplicationChildInformationState,
        };
      }),
    },
  });

  return redirect(getPathById(`protected/application/$id/${state.context}-${state.typeOfApplication}/childrens-application`, params));
}

export default function ParentGuardian({ loaderData, params }: Route.ComponentProps) {
  const { t } = useTranslation(['protectedApplicationSpokes', 'protectedApplication']);
  const { defaultState, childName, applicationFlow } = loaderData;

  const fetcher = useFetcher<typeof action>();
  const { isSubmitting } = useFetcherSubmissionState(fetcher);

  const errors = typeof fetcher.data === 'object' && 'errors' in fetcher.data ? fetcher.data.errors : undefined;

  return (
    <>
      <AppPageTitle>{t(($) => $.children.parentGuardian.pageTitle)}</AppPageTitle>
      <div className="max-w-prose">
        <fetcher.Form method="post" noValidate>
          <p className="mb-4 italic">{t(($) => $.requiredLabel, { ns: 'protectedApplication' })}</p>
          <div className="mb-8 space-y-4">
            <InputRadios
              id="is-parent-radios"
              name="isParent"
              legend={t(($) => $.children.parentGuardian.parentLegend, {
                childName: childName,
              })}
              options={[
                {
                  value: YES_NO_OPTION.yes,
                  children: t(($) => $.children.parentGuardian.radioOptions.yes),
                  defaultChecked: defaultState?.isParent === true,
                },
                {
                  value: YES_NO_OPTION.no,
                  children: t(($) => $.children.parentGuardian.radioOptions.no),
                  defaultChecked: defaultState?.isParent === false,
                },
              ]}
              errorMessage={errors?.isParent}
              required
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <CsrfTokenInput />
            <ButtonLink
              id="back-button"
              variant="secondary"
              routeId={`protected/application/$id/${applicationFlow}/childrens-application`}
              params={params}
              disabled={isSubmitting}
              data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Spoke:Back - Child parent or guardian needs to apply click"
            >
              {t(($) => $.children.parentGuardian.backBtn)}
            </ButtonLink>
            <LoadingButton id="save-button" variant="primary" loading={isSubmitting} data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Spoke:Save - Child Information click">
              {t(($) => $.children.parentGuardian.saveBtn)}
            </LoadingButton>
          </div>
        </fetcher.Form>
      </div>
    </>
  );
}
