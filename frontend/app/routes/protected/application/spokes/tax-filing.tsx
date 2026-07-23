import { data, redirect, useFetcher } from 'react-router';

import { useTranslation } from 'react-i18next';
import * as z from 'zod';

import type { Route } from './+types/tax-filing';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import { getProtectedApplicationState, saveProtectedApplicationState } from '~/.server/routes/helpers/protected-application-route-helpers';
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

const TAX_FILING_OPTION = { no: 'no', yes: 'yes' } as const;

export const handle = {
  pageIdentifier: pageIds.protected.application.spokes.taxFiling,
} as const satisfies RouteHandleData;

export const meta: Route.MetaFunction = mergeMeta(({ loaderData }) => getTitleMetaTags(loaderData.meta.title));

export async function loader({ context, params, url }: Route.LoaderArgs) {
  const { appContainer, session } = context.get(appContext);
  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  await securityHandler.validateAuthSession({ requestUrl: url, session });

  const state = getProtectedApplicationState({ params, session });
  const t = await getFixedT(url, ['protectedApplication', 'gcweb']);

  const meta = {
    title: t(($) => $.meta.title.template, { ns: 'gcweb', title: t(($) => $.taxFiling.pageTitle) }),
  };

  return { meta, defaultState: state.hasFiledTaxes, taxYear: state.applicationYear.taxYear };
}

export async function action({ context, params, request, url }: Route.ActionArgs) {
  const { appContainer, session } = context.get(appContext);
  const formData = await request.formData();

  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  await securityHandler.validateAuthSession({ requestUrl: url, session });
  securityHandler.validateCsrfToken({ formData, session });

  const t = await getFixedT(url, 'protectedApplication');

  const taxFilingSchema = z.object({
    hasFiledTaxes: z.enum(TAX_FILING_OPTION, {
      error: t(($) => $.taxFiling.errorMessage.taxFilingRequired),
    }),
  });

  const parsedDataResult = taxFilingSchema.safeParse({ hasFiledTaxes: formData.get('hasFiledTaxes') });

  if (!parsedDataResult.success) {
    return data({ errors: transformFlattenedError(z.flattenError(parsedDataResult.error)) }, { status: 400 });
  }

  saveProtectedApplicationState({ params, session, state: { hasFiledTaxes: parsedDataResult.data.hasFiledTaxes === TAX_FILING_OPTION.yes } });

  if (parsedDataResult.data.hasFiledTaxes === TAX_FILING_OPTION.no) {
    return redirect(getPathById('protected/application/$id/file-taxes', params));
  }

  return redirect(getPathById('protected/application/$id/eligibility-requirements', params));
}

export default function ApplicationTaxFiling({ loaderData, params }: Route.ComponentProps) {
  const { t } = useTranslation('protectedApplication');
  const { defaultState, taxYear } = loaderData;

  const fetcher = useFetcher<typeof action>();
  const { isSubmitting } = useFetcherSubmissionState(fetcher);
  const errors = fetcher.data?.errors;
  return (
    <>
      <AppPageTitle>{t(($) => $.taxFiling.pageTitle)}</AppPageTitle>
      <div className="max-w-prose">
        <p className="mb-4 italic">{t(($) => $.requiredLabel)}</p>
        <ErrorSummaryProvider actionData={fetcher.data}>
          <ErrorSummary />
          <fetcher.Form method="post" noValidate>
            <CsrfTokenInput />
            <InputRadios
              id="tax-filing"
              name="hasFiledTaxes"
              legend={t(($) => $.taxFiling.formInstructions, { taxYear: taxYear })}
              options={[
                {
                  value: TAX_FILING_OPTION.yes,
                  children: t(($) => $.taxFiling.radioOptions.yes),
                  defaultChecked: defaultState === true,
                },
                {
                  value: TAX_FILING_OPTION.no,
                  children: t(($) => $.taxFiling.radioOptions.no),
                  defaultChecked: defaultState === false,
                },
              ]}
              errorMessage={errors?.hasFiledTaxes}
              required
            />
            <div className="mt-8 flex flex-row-reverse flex-wrap items-center justify-end gap-3">
              <LoadingButton variant="primary" id="save-button" loading={isSubmitting} data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Spoke:Save - Tax filing click">
                {t(($) => $.taxFiling.saveBtn)}
              </LoadingButton>
              <ButtonLink
                id="back-button"
                variant="secondary"
                routeId="protected/application/$id/eligibility-requirements"
                params={params}
                disabled={isSubmitting}
                data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Spoke:Back - Tax filing click"
              >
                {t(($) => $.taxFiling.backBtn)}
              </ButtonLink>
            </div>
          </fetcher.Form>
        </ErrorSummaryProvider>
      </div>
    </>
  );
}
