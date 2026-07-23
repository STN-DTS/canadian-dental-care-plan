import { data, redirect, useFetcher } from 'react-router';

import { useTranslation } from 'react-i18next';
import * as z from 'zod';

import type { Route } from './+types/living-independently';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import { getPublicApplicationState, savePublicApplicationState } from '~/.server/routes/helpers/public-application-route-helpers';
import { getFixedT } from '~/.server/utils/locale-utils';
import { transformFlattenedError } from '~/.server/utils/zod-utils';
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
  pageIdentifier: pageIds.public.application.spokes.livingIndependently,
} as const satisfies RouteHandleData;

export const meta: Route.MetaFunction = mergeMeta(({ loaderData }) => getTitleMetaTags(loaderData.meta.title));

export async function loader({ context, params, url }: Route.LoaderArgs) {
  const { session } = context.get(appContext);
  const state = getPublicApplicationState({ params, session });
  const t = await getFixedT(url, ['applicationSpokes', 'gcweb']);

  const meta = {
    title: t(($) => $.meta.title.template, { ns: 'gcweb', title: t(($) => $.livingIndependently.pageTitle) }),
  };
  return { meta, defaultState: state.livingIndependently };
}

export async function action({ context, params, request, url }: Route.ActionArgs) {
  const { appContainer, session } = context.get(appContext);
  const formData = await request.formData();
  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  securityHandler.validateCsrfToken({ formData, session });
  const t = await getFixedT(url, 'applicationSpokes');

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

  savePublicApplicationState({ params, session, state: { livingIndependently: isLivingindependently } });

  if (isLivingindependently) {
    return redirect(getPathById('public/application/$id/your-application', params));
  }

  return redirect(getPathById('public/application/$id/parent-or-guardian', params));
}

export default function ApplyFlowLivingIndependently({ loaderData, params }: Route.ComponentProps) {
  const { t } = useTranslation(['applicationSpokes', 'application']);
  const { defaultState } = loaderData;

  const fetcher = useFetcher<typeof action>();
  const { isSubmitting } = useFetcherSubmissionState(fetcher);

  const errors = fetcher.data?.errors;

  return (
    <>
      <AppPageTitle>{t(($) => $.livingIndependently.pageTitle)}</AppPageTitle>
      <div className="max-w-prose">
        <p className="mb-6">{t(($) => $.livingIndependently.description)}</p>
        <p className="mb-4 italic">{t(($) => $.requiredLabel, { ns: 'application' })}</p>
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
              <LoadingButton variant="primary" id="continue-button" loading={isSubmitting} data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Spoke:Continue - Living independently click">
                {t(($) => $.livingIndependently.saveBtn)}
              </LoadingButton>
              <ButtonLink
                id="back-button"
                variant="secondary"
                routeId="public/application/$id/personal-information"
                params={params}
                disabled={isSubmitting}
                data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Spoke:Back - Living independently click"
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
