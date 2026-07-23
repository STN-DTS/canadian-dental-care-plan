import { useState } from 'react';

import { data, redirect, useFetcher } from 'react-router';

import { Trans, useTranslation } from 'react-i18next';
import validator from 'validator';
import * as z from 'zod';

import type { Route } from './+types/child-federal-provincial-territorial-benefits';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import type { PublicApplicationDentalFederalBenefitsState, PublicApplicationDentalProvincialTerritorialBenefitsState } from '~/.server/routes/helpers/public-application-route-helpers';
import { getPublicApplicationState, getSingleChildState, savePublicApplicationState, validateApplicationFlow } from '~/.server/routes/helpers/public-application-route-helpers';
import { getFixedT, getLocale } from '~/.server/utils/locale-utils';
import { transformFlattenedError } from '~/.server/utils/zod-utils';
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
  pageIdentifier: pageIds.public.application.spokes.childFederalProvincialTerritorialBenefits,
} as const satisfies RouteHandleData;

export const meta: Route.MetaFunction = mergeMeta(({ loaderData }) => {
  return getTitleMetaTags(loaderData.meta.title, loaderData.meta.dcTermsTitle);
});

export async function loader({ context, params, url }: Route.LoaderArgs) {
  const { appContainer, session } = context.get(appContext);
  const state = getPublicApplicationState({ params, session });
  validateApplicationFlow(state, params, ['full-children', 'full-family', 'simplified-children', 'simplified-family']);
  const childState = getSingleChildState({ params, session });

  const { CANADA_COUNTRY_ID } = appContainer.get(TYPES.ClientConfig);
  const t = await getFixedT(url, ['applicationSpokes', 'gcweb']);
  const locale = getLocale(url);

  const federalSocialPrograms = await appContainer.get(TYPES.FederalGovernmentInsurancePlanService).listAndSortLocalizedFederalGovernmentInsurancePlans(locale);
  const allRegions = await appContainer.get(TYPES.ProvinceTerritoryStateService).listAndSortLocalizedProvinceTerritoryStates(locale);
  const provincialTerritorialSocialPrograms = await appContainer.get(TYPES.ProvincialGovernmentInsurancePlanService).listAndSortLocalizedProvincialGovernmentInsurancePlans(locale);
  const regions = allRegions.filter(({ countryId }) => countryId === CANADA_COUNTRY_ID);

  const childNumber = t(($) => $.children.childNumber, {
    childNumber: childState.childNumber,
  });
  const childName = childState.information?.firstName ?? childNumber;

  const meta = {
    title: t(($) => $.meta.title.template, {
      title: t(($) => $.children.dentalBenefits.title, {
        childName: childName,
      }),

      ns: 'gcweb',
    }),
    dcTermsTitle: t(($) => $.meta.title.template, {
      title: t(($) => $.children.dentalBenefits.title, {
        childName: childNumber,
      }),

      ns: 'gcweb',
    }),
  };

  return {
    defaultState: childState.dentalBenefits?.value,
    federalSocialPrograms,
    meta,
    provincialTerritorialSocialPrograms,
    regions,
    childName,
    applicationFlow: `${state.inputModel}-${state.typeOfApplication}` as const,
  };
}

export async function action({ context, params, request, url }: Route.ActionArgs) {
  const { appContainer, session } = context.get(appContext);
  const state = getPublicApplicationState({ params, session });
  validateApplicationFlow(state, params, ['full-children', 'full-family', 'simplified-children', 'simplified-family']);

  const formData = await request.formData();

  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  securityHandler.validateCsrfToken({ formData, session });

  const childState = getSingleChildState({ params, session });
  const t = await getFixedT(url, 'applicationSpokes');

  // NOTE: state validation schemas are independent otherwise user have to anwser
  // both question first before the superRefine can be executed
  const federalBenefitsSchema = z
    .object({
      hasFederalBenefits: z.boolean({
        error: t(($) => $.children.dentalBenefits.errorMessage.federalBenefitRequired),
      }),
      federalSocialProgram: z.string().trim().optional(),
    })

    .superRefine((val, ctx) => {
      if (val.hasFederalBenefits && (!val.federalSocialProgram || validator.isEmpty(val.federalSocialProgram))) {
        ctx.addIssue({
          code: 'custom',
          message: t(($) => $.children.dentalBenefits.errorMessage.federalBenefitProgramRequired),
          path: ['federalSocialProgram'],
        });
      }
    })
    .transform((val) => {
      return {
        ...val,
        federalSocialProgram: val.hasFederalBenefits ? val.federalSocialProgram : undefined,
      };
    }) satisfies z.ZodType<PublicApplicationDentalFederalBenefitsState>;

  const provincialTerritorialBenefitsSchema = z
    .object({
      hasProvincialTerritorialBenefits: z.boolean({
        error: t(($) => $.children.dentalBenefits.errorMessage.provincialBenefitRequired),
      }),
      provincialTerritorialSocialProgram: z.string().trim().optional(),
      province: z.string().trim().optional(),
    })

    .superRefine((val, ctx) => {
      if (val.hasProvincialTerritorialBenefits) {
        if (!val.province || validator.isEmpty(val.province)) {
          ctx.addIssue({
            code: 'custom',
            message: t(($) => $.children.dentalBenefits.errorMessage.provincialTerritorialRequired),
            path: ['province'],
          });
        } else if (!val.provincialTerritorialSocialProgram || validator.isEmpty(val.provincialTerritorialSocialProgram)) {
          ctx.addIssue({
            code: 'custom',
            message: t(($) => $.children.dentalBenefits.errorMessage.provincialBenefitProgramRequired),
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
    }) satisfies z.ZodType<PublicApplicationDentalProvincialTerritorialBenefitsState>;

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

  savePublicApplicationState({
    params,
    session,
    state: {
      children: state.children.map((child) => {
        if (child.id !== childState.id) return child;
        return {
          ...child,
          dentalBenefits: {
            hasChanged: true,
            value: {
              ...parsedFederalBenefitsResult.data,
              ...parsedProvincialTerritorialBenefitsResult.data,
            },
          },
        };
      }),
    },
  });

  return redirect(getPathById(`public/application/$id/${state.inputModel}-${state.typeOfApplication}/childrens-application`, params));
}

export default function SpokeChildAccessToDentalDentalBenefits({ loaderData, params }: Route.ComponentProps) {
  const { t } = useTranslation(['applicationSpokes', 'application']);
  const { federalSocialPrograms, provincialTerritorialSocialPrograms, regions, defaultState, childName, applicationFlow } = loaderData;

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
      <AppPageTitle>{t(($) => $.children.dentalBenefits.title, { childName })}</AppPageTitle>
      <ErrorSummaryProvider actionData={fetcher.data}>
        <div className="max-w-prose">
          <p className="mb-4">{t(($) => $.children.dentalBenefits.accessToDental)}</p>
          <p className="mb-4">{t(($) => $.children.dentalBenefits.eligibilityCriteria)}</p>
          <p className="mb-4 italic">{t(($) => $.requiredLabel, { ns: 'application' })}</p>
          <ErrorSummary />
          <fetcher.Form method="post" noValidate>
            <CsrfTokenInput />
            <fieldset className="mb-6">
              <legend className="font-lato mb-4 text-2xl font-bold">
                {t(($) => $.children.dentalBenefits.federalBenefits.title, {
                  childName: childName,
                })}
              </legend>
              <InputRadios
                id="has-federal-benefits"
                name="hasFederalBenefits"
                legend={t(($) => $.children.dentalBenefits.federalBenefits.legend, {
                  childName: childName,
                })}
                options={[
                  {
                    children: <Trans ns="applicationSpokes" i18nKey={($) => $.children.dentalBenefits.federalBenefits.optionYes} />,
                    value: HAS_FEDERAL_BENEFITS_OPTION.yes,
                    defaultChecked: hasFederalBenefitValue === true,
                    onChange: handleOnHasFederalBenefitChanged,
                    append: hasFederalBenefitValue === true && (
                      <InputRadios
                        id="federal-social-programs"
                        name="federalSocialProgram"
                        legend={t(($) => $.children.dentalBenefits.federalBenefits.socialPrograms.legend)}
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
                    children: <Trans ns="applicationSpokes" i18nKey={($) => $.children.dentalBenefits.federalBenefits.optionNo} />,
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
              <legend className="font-lato mb-4 text-2xl font-bold">{t(($) => $.children.dentalBenefits.provincialTerritorialBenefits.title)}</legend>
              <InputRadios
                id="has-provincial-territorial-benefits"
                name="hasProvincialTerritorialBenefits"
                legend={t(($) => $.children.dentalBenefits.provincialTerritorialBenefits.legend, {
                  childName: childName,
                })}
                options={[
                  {
                    children: <Trans ns="applicationSpokes" i18nKey={($) => $.children.dentalBenefits.provincialTerritorialBenefits.optionYes} />,
                    value: HAS_PROVINCIAL_TERRITORIAL_BENEFITS_OPTION.yes,
                    defaultChecked: defaultState?.hasProvincialTerritorialBenefits === true,
                    onChange: handleOnHasProvincialTerritorialBenefitChanged,
                    append: hasProvincialTerritorialBenefitValue === true && (
                      <div className="space-y-6">
                        <InputSelect
                          id="province"
                          name="province"
                          className="w-full sm:w-1/2"
                          label={t(($) => $.children.dentalBenefits.provincialTerritorialBenefits.socialPrograms.inputLegend)}
                          onChange={handleOnRegionChanged}
                          options={[
                            {
                              children: t(($) => $.children.dentalBenefits.selectOne),
                              value: '',
                              hidden: true,
                            },
                            ...regions.map((region) => ({ id: region.id, value: region.id, children: region.name })),
                          ]}
                          defaultValue={provinceValue}
                          errorMessage={errors?.province}
                          required
                        />
                        {provinceValue && (
                          <InputRadios
                            id="provincial-territorial-social-programs"
                            name="provincialTerritorialSocialProgram"
                            legend={t(($) => $.children.dentalBenefits.provincialTerritorialBenefits.socialPrograms.radioLegend)}
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
                    children: <Trans ns="applicationSpokes" i18nKey={($) => $.children.dentalBenefits.provincialTerritorialBenefits.optionNo} />,
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
              <LoadingButton variant="primary" id="save-button" loading={isSubmitting} data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Spoke:Save - Child access to other federal, provincial or territorial dental benefits click">
                {t(($) => $.children.dentalBenefits.saveBtn)}
              </LoadingButton>
              <ButtonLink
                id="back-button"
                variant="secondary"
                routeId={`public/application/$id/${applicationFlow}/childrens-application`}
                params={params}
                disabled={isSubmitting}
                data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Spoke:Back - Child access to other federal, provincial or territorial dental benefits click"
              >
                {t(($) => $.children.dentalBenefits.backBtn)}
              </ButtonLink>
            </div>
          </fetcher.Form>
        </div>
      </ErrorSummaryProvider>
    </>
  );
}
