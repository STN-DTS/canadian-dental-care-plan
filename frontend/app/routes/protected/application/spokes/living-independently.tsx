import { data, redirect, useFetcher } from 'react-router';

import { useTranslation } from 'react-i18next';
import * as z from 'zod';

import type { Route } from './+types/living-independently';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import { getProtectedApplicationState, saveProtectedApplicationState } from '~/.server/routes/helpers/protected-application-route-helpers';
import { getFixedT } from '~/.server/utils/locale.utils';
import { transformFlattenedError } from '~/.server/utils/zod.utils';
import { AppPageTitle } from '~/components/app-page-title';
import { ButtonLink } from '~/components/buttons';
import { CsrfTokenInput } from '~/components/csrf-token-input';
import { ErrorSummary } from '~/components/error-summary';
import { ErrorSummaryProvider } from '~/components/error-summary-context';
import { InputRadios } from '~/components/input-radios';
import { LoadingButton } from '~/components/loading-button';
import { useFetcherSubmissionState } from '~/hooks';
import { pageIds } from '~/page-ids';
import { mergeMeta } from '~/utils/meta-utils';
import type { RouteHandleData } from '~/utils/route-utils';
import { getPathById } from '~/utils/route-utils';
import { getTitleMetaTags } from '~/utils/seo-utils';

const LIVING_INDEPENDENTLY_OPTION = {
  no: 'no',
  yes: 'yes',
} as const;

export const handle = {
  pageIdentifier: pageIds.protected.application.spokes.livingIndependently,
} as const satisfies RouteHandleData;

export const meta: Route.MetaFunction = mergeMeta(({ loaderData }) => getTitleMetaTags(loaderData.meta.title));

export async function loader({ context, params, request }: Route.LoaderArgs) {
  const { appContainer, session } = context.get(appContext);
  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  await securityHandler.validateAuthSession({ request, session });

  const state = getProtectedApplicationState({ params, session });
  const t = await getFixedT(request, ['protectedApplicationSpokes', 'gcweb']);

  const meta = {
    title: t(($) => $.meta.title.template, { ns: 'gcweb', title: t(($) => $.livingIndependently.pageTitle) }),
  };
  return { meta, defaultState: state.livingIndependently, context: state.context };
}

export async function action({ context, params, request }: Route.ActionArgs) {
  const { appContainer, session } = context.get(appContext);
  const formData = await request.formData();
  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  await securityHandler.validateAuthSession({ request, session });
  securityHandler.validateCsrfToken({ formData, session });

  const state = getProtectedApplicationState({ params, session });

  const t = await getFixedT(request, 'protectedApplicationSpokes');

  /**
   * Schema for living independently.
   */
  const livingIndependentlySchema = z.object({
    livingIndependently: z.enum(LIVING_INDEPENDENTLY_OPTION, {
      error: t(($) => $.livingIndependently.errorMessage.livingIndependentlyRequired),
    }),
  });

  const parsedDataResult = livingIndependentlySchema.safeParse({
    livingIndependently: String(formData.get('livingIndependently') ?? ''),
  });

  if (!parsedDataResult.success) {
    return data({ errors: transformFlattenedError(z.flattenError(parsedDataResult.error)) }, { status: 400 });
  }

  const isLivingindependently = parsedDataResult.data.livingIndependently === LIVING_INDEPENDENTLY_OPTION.yes;

  saveProtectedApplicationState({ params, session, state: { livingIndependently: isLivingindependently } });

  if (isLivingindependently) {
    const redirectUrl =
      state.context === 'intake' //
        ? getPathById('protected/application/$id/your-application', params)
        : getPathById('protected/application/$id/renew', params);
    return redirect(redirectUrl);
  }

  return redirect(getPathById('protected/application/$id/parent-or-guardian', params));
}

export default function ApplyFlowLivingIndependently({ loaderData, params }: Route.ComponentProps) {
  const { t } = useTranslation(['protectedApplicationSpokes', 'protectedApplication']);
  const { defaultState, context } = loaderData;

  const fetcher = useFetcher<typeof action>();
  const { isSubmitting } = useFetcherSubmissionState(fetcher);

  const errors = fetcher.data?.errors;

  return (
    <>
      <AppPageTitle>{t(($) => $.livingIndependently.pageTitle)}</AppPageTitle>
      <div className="max-w-prose">
        <p className="mb-6">{t(($) => $.livingIndependently.description)}</p>
        <p className="mb-4 italic">{t(($) => $.requiredLabel, { ns: 'protectedApplication' })}</p>
        <ErrorSummaryProvider actionData={fetcher.data}>
          <ErrorSummary />
          <fetcher.Form method="post" noValidate>
            <CsrfTokenInput />
            <InputRadios
              id="living-independently"
              name="livingIndependently"
              legend={t(($) => $.livingIndependently.formInstructions)}
              options={[
                {
                  value: LIVING_INDEPENDENTLY_OPTION.yes,
                  children: t(($) => $.livingIndependently.radioOptions.yes),
                  defaultChecked: defaultState === true,
                },
                {
                  value: LIVING_INDEPENDENTLY_OPTION.no,
                  children: t(($) => $.livingIndependently.radioOptions.no),
                  defaultChecked: defaultState === false,
                },
              ]}
              required
              errorMessage={errors?.livingIndependently}
            />
            <div className="mt-8 flex flex-row-reverse flex-wrap items-center justify-end gap-3">
              <LoadingButton variant="primary" id="continue-button" loading={isSubmitting} data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Spoke:Continue - Living independently click">
                {t(($) => $.livingIndependently.saveBtn)}
              </LoadingButton>
              <ButtonLink
                id="back-button"
                variant="secondary"
                routeId={context === 'intake' ? 'protected/application/$id/personal-information' : 'protected/application/$id/renewal-selection'}
                params={params}
                disabled={isSubmitting}
                data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Spoke:Back - Living independently click"
              >
                {t(($) => $.livingIndependently.backBtn)}
              </ButtonLink>
            </div>
          </fetcher.Form>
        </ErrorSummaryProvider>
      </div>
    </>
  );
}
