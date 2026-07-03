import { useState } from 'react';

import { data, redirect, useFetcher } from 'react-router';

import { Trans, useTranslation } from 'react-i18next';
import * as z from 'zod';

import type { Route } from './+types/dental-insurance';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import { getPublicApplicationState, savePublicApplicationState, validateApplicationFlow } from '~/.server/routes/helpers/public-application-route-helpers';
import { getFixedT } from '~/.server/utils/locale.utils';
import { transformFlattenedError } from '~/.server/utils/zod.utils';
import { AppPageTitle } from '~/components/app-page-title';
import { ButtonLink } from '~/components/buttons';
import { ContextualAlert } from '~/components/contextual-alert';
import { CsrfTokenInput } from '~/components/csrf-token-input';
import { ErrorSummary } from '~/components/error-summary';
import { ErrorSummaryProvider } from '~/components/error-summary-context';
import { InlineLink } from '~/components/inline-link';
import { InputCheckbox } from '~/components/input-checkbox';
import { InputRadios } from '~/components/input-radios';
import { LoadingButton } from '~/components/loading-button';
import { useFetcherSubmissionState } from '~/hooks';
import { pageIds } from '~/page-ids';
import { mergeMeta } from '~/utils/meta-utils';
import { getPathById } from '~/utils/route-utils';
import type { RouteHandleData } from '~/utils/route-utils';
import { getTitleMetaTags } from '~/utils/seo-utils';

const CHECKBOX_VALUE = {
  yes: 'yes',
} as const;

const HAS_DENTAL_INSURANCE_OPTION = {
  no: 'no',
  yes: 'yes',
} as const;

export const handle = {
  pageIdentifier: pageIds.public.application.spokes.dentalInsurance,
} as const satisfies RouteHandleData;

export const meta: Route.MetaFunction = mergeMeta(({ loaderData }) => getTitleMetaTags(loaderData.meta.title));

export async function loader({ context, params, url }: Route.LoaderArgs) {
  const { session } = context.get(appContext);
  const state = getPublicApplicationState({ params, session });
  validateApplicationFlow(state, params, ['simplified-adult', 'full-adult', 'full-children', 'full-family', 'simplified-family']);

  const t = await getFixedT(url, ['applicationSpokes', 'gcweb']);

  const meta = {
    title: t(($) => $.meta.title.template, { ns: 'gcweb', title: t(($) => $.dentalInsurance.title) }),
  };

  return {
    defaultState: state.dentalInsurance
      ? {
          hasDentalInsurance: state.dentalInsurance.hasDentalInsurance,
          dentalInsuranceEligibilityConfirmationYes: state.dentalInsurance.hasDentalInsurance === true ? state.dentalInsurance.dentalInsuranceEligibilityConfirmation : undefined,
          dentalInsuranceEligibilityConfirmationNo: state.dentalInsurance.hasDentalInsurance === false ? state.dentalInsurance.dentalInsuranceEligibilityConfirmation : undefined,
        }
      : undefined,
    applicationFlow: `${state.inputModel}-${state.typeOfApplication}` as const,
    meta,
  };
}

export async function action({ context, params, request, url }: Route.ActionArgs) {
  const { appContainer, session } = context.get(appContext);
  const state = getPublicApplicationState({ params, session });
  validateApplicationFlow(state, params, ['full-adult', 'full-children', 'full-family', 'simplified-adult', 'simplified-family']);

  const formData = await request.formData();

  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  securityHandler.validateCsrfToken({ formData, session });

  const t = await getFixedT(url, 'applicationSpokes');

  const dentalInsuranceSchema = z
    .object({
      hasDentalInsurance: z.boolean({
        error: t(($) => $.dentalInsurance.errorMessage.dentalInsuranceRequired),
      }),
      dentalInsuranceEligibilityConfirmationYes: z.boolean({
        error: t(($) => $.dentalInsurance.errorMessage.dentalInsuranceEligibilityConfirmationRequired),
      }),
      dentalInsuranceEligibilityConfirmationNo: z.boolean({
        error: t(($) => $.dentalInsurance.errorMessage.dentalInsuranceEligibilityConfirmationRequired),
      }),
    })
    .superRefine(({ hasDentalInsurance, dentalInsuranceEligibilityConfirmationYes }, ctx) => {
      if (hasDentalInsurance && dentalInsuranceEligibilityConfirmationYes === false) {
        return ctx.addIssue({
          code: 'custom',
          message: t(($) => $.dentalInsurance.errorMessage.dentalInsuranceEligibilityConfirmationRequired),
          path: ['dentalInsuranceEligibilityConfirmationYes'],
        });
      }
    });

  const parsedDataResult = dentalInsuranceSchema.safeParse({
    hasDentalInsurance: formData.get('hasDentalInsurance') ? formData.get('hasDentalInsurance') === HAS_DENTAL_INSURANCE_OPTION.yes : undefined,
    dentalInsuranceEligibilityConfirmationYes: formData.get('dentalInsuranceEligibilityConfirmationYes') === CHECKBOX_VALUE.yes,
    dentalInsuranceEligibilityConfirmationNo: formData.get('dentalInsuranceEligibilityConfirmationNo') === CHECKBOX_VALUE.yes,
  });

  if (!parsedDataResult.success) {
    return data({ errors: transformFlattenedError(z.flattenError(parsedDataResult.error)) }, { status: 400 });
  }

  savePublicApplicationState({
    params,
    session,
    state: {
      dentalInsurance: {
        hasDentalInsurance: parsedDataResult.data.hasDentalInsurance,
        dentalInsuranceEligibilityConfirmation: parsedDataResult.data.hasDentalInsurance ? parsedDataResult.data.dentalInsuranceEligibilityConfirmationYes : parsedDataResult.data.dentalInsuranceEligibilityConfirmationNo,
      },
    },
  });

  if (!parsedDataResult.data.hasDentalInsurance && !parsedDataResult.data.dentalInsuranceEligibilityConfirmationNo) {
    return redirect(getPathById('public/application/$id/dental-insurance-exit-application', params));
  }

  return redirect(getPathById(`public/application/$id/${state.inputModel}-${state.typeOfApplication}/dental-insurance`, params));
}

export default function ApplicationSpokeDentalInsurance({ loaderData, params }: Route.ComponentProps) {
  const { t } = useTranslation(['applicationSpokes', 'application']);
  const { defaultState, applicationFlow } = loaderData;

  const fetcher = useFetcher<typeof action>();
  const { isSubmitting } = useFetcherSubmissionState(fetcher);

  const [hasDentalInsurance, setHasDentalInsurance] = useState(defaultState?.hasDentalInsurance);

  const errors = fetcher.data?.errors;

  function handleOnHasDentalInsuranceChanged(e: React.ChangeEvent<HTMLInputElement>) {
    setHasDentalInsurance(e.target.value === HAS_DENTAL_INSURANCE_OPTION.yes);
  }

  const helpMessage = (
    <div className="mb-4 space-y-4">
      <ul className="list-disc space-y-1 pl-7 font-semibold">
        <li>{t(($) => $.dentalInsurance.detail.additionalInfo.list.employer)}</li>
        <li>{t(($) => $.dentalInsurance.detail.additionalInfo.list.pension)}</li>
        <li>{t(($) => $.dentalInsurance.detail.additionalInfo.list.pensionPlans)}</li>
        <li>{t(($) => $.dentalInsurance.detail.additionalInfo.list.organization)}</li>
        <li>{t(($) => $.dentalInsurance.detail.additionalInfo.list.company)}</li>
      </ul>
      <p className="font-semibold">{t(($) => $.dentalInsurance.detail.additionalInfo.eligible)}</p>
      <p>{t(($) => $.dentalInsurance.detail.additionalInfo.access)}</p>
    </div>
  );

  const t4Href = <InlineLink to={t(($) => $.dentalInsurance.no.alertT4Href)} className="external-link" newTabIndicator target="_blank" />;
  const t4aHref = <InlineLink to={t(($) => $.dentalInsurance.no.alertT4aHref)} className="external-link" newTabIndicator target="_blank" />;

  return (
    <>
      <AppPageTitle>{t(($) => $.dentalInsurance.title)}</AppPageTitle>
      <ErrorSummaryProvider actionData={fetcher.data}>
        <div className="max-w-prose">
          <p className="mb-4 italic">{t(($) => $.requiredLabel, { ns: 'application' })}</p>
          <ErrorSummary />
          <fetcher.Form method="post" noValidate>
            <CsrfTokenInput />
            <div className="my-6">
              <InputRadios
                id="has-dental-insurance"
                name="hasDentalInsurance"
                legend={t(($) => $.dentalInsurance.legend)}
                options={[
                  {
                    children: <Trans ns="applicationSpokes" i18nKey={($) => $.dentalInsurance.optionYes} />,
                    value: HAS_DENTAL_INSURANCE_OPTION.yes,
                    defaultChecked: defaultState?.hasDentalInsurance === true,
                    onChange: handleOnHasDentalInsuranceChanged,
                  },
                  {
                    children: <Trans ns="applicationSpokes" i18nKey={($) => $.dentalInsurance.optionNo} />,
                    value: HAS_DENTAL_INSURANCE_OPTION.no,
                    defaultChecked: defaultState?.hasDentalInsurance === false,
                    onChange: handleOnHasDentalInsuranceChanged,
                  },
                ]}
                helpMessagePrimary={helpMessage}
                helpMessagePrimaryClassName="text-black"
                errorMessage={errors?.hasDentalInsurance}
                required
              />
            </div>
            {hasDentalInsurance === true && (
              <div className="mb-4 space-y-4">
                <ContextualAlert type="info" id="dental-insurance-confirmation-yes">
                  <h2 className="font-lato mb-2 text-xl font-semibold">{t(($) => $.dentalInsurance.yes.alertTitle)}</h2>
                  <p>{t(($) => $.dentalInsurance.yes.alertBody)}</p>
                </ContextualAlert>
                <InputCheckbox
                  id="dental-insurance-eligibility-confirmation-yes"
                  name="dentalInsuranceEligibilityConfirmationYes"
                  value={CHECKBOX_VALUE.yes}
                  defaultChecked={defaultState?.dentalInsuranceEligibilityConfirmationYes}
                  errorMessage={errors?.dentalInsuranceEligibilityConfirmationYes}
                  required
                  aria-describedby="dental-insurance-confirmation-yes"
                >
                  {t(($) => $.dentalInsurance.yes.confirmation)}
                </InputCheckbox>
              </div>
            )}
            {hasDentalInsurance === false && (
              <div className="mb-4 space-y-4">
                <ContextualAlert type="info" id="dental-insurance-confirmation-no">
                  <h2 className="font-lato mb-2 text-xl font-semibold">{t(($) => $.dentalInsurance.no.alertTitle)}</h2>
                  <Trans ns="applicationSpokes" i18nKey={($) => $.dentalInsurance.no.alertBody} components={{ t4Href, t4aHref }} />
                </ContextualAlert>
                <InputCheckbox
                  id="dental-insurance-eligibility-confirmation-no"
                  name="dentalInsuranceEligibilityConfirmationNo"
                  value={CHECKBOX_VALUE.yes}
                  defaultChecked={defaultState?.dentalInsuranceEligibilityConfirmationNo}
                  errorMessage={errors?.dentalInsuranceEligibilityConfirmationNo}
                  required
                  aria-describedby="dental-insurance-confirmation-no"
                >
                  {t(($) => $.dentalInsurance.no.confirmation)}
                </InputCheckbox>
              </div>
            )}

            <div className="mt-8 flex flex-row-reverse flex-wrap items-center justify-end gap-3">
              <LoadingButton id="save-button" variant="primary" loading={isSubmitting} data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Spoke:Save - Access to other dental insurance click">
                {t(($) => $.dentalInsurance.saveBtn)}
              </LoadingButton>
              <ButtonLink
                id="back-button"
                variant="secondary"
                routeId={`public/application/$id/${applicationFlow}/dental-insurance`}
                params={params}
                disabled={isSubmitting}
                data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Spoke:Back - Access to other dental insurance click"
              >
                {t(($) => $.dentalInsurance.backBtn)}
              </ButtonLink>
            </div>
          </fetcher.Form>
        </div>
      </ErrorSummaryProvider>
    </>
  );
}
