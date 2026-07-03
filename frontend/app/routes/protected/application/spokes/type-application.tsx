import { data, redirect, useFetcher } from 'react-router';

import { Trans, useTranslation } from 'react-i18next';
import * as z from 'zod';

import type { Route } from './+types/type-application';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import { getProtectedApplicationState, saveProtectedApplicationState, validateProtectedApplicationContext } from '~/.server/routes/helpers/protected-application-route-helpers';
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

const APPLICANT_TYPE = { adult: 'adult', family: 'family', children: 'children', delegate: 'delegate' } as const;

export const handle = {
  pageIdentifier: pageIds.protected.application.spokes.typeOfApplication,
} as const satisfies RouteHandleData;

export const meta: Route.MetaFunction = mergeMeta(({ loaderData }) => getTitleMetaTags(loaderData.meta.title));

export async function loader({ context, params, request }: Route.LoaderArgs) {
  const { appContainer, session } = context.get(appContext);
  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  await securityHandler.validateAuthSession({ request, session });

  const state = getProtectedApplicationState({ params, session });
  validateProtectedApplicationContext(state, params, 'intake');

  const t = await getFixedT(request, ['protectedApplicationSpokes', 'gcweb']);

  const meta = {
    title: t(($) => $.meta.title.template, { ns: 'gcweb', title: t(($) => $.typeOfApplication.pageTitle) }),
  };

  return { meta, defaultState: state.typeOfApplication };
}

export async function action({ context, params, request }: Route.ActionArgs) {
  const { appContainer, session } = context.get(appContext);
  const formData = await request.formData();

  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  await securityHandler.validateAuthSession({ request, session });
  securityHandler.validateCsrfToken({ formData, session });

  const state = getProtectedApplicationState({ params, session });
  validateProtectedApplicationContext(state, params, 'intake');

  const t = await getFixedT(request, 'protectedApplicationSpokes');

  /**
   * Schema for application delegate.
   */
  const typeOfApplicationSchema = z.object({
    typeOfApplication: z.enum(APPLICANT_TYPE, {
      error: t(($) => $.typeOfApplication.errorMessage.typeOfApplicationRequired),
    }),
  });

  const parsedDataResult = typeOfApplicationSchema.safeParse({ typeOfApplication: String(formData.get('typeOfApplication') ?? '') });

  if (!parsedDataResult.success) {
    return data({ errors: transformFlattenedError(z.flattenError(parsedDataResult.error)) }, { status: 400 });
  }

  saveProtectedApplicationState({ params, session, state: { typeOfApplication: parsedDataResult.data.typeOfApplication } });

  if (parsedDataResult.data.typeOfApplication === APPLICANT_TYPE.delegate) {
    return redirect(getPathById('protected/application/$id/application-delegate', params));
  }

  return redirect(getPathById('protected/application/$id/your-application', params));
}

export default function ApplicationTypeOfApplication({ loaderData, params }: Route.ComponentProps) {
  const { t } = useTranslation(['protectedApplicationSpokes', 'protectedApplication']);
  const { defaultState } = loaderData;

  const fetcher = useFetcher<typeof action>();
  const { isSubmitting } = useFetcherSubmissionState(fetcher);

  const errors = fetcher.data?.errors;

  return (
    <>
      <AppPageTitle>{t(($) => $.typeOfApplication.pageTitle)}</AppPageTitle>
      <div className="max-w-prose">
        <p className="mt-8 mb-4 italic">{t(($) => $.requiredLabel, { ns: 'protectedApplication' })}</p>
        <ErrorSummaryProvider actionData={fetcher.data}>
          <ErrorSummary />
          <fetcher.Form method="post" noValidate>
            <CsrfTokenInput />
            <InputRadios
              id="type-of-application"
              name="typeOfApplication"
              legend={t(($) => $.typeOfApplication.formInstructions)}
              options={[
                { value: APPLICANT_TYPE.adult, children: <Trans ns="protectedApplicationSpokes" i18nKey={($) => $.typeOfApplication.radioOptions.personal} />, defaultChecked: defaultState === APPLICANT_TYPE.adult },
                { value: APPLICANT_TYPE.children, children: <Trans ns="protectedApplicationSpokes" i18nKey={($) => $.typeOfApplication.radioOptions.child} />, defaultChecked: defaultState === APPLICANT_TYPE.children },
                { value: APPLICANT_TYPE.family, children: <Trans ns="protectedApplicationSpokes" i18nKey={($) => $.typeOfApplication.radioOptions.personalAndChild} />, defaultChecked: defaultState === APPLICANT_TYPE.family },
                { value: APPLICANT_TYPE.delegate, children: <Trans ns="protectedApplicationSpokes" i18nKey={($) => $.typeOfApplication.radioOptions.delegate} />, defaultChecked: defaultState === APPLICANT_TYPE.delegate },
              ]}
              required
              errorMessage={errors?.typeOfApplication}
            />
            <div className="mt-8 flex flex-row-reverse flex-wrap items-center justify-end gap-3">
              <LoadingButton variant="primary" id="save-button" loading={isSubmitting} data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Spoke:Save - Type of application click">
                {t(($) => $.typeOfApplication.saveBtn)}
              </LoadingButton>
              <ButtonLink
                id="back-button"
                variant="secondary"
                routeId="protected/application/$id/your-application"
                params={params}
                disabled={isSubmitting}
                data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Spoke:Back - Type of application click"
              >
                {t(($) => $.typeOfApplication.backBtn)}
              </ButtonLink>
            </div>
          </fetcher.Form>
        </ErrorSummaryProvider>
      </div>
    </>
  );
}
