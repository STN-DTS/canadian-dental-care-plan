import { useState } from 'react';

import { data, redirect, useFetcher } from 'react-router';

import { Trans, useTranslation } from 'react-i18next';
import * as z from 'zod';

import type { Route } from './+types/child-dental-insurance';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import { getProtectedApplicationState, getSingleChildState, saveProtectedApplicationState, validateApplicationFlow } from '~/.server/routes/helpers/protected-application-route-helpers';
import { getFixedT } from '~/.server/utils/locale.utils';
import { transformFlattenedError } from '~/.server/utils/zod.utils';
import { AppPageTitle } from '~/components/app-page-title';
import { ButtonLink } from '~/components/buttons';
import { ContextualAlert } from '~/components/contextual-alert';
import { CsrfTokenInput } from '~/components/csrf-token-input';
import { ErrorSummary } from '~/components/error-summary';
import { ErrorSummaryProvider } from '~/components/error-summary-context';
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
  pageIdentifier: pageIds.protected.application.spokes.childDentalInsurance,
} as const satisfies RouteHandleData;

export const meta: Route.MetaFunction = mergeMeta(({ loaderData }) => {
  return getTitleMetaTags(loaderData.meta.title, loaderData.meta.dcTermsTitle);
});

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
      title: t(($) => $.children.dentalInsurance.title, {
        childName: childName,
      }),

      ns: 'gcweb',
    }),
    dcTermsTitle: t(($) => $.meta.title.template, {
      title: t(($) => $.children.dentalInsurance.title, {
        childName: childNumber,
      }),

      ns: 'gcweb',
    }),
  };

  return { meta, defaultState: childState.dentalInsurance, childName, applicationFlow: `${state.context}-${state.typeOfApplication}` };
}

export async function action({ context, params, request }: Route.ActionArgs) {
  const { appContainer, session } = context.get(appContext);
  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  await securityHandler.validateAuthSession({ request, session });

  const state = getProtectedApplicationState({ params, session });
  validateApplicationFlow(state, params, ['intake-children', 'intake-family', 'renewal-children', 'renewal-family']);

  const formData = await request.formData();

  securityHandler.validateCsrfToken({ formData, session });

  const childState = getSingleChildState({ params, session });
  const t = await getFixedT(request, 'protectedApplicationSpokes');

  // state validation schema
  const dentalInsuranceSchema = z
    .object({
      hasDentalInsurance: z.boolean({
        error: t(($) => $.children.dentalInsurance.errorMessage.dentalInsuranceRequired),
      }),
      dentalInsuranceEligibilityConfirmation: z.string().trim().optional(),
    })
    .superRefine((val, ctx) => {
      if (val.hasDentalInsurance && !val.dentalInsuranceEligibilityConfirmation) {
        ctx.addIssue({
          code: 'custom',
          message: t(($) => $.children.dentalInsurance.errorMessage.dentalInsuranceEligibilityConfirmationRequired),
          path: ['dentalInsuranceEligibilityConfirmation'],
        });
      }
    })
    .transform((val) => ({
      ...val,
      dentalInsuranceEligibilityConfirmation: val.hasDentalInsurance ? val.dentalInsuranceEligibilityConfirmation === CHECKBOX_VALUE.yes : undefined,
    }));

  const parsedDataResult = dentalInsuranceSchema.safeParse({
    hasDentalInsurance: formData.get('hasDentalInsurance') ? formData.get('hasDentalInsurance') === 'yes' : undefined,
    dentalInsuranceEligibilityConfirmation: formData.get('dentalInsuranceEligibilityConfirmation') ?? '',
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
        return { ...child, dentalInsurance: parsedDataResult.data };
      }),
    },
  });

  return redirect(getPathById(`protected/application/$id/${state.context}-${state.typeOfApplication}/childrens-application`, params));
}

export default function ChildDentalInsurance({ loaderData, params }: Route.ComponentProps) {
  const { t } = useTranslation(['protectedApplicationSpokes', 'protectedApplication']);
  const { defaultState, childName, applicationFlow } = loaderData;

  const fetcher = useFetcher<typeof action>();
  const { isSubmitting } = useFetcherSubmissionState(fetcher);

  const errors = fetcher.data?.errors;

  const [hasDentalInsurance, setHasDentalInsurance] = useState(defaultState?.hasDentalInsurance);

  function handleOnHasDentalInsuranceChanged(e: React.ChangeEvent<HTMLInputElement>) {
    setHasDentalInsurance(e.target.value === HAS_DENTAL_INSURANCE_OPTION.yes);
  }

  const helpMessage = (
    <div className="mb-4 space-y-4">
      <ul className="list-disc space-y-1 pl-7 font-bold">
        <li>{t(($) => $.children.dentalInsurance.detail.additionalInfo.list.employer)}</li>
        <li>{t(($) => $.children.dentalInsurance.detail.additionalInfo.list.pension)}</li>
        <li>{t(($) => $.children.dentalInsurance.detail.additionalInfo.list.organization)}</li>
        <li>{t(($) => $.children.dentalInsurance.detail.additionalInfo.list.private)}</li>
      </ul>
      <p className="font-bold">{t(($) => $.children.dentalInsurance.detail.additionalInfo.eligible)}</p>
      <p>{t(($) => $.children.dentalInsurance.detail.additionalInfo.access)}</p>
    </div>
  );

  return (
    <>
      <AppPageTitle>{t(($) => $.children.dentalInsurance.title, { childName })}</AppPageTitle>
      <ErrorSummaryProvider actionData={fetcher.data}>
        <div className="max-w-prose">
          <p className="mb-4 italic">{t(($) => $.requiredLabel, { ns: 'protectedApplication' })}</p>
          <ErrorSummary />
          <fetcher.Form method="post" noValidate>
            <CsrfTokenInput />
            <div className="my-6">
              <InputRadios
                id="has-dental-insurance"
                name="hasDentalInsurance"
                legend={t(($) => $.children.dentalInsurance.legend, {
                  childName: childName,
                })}
                options={[
                  {
                    children: <Trans ns="protectedApplicationSpokes" i18nKey={($) => $.children.dentalInsurance.optionYes} />,
                    value: HAS_DENTAL_INSURANCE_OPTION.yes,
                    defaultChecked: defaultState?.hasDentalInsurance === true,
                    onChange: handleOnHasDentalInsuranceChanged,
                  },
                  {
                    children: <Trans ns="protectedApplicationSpokes" i18nKey={($) => $.children.dentalInsurance.optionNo} />,
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
            {hasDentalInsurance && (
              <div className="space-y-4">
                <ContextualAlert type="info" id="child-dental-insurance-confirmation">
                  <h2 className="font-lato mb-2 text-xl font-semibold">{t(($) => $.children.dentalInsurance.alert.title)}</h2>
                  <p>
                    {t(($) => $.children.dentalInsurance.alert.body, {
                      childName: childName,
                    })}
                  </p>
                </ContextualAlert>
                <InputCheckbox
                  id="dental-insurance-eligibility-confirmation"
                  name="dentalInsuranceEligibilityConfirmation"
                  value={CHECKBOX_VALUE.yes}
                  defaultChecked={defaultState?.dentalInsuranceEligibilityConfirmation}
                  errorMessage={errors?.dentalInsuranceEligibilityConfirmation}
                  required
                  aria-describedby="child-dental-insurance-confirmation"
                >
                  {t(($) => $.children.dentalInsurance.dentalInsuranceEligibilityConfirmation, {
                    childName: childName,
                  })}
                </InputCheckbox>
              </div>
            )}
            <div className="mt-8 flex flex-row-reverse flex-wrap items-center justify-end gap-3">
              <LoadingButton id="save-button" variant="primary" loading={isSubmitting} data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Spoke:Save - Child access to other dental insurance click">
                {t(($) => $.children.dentalInsurance.saveBtn)}
              </LoadingButton>
              <ButtonLink
                id="back-button"
                variant="secondary"
                routeId={`protected/application/$id/${applicationFlow}/childrens-application`}
                params={params}
                disabled={isSubmitting}
                data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Spoke:Back - Child access to other dental insurance click"
              >
                {t(($) => $.children.dentalInsurance.backBtn)}
              </ButtonLink>
            </div>
          </fetcher.Form>
        </div>
      </ErrorSummaryProvider>
    </>
  );
}
