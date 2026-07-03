import type { ChangeEventHandler } from 'react';
import { useMemo, useState } from 'react';

import { data, redirect, useFetcher } from 'react-router';

import { useTranslation } from 'react-i18next';
import * as z from 'zod';

import type { Route } from './+types/marital-status';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import { isSinReserved, maritalStatusHasPartner } from '~/.server/routes/helpers/base-application-route-helpers';
import type { ApplicationFlow, PublicApplicationPartnerInformationState } from '~/.server/routes/helpers/public-application-route-helpers';
import { getPublicApplicantSin, getPublicApplicationState, getPublicChildrenSins, savePublicApplicationState, validateApplicationFlow } from '~/.server/routes/helpers/public-application-route-helpers';
import { getFixedT, getLocale } from '~/.server/utils/locale.utils';
import { transformFlattenedError } from '~/.server/utils/zod.utils';
import { AppPageTitle } from '~/components/app-page-title';
import { ButtonLink } from '~/components/buttons';
import { CsrfTokenInput } from '~/components/csrf-token-input';
import { ErrorSummary } from '~/components/error-summary';
import { ErrorSummaryProvider } from '~/components/error-summary-context';
import { InputCheckbox } from '~/components/input-checkbox';
import { InputPatternField } from '~/components/input-pattern-field';
import type { InputRadiosProps } from '~/components/input-radios';
import { InputRadios } from '~/components/input-radios';
import { LoadingButton } from '~/components/loading-button';
import { useFetcherSubmissionState } from '~/hooks';
import { pageIds } from '~/page-ids';
import { useClientEnv } from '~/root';
import { mergeMeta } from '~/utils/meta-utils';
import type { RouteHandleData } from '~/utils/route-utils';
import { getPathById } from '~/utils/route-utils';
import { getTitleMetaTags } from '~/utils/seo-utils';
import { isValidSin, sinInputPatternFormat } from '~/utils/sin-utils';

function getRouteFromApplicationFlow(applicationFlow: ApplicationFlow) {
  switch (applicationFlow) {
    case 'full-children': {
      return `public/application/$id/${applicationFlow}/parent-or-guardian`;
    }
    default: {
      return `public/application/$id/${applicationFlow}/marital-status`;
    }
  }
}

export const handle = {
  pageIdentifier: pageIds.public.application.spokes.maritalStatus,
} as const satisfies RouteHandleData;

export const meta: Route.MetaFunction = mergeMeta(({ loaderData }) => getTitleMetaTags(loaderData.meta.title));

export async function loader({ context, params, request }: Route.LoaderArgs) {
  const { appContainer, session } = context.get(appContext);
  const state = getPublicApplicationState({ params, session });
  validateApplicationFlow(state, params, ['full-adult', 'full-children', 'full-family']);

  const t = await getFixedT(request, ['applicationSpokes', 'gcweb']);
  const locale = getLocale(request);
  const meta = {
    title: t(($) => $.meta.title.template, { ns: 'gcweb', title: t(($) => $.maritalStatus.pageTitle) }),
  };
  const maritalStatuses = appContainer.get(TYPES.MaritalStatusService).listLocalizedMaritalStatuses(locale);
  return {
    defaultState: { maritalStatus: state.maritalStatus, ...state.partnerInformation },
    applicationFlow: `${state.inputModel}-${state.typeOfApplication}` as const,
    meta,
    maritalStatuses,
  };
}

export async function action({ context, params, request }: Route.ActionArgs) {
  const { appContainer, session } = context.get(appContext);
  const state = getPublicApplicationState({ params, session });
  validateApplicationFlow(state, params, ['full-adult', 'full-children', 'full-family']);

  const formData = await request.formData();

  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  securityHandler.validateCsrfToken({ formData, session });

  const t = await getFixedT(request, 'applicationSpokes');

  const applicationFlow: ApplicationFlow = `${state.inputModel}-${state.typeOfApplication}`;

  // state validation schema
  const maritalStatusSchema = z.object({
    maritalStatus: z
      .string({
        error: t(($) => $.maritalStatus.errorMessage.maritalStatusRequired),
      })
      .trim()
      .min(
        1,
        t(($) => $.maritalStatus.errorMessage.maritalStatusRequired),
      ),
  });

  const currentYear = new Date().getFullYear();
  const partnerInformationSchema = z.object({
    consentToSharePersonalInformation: z.literal(
      true,
      t(($) => $.maritalStatus.errorMessage.confirmRequired),
    ),
    yearOfBirth: z
      .string()
      .trim()
      .min(
        1,
        t(($) => $.maritalStatus.errorMessage.dateOfBirthYearRequired),
      )
      .refine(
        (year) => Number.parseInt(year) > currentYear - 150,
        t(($) => $.maritalStatus.errorMessage.yobIsPast),
      )
      .refine(
        (year) => Number.parseInt(year) < currentYear,
        t(($) => $.maritalStatus.errorMessage.yobIsFuture),
      ),
    socialInsuranceNumber: z
      .string()
      .trim()
      .min(
        1,
        t(($) => $.maritalStatus.errorMessage.sinRequired),
      )
      .superRefine((sin, ctx) => {
        if (!isValidSin(sin)) {
          ctx.addIssue({ code: 'custom', message: t(($) => $.maritalStatus.errorMessage.sinValid) });
          return;
        }

        if (isSinReserved(sin, [getPublicApplicantSin(state), ...getPublicChildrenSins(state)])) {
          ctx.addIssue({ code: 'custom', message: t(($) => $.maritalStatus.errorMessage.sinUnique) });
        }
      }),
  }) satisfies z.ZodType<PublicApplicationPartnerInformationState>;

  const maritalStatusData = {
    maritalStatus: formData.get('maritalStatus') ? String(formData.get('maritalStatus')) : undefined,
  };
  const partnerInformationData = {
    consentToSharePersonalInformation: formData.get('consentToSharePersonalInformation') === 'yes',
    yearOfBirth: String(formData.get('yearOfBirth') ?? ''),
    socialInsuranceNumber: String(formData.get('socialInsuranceNumber') ?? ''),
  };

  const parsedMaritalStatus = maritalStatusSchema.safeParse(maritalStatusData);
  const parsedPartnerInformation = partnerInformationSchema.safeParse(partnerInformationData);

  if (!parsedMaritalStatus.success || (maritalStatusHasPartner(parsedMaritalStatus.data.maritalStatus) && !parsedPartnerInformation.success)) {
    return data(
      {
        errors: {
          ...(parsedMaritalStatus.error ? transformFlattenedError(z.flattenError(parsedMaritalStatus.error)) : {}),
          ...(parsedMaritalStatus.success && maritalStatusHasPartner(parsedMaritalStatus.data.maritalStatus) && parsedPartnerInformation.error ? transformFlattenedError(z.flattenError(parsedPartnerInformation.error)) : {}),
        },
      },
      { status: 400 },
    );
  }

  savePublicApplicationState({
    params,
    session,
    state: {
      maritalStatus: parsedMaritalStatus.data.maritalStatus,
      partnerInformation: parsedPartnerInformation.data,
    },
  });

  return redirect(getPathById(getRouteFromApplicationFlow(applicationFlow), params));
}

export default function ApplicationSpokeMaritalStatus({ loaderData, params }: Route.ComponentProps) {
  const { t } = useTranslation(['applicationSpokes', 'application']);
  const { defaultState, maritalStatuses, applicationFlow } = loaderData;
  const { MARITAL_STATUS_CODE_COMMON_LAW, MARITAL_STATUS_CODE_MARRIED } = useClientEnv();
  const fetcher = useFetcher<typeof action>();
  const { isSubmitting } = useFetcherSubmissionState(fetcher);

  const [selectedMaritalStatus, setSelectedMaritalStatus] = useState(defaultState.maritalStatus);

  const errors = fetcher.data?.errors;

  const handleChange: ChangeEventHandler<HTMLInputElement> = (e) => {
    setSelectedMaritalStatus(e.target.value);
  };

  const maritalStatusOptions = useMemo<InputRadiosProps['options']>(() => {
    return maritalStatuses.map(({ id, name }) => ({
      value: id,
      children: name,
      defaultChecked: defaultState.maritalStatus === id,
      onChange: handleChange,
    }));
  }, [defaultState, maritalStatuses]);

  return (
    <>
      <AppPageTitle>{t(($) => $.maritalStatus.pageTitle)}</AppPageTitle>
      <div className="max-w-prose">
        <p className="mb-4 italic">{t(($) => $.requiredLabel, { ns: 'application' })}</p>
        <ErrorSummaryProvider actionData={fetcher.data}>
          <ErrorSummary />
          <fetcher.Form method="post" noValidate>
            <CsrfTokenInput />
            <div className="mb-8 space-y-6">
              <InputRadios
                id="maritalStatus"
                name="maritalStatus"
                legend={t(($) => $.maritalStatus.maritalStatus)}
                helpMessagePrimary={t(($) => $.maritalStatus.primaryHelpMessage)}
                options={maritalStatusOptions}
                errorMessage={errors?.maritalStatus}
                required
              />

              {(selectedMaritalStatus === MARITAL_STATUS_CODE_COMMON_LAW || selectedMaritalStatus === MARITAL_STATUS_CODE_MARRIED) && (
                <>
                  <h2 className="font-lato mb-6 text-2xl font-bold">{t(($) => $.maritalStatus.spouseOrCommonlaw)}</h2>
                  <p className="mb-4">{t(($) => $.maritalStatus.provideSin)}</p>
                  <p className="mb-6">{t(($) => $.maritalStatus.requiredInformation)}</p>
                  <InputPatternField
                    id="social-insurance-number"
                    name="socialInsuranceNumber"
                    format={sinInputPatternFormat}
                    label={t(($) => $.maritalStatus.sin)}
                    inputMode="numeric"
                    helpMessagePrimary={t(($) => $.maritalStatus.sinHelp)}
                    helpMessagePrimaryClassName="text-black"
                    defaultValue={defaultState.socialInsuranceNumber ?? ''}
                    errorMessage={errors?.socialInsuranceNumber}
                    required
                  />
                  <InputPatternField
                    id="year-of-birth"
                    name="yearOfBirth"
                    inputMode="numeric"
                    format="####"
                    defaultValue={defaultState.yearOfBirth ?? ''}
                    label={t(($) => $.maritalStatus.yearOfBirth)}
                    helpMessagePrimary={t(($) => $.maritalStatus.yearOfBirthHelp)}
                    helpMessagePrimaryClassName="text-black"
                    errorMessage={errors?.yearOfBirth}
                    required
                  />
                  <InputCheckbox
                    id="consentToSharePersonalInformation"
                    name="consentToSharePersonalInformation"
                    value="yes"
                    errorMessage={errors?.consentToSharePersonalInformation}
                    defaultChecked={defaultState.consentToSharePersonalInformation === true}
                    required
                  >
                    {t(($) => $.maritalStatus.confirmCheckbox)}
                  </InputCheckbox>
                </>
              )}
            </div>
            <div className="flex flex-row-reverse flex-wrap items-center justify-end gap-3">
              <LoadingButton id="save-button" variant="primary" loading={isSubmitting} data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Spoke:Save - Marital status click">
                {t(($) => $.maritalStatus.saveBtn)}
              </LoadingButton>
              <ButtonLink
                id="back-button"
                variant="secondary"
                routeId={getRouteFromApplicationFlow(applicationFlow)}
                params={params}
                disabled={isSubmitting}
                data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Spoke:Back - Marital status click"
              >
                {t(($) => $.maritalStatus.backBtn)}
              </ButtonLink>
            </div>
          </fetcher.Form>
        </ErrorSummaryProvider>
      </div>
    </>
  );
}
