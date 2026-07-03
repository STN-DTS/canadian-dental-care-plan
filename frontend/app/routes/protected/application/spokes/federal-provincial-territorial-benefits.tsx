import { useState } from 'react';

import { data, redirect, useFetcher } from 'react-router';

import { Trans, useTranslation } from 'react-i18next';
import validator from 'validator';
import * as z from 'zod';

import type { Route } from './+types/federal-provincial-territorial-benefits';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import type { ProtectedApplicationDentalFederalBenefitsState, ProtectedApplicationDentalProvincialTerritorialBenefitsState } from '~/.server/routes/helpers/protected-application-route-helpers';
import { getProtectedApplicationState, saveProtectedApplicationState, validateApplicationFlow } from '~/.server/routes/helpers/protected-application-route-helpers';
import { getFixedT, getLocale } from '~/.server/utils/locale.utils';
import { transformFlattenedError } from '~/.server/utils/zod.utils';
import { AppPageTitle } from '~/components/app-page-title';
import { ButtonLink } from '~/components/buttons';
import { CsrfTokenInput } from '~/components/csrf-token-input';
import { ErrorSummary } from '~/components/error-summary';
import { ErrorSummaryProvider } from '~/components/error-summary-context';
import { InputRadios } from '~/components/input-radios';
import { InputSelect } from '~/components/input-select';
import { LoadingButton } from '~/components/loading-button';
import { useFetcherSubmissionState } from '~/hooks';
import { pageIds } from '~/page-ids';
import { mergeMeta } from '~/utils/meta-utils';
import { getPathById } from '~/utils/route-utils';
import type { RouteHandleData } from '~/utils/route-utils';
import { getTitleMetaTags } from '~/utils/seo-utils';

const HAS_FEDERAL_BENEFITS_OPTION = {
  no: 'no',
  yes: 'yes',
} as const;

const HAS_PROVINCIAL_TERRITORIAL_BENEFITS_OPTION = {
  no: 'no',
  yes: 'yes',
} as const;

export const handle = {
  pageIdentifier: pageIds.protected.application.spokes.federalProvincialTerritorialBenefits,
} as const satisfies RouteHandleData;

export const meta: Route.MetaFunction = mergeMeta(({ loaderData }) => getTitleMetaTags(loaderData.meta.title));

export async function loader({ context, params, request }: Route.LoaderArgs) {
  const { appContainer, session } = context.get(appContext);
  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  await securityHandler.validateAuthSession({ request, session });

  const state = getProtectedApplicationState({ params, session });
  validateApplicationFlow(state, params, ['intake-adult', 'intake-children', 'intake-family', 'renewal-adult', 'renewal-family']);

  const { CANADA_COUNTRY_ID } = appContainer.get(TYPES.ClientConfig);

  const t = await getFixedT(request, ['protectedApplicationSpokes', 'gcweb']);
  const locale = getLocale(request);

  const federalSocialPrograms = await appContainer.get(TYPES.FederalGovernmentInsurancePlanService).listAndSortLocalizedFederalGovernmentInsurancePlans(locale);
  const provinceTerritoryStates = await appContainer.get(TYPES.ProvinceTerritoryStateService).listAndSortLocalizedProvinceTerritoryStatesByCountryId(CANADA_COUNTRY_ID, locale);
  const provincialTerritorialSocialPrograms = await appContainer.get(TYPES.ProvincialGovernmentInsurancePlanService).listAndSortLocalizedProvincialGovernmentInsurancePlans(locale);

  const meta = {
    title: t(($) => $.meta.title.template, { ns: 'gcweb', title: t(($) => $.dentalBenefits.title) }),
  };

  return {
    defaultState: state.dentalBenefits?.value,
    federalSocialPrograms,
    meta,
    provincialTerritorialSocialPrograms,
    provinceTerritoryStates,
    applicationFlow: `${state.context}-${state.typeOfApplication}` as const,
  };
}

export async function action({ context, params, request }: Route.ActionArgs) {
  const { appContainer, session } = context.get(appContext);
  const state = getProtectedApplicationState({ params, session });
  validateApplicationFlow(state, params, ['intake-adult', 'intake-children', 'intake-family', 'renewal-adult', 'renewal-family']);

  const formData = await request.formData();

  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  await securityHandler.validateAuthSession({ request, session });
  securityHandler.validateCsrfToken({ formData, session });

  const t = await getFixedT(request, 'protectedApplicationSpokes');

  // NOTE: state validation schemas are independent otherwise user have to anwser
  // both question first before the superRefine can be executed
  const federalBenefitsSchema = z
    .object({
      hasFederalBenefits: z.boolean({
        error: t(($) => $.dentalBenefits.errorMessage.federalBenefitRequired),
      }),
      federalSocialProgram: z.string().trim().optional(),
    })

    .superRefine((val, ctx) => {
      if (val.hasFederalBenefits && (!val.federalSocialProgram || validator.isEmpty(val.federalSocialProgram))) {
        ctx.addIssue({
          code: 'custom',
          message: t(($) => $.dentalBenefits.errorMessage.federalBenefitProgramRequired),
          path: ['federalSocialProgram'],
        });
      }
    })
    .transform((val) => {
      return {
        ...val,
        federalSocialProgram: val.hasFederalBenefits ? val.federalSocialProgram : undefined,
      };
    }) satisfies z.ZodType<ProtectedApplicationDentalFederalBenefitsState>;

  const provincialTerritorialBenefitsSchema = z
    .object({
      hasProvincialTerritorialBenefits: z.boolean({
        error: t(($) => $.dentalBenefits.errorMessage.provincialBenefitRequired),
      }),
      provincialTerritorialSocialProgram: z.string().trim().optional(),
      province: z.string().trim().optional(),
    })

    .superRefine((val, ctx) => {
      if (val.hasProvincialTerritorialBenefits) {
        if (!val.province || validator.isEmpty(val.province)) {
          ctx.addIssue({
            code: 'custom',
            message: t(($) => $.dentalBenefits.errorMessage.provincialTerritorialRequired),
            path: ['province'],
          });
        } else if (!val.provincialTerritorialSocialProgram || validator.isEmpty(val.provincialTerritorialSocialProgram)) {
          ctx.addIssue({
            code: 'custom',
            message: t(($) => $.dentalBenefits.errorMessage.provincialBenefitProgramRequired),
            path: ['provincialTerritorialSocialProgram'],
          });
        }
      }
    })
    .transform((val) => {
      return {
        ...val,
        province: val.hasProvincialTerritorialBenefits ? val.province : undefined,
        provincialTerritorialSocialProgram: val.hasProvincialTerritorialBenefits ? val.provincialTerritorialSocialProgram : undefined,
      };
    }) satisfies z.ZodType<ProtectedApplicationDentalProvincialTerritorialBenefitsState>;

  const dentalBenefits = {
    hasFederalBenefits: formData.get('hasFederalBenefits') ? formData.get('hasFederalBenefits') === HAS_FEDERAL_BENEFITS_OPTION.yes : undefined,
    federalSocialProgram: formData.get('federalSocialProgram') ? String(formData.get('federalSocialProgram')) : undefined,
    hasProvincialTerritorialBenefits: formData.get('hasProvincialTerritorialBenefits') ? formData.get('hasProvincialTerritorialBenefits') === HAS_PROVINCIAL_TERRITORIAL_BENEFITS_OPTION.yes : undefined,
    provincialTerritorialSocialProgram: formData.get('provincialTerritorialSocialProgram') ? String(formData.get('provincialTerritorialSocialProgram')) : undefined,
    province: formData.get('province') ? String(formData.get('province')) : undefined,
  };

  const parsedFederalBenefitsResult = federalBenefitsSchema.safeParse(dentalBenefits);
  const parsedProvincialTerritorialBenefitsResult = provincialTerritorialBenefitsSchema.safeParse(dentalBenefits);

  if (!parsedFederalBenefitsResult.success || !parsedProvincialTerritorialBenefitsResult.success) {
    return data(
      {
        errors: {
          ...(parsedFederalBenefitsResult.success ? {} : transformFlattenedError(z.flattenError(parsedFederalBenefitsResult.error))),
          ...(parsedProvincialTerritorialBenefitsResult.success ? {} : transformFlattenedError(z.flattenError(parsedProvincialTerritorialBenefitsResult.error))),
        },
      },
      { status: 400 },
    );
  }

  saveProtectedApplicationState({
    params,
    session,
    state: {
      dentalBenefits: {
        hasChanged: true,
        value: {
          ...parsedFederalBenefitsResult.data,
          ...parsedProvincialTerritorialBenefitsResult.data,
        },
      },
    },
  });

  return redirect(getPathById(`protected/application/$id/${state.context}-${state.typeOfApplication}/dental-insurance`, params));
}

export default function ApplicationSpokeFederalProvincialTerritorialBenefits({ loaderData, params }: Route.ComponentProps) {
  const { t } = useTranslation(['protectedApplicationSpokes', 'protectedApplication']);
  const { federalSocialPrograms, provincialTerritorialSocialPrograms, provinceTerritoryStates, defaultState, applicationFlow } = loaderData;

  const fetcher = useFetcher<typeof action>();
  const { isSubmitting } = useFetcherSubmissionState(fetcher);
  const [hasFederalBenefitValue, setHasFederalBenefitValue] = useState(defaultState?.hasFederalBenefits);
  const [hasProvincialTerritorialBenefitValue, setHasProvincialTerritorialBenefitValue] = useState(defaultState?.hasProvincialTerritorialBenefits);
  const [provincialTerritorialSocialProgramValue, setProvincialTerritorialSocialProgramValue] = useState(defaultState?.provincialTerritorialSocialProgram);
  const [provinceValue, setProvinceValue] = useState(defaultState?.province);

  const errors = fetcher.data?.errors;

  function handleOnHasFederalBenefitChanged(e: React.ChangeEvent<HTMLInputElement>) {
    setHasFederalBenefitValue(e.target.value === HAS_FEDERAL_BENEFITS_OPTION.yes);
  }

  function handleOnHasProvincialTerritorialBenefitChanged(e: React.ChangeEvent<HTMLInputElement>) {
    setHasProvincialTerritorialBenefitValue(e.target.value === HAS_PROVINCIAL_TERRITORIAL_BENEFITS_OPTION.yes);
    if (e.target.value !== HAS_PROVINCIAL_TERRITORIAL_BENEFITS_OPTION.yes) {
      setProvinceValue(undefined);
      setProvincialTerritorialSocialProgramValue(undefined);
    }
  }

  function handleOnProvincialTerritorialSocialProgramChanged(e: React.ChangeEvent<HTMLInputElement>) {
    setProvincialTerritorialSocialProgramValue(e.target.value);
  }

  function handleOnRegionChanged(e: React.ChangeEvent<HTMLSelectElement>) {
    setProvinceValue(e.target.value);
    setProvincialTerritorialSocialProgramValue(undefined);
  }

  return (
    <>
      <AppPageTitle>{t(($) => $.dentalBenefits.title)}</AppPageTitle>
      <div className="max-w-prose">
        <ErrorSummaryProvider actionData={fetcher.data}>
          <p className="mb-4">{t(($) => $.dentalBenefits.accessToDental)}</p>
          <p className="mb-4">{t(($) => $.dentalBenefits.eligibilityCriteria)}</p>
          <p className="mb-4 italic">{t(($) => $.requiredLabel, { ns: 'protectedApplication' })}</p>
          <ErrorSummary />
          <fetcher.Form method="post" noValidate>
            <CsrfTokenInput />
            <fieldset className="mb-6">
              <legend className="font-lato mb-4 text-2xl font-bold">{t(($) => $.dentalBenefits.federalBenefits.title)}</legend>
              <InputRadios
                id="has-federal-benefits"
                name="hasFederalBenefits"
                legend={t(($) => $.dentalBenefits.federalBenefits.legend)}
                options={[
                  {
                    children: <Trans ns="protectedApplicationSpokes" i18nKey={($) => $.dentalBenefits.federalBenefits.optionYes} />,
                    value: HAS_FEDERAL_BENEFITS_OPTION.yes,
                    defaultChecked: hasFederalBenefitValue === true,
                    onChange: handleOnHasFederalBenefitChanged,
                    append: hasFederalBenefitValue === true && (
                      <InputRadios
                        id="federal-social-programs"
                        name="federalSocialProgram"
                        legend={t(($) => $.dentalBenefits.federalBenefits.socialPrograms.legend)}
                        legendClassName="font-normal"
                        options={federalSocialPrograms.map((option) => ({
                          children: option.name,
                          defaultChecked: defaultState?.federalSocialProgram === option.id,
                          value: option.id,
                        }))}
                        errorMessage={errors?.federalSocialProgram}
                        required
                      />
                    ),
                  },
                  {
                    children: <Trans ns="protectedApplicationSpokes" i18nKey={($) => $.dentalBenefits.federalBenefits.optionNo} />,
                    value: HAS_FEDERAL_BENEFITS_OPTION.no,
                    defaultChecked: hasFederalBenefitValue === false,
                    onChange: handleOnHasFederalBenefitChanged,
                  },
                ]}
                errorMessage={errors?.hasFederalBenefits}
                required
              />
            </fieldset>
            <fieldset className="mb-8">
              <legend className="font-lato mb-4 text-2xl font-bold">{t(($) => $.dentalBenefits.provincialTerritorialBenefits.title)}</legend>
              <InputRadios
                id="has-provincial-territorial-benefits"
                name="hasProvincialTerritorialBenefits"
                legend={t(($) => $.dentalBenefits.provincialTerritorialBenefits.legend)}
                options={[
                  {
                    children: <Trans ns="protectedApplicationSpokes" i18nKey={($) => $.dentalBenefits.provincialTerritorialBenefits.optionYes} />,
                    value: HAS_PROVINCIAL_TERRITORIAL_BENEFITS_OPTION.yes,
                    defaultChecked: defaultState?.hasProvincialTerritorialBenefits === true,
                    onChange: handleOnHasProvincialTerritorialBenefitChanged,
                    append: hasProvincialTerritorialBenefitValue === true && (
                      <div className="space-y-6">
                        <InputSelect
                          id="province"
                          name="province"
                          className="w-full sm:w-1/2"
                          label={t(($) => $.dentalBenefits.provincialTerritorialBenefits.socialPrograms.inputLegend)}
                          onChange={handleOnRegionChanged}
                          options={[
                            {
                              children: t(($) => $.dentalBenefits.selectOne),
                              value: '',
                              hidden: true,
                            },
                            ...provinceTerritoryStates.map((region) => ({ id: region.id, value: region.id, children: region.name })),
                          ]}
                          defaultValue={provinceValue}
                          errorMessage={errors?.province}
                          required
                        />
                        {provinceValue && (
                          <InputRadios
                            id="provincial-territorial-social-programs"
                            name="provincialTerritorialSocialProgram"
                            legend={t(($) => $.dentalBenefits.provincialTerritorialBenefits.socialPrograms.radioLegend)}
                            legendClassName="font-normal"
                            errorMessage={errors?.provincialTerritorialSocialProgram}
                            options={provincialTerritorialSocialPrograms
                              .filter((program) => program.provinceTerritoryStateId === provinceValue)
                              .map((option) => ({
                                children: option.name,
                                value: option.id,
                                checked: provincialTerritorialSocialProgramValue === option.id,
                                onChange: handleOnProvincialTerritorialSocialProgramChanged,
                              }))}
                            required
                          />
                        )}
                      </div>
                    ),
                  },
                  {
                    children: <Trans ns="protectedApplicationSpokes" i18nKey={($) => $.dentalBenefits.provincialTerritorialBenefits.optionNo} />,
                    value: HAS_PROVINCIAL_TERRITORIAL_BENEFITS_OPTION.no,
                    defaultChecked: defaultState?.hasProvincialTerritorialBenefits === false,
                    onChange: handleOnHasProvincialTerritorialBenefitChanged,
                  },
                ]}
                errorMessage={errors?.hasProvincialTerritorialBenefits}
                required
              />
            </fieldset>
            <div className="mt-8 flex flex-row-reverse flex-wrap items-center justify-end gap-3">
              <LoadingButton variant="primary" id="save-button" loading={isSubmitting} data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Spoke:Save - Access to other dental benefits click">
                {t(($) => $.dentalBenefits.saveBtn)}
              </LoadingButton>
              <ButtonLink
                id="back-button"
                variant="secondary"
                routeId={`protected/application/$id/${applicationFlow}/dental-insurance`}
                params={params}
                disabled={isSubmitting}
                data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Spoke:Back - Access to other dental benefits click"
              >
                {t(($) => $.dentalBenefits.backBtn)}
              </ButtonLink>
            </div>
          </fetcher.Form>
        </ErrorSummaryProvider>
      </div>
    </>
  );
}
