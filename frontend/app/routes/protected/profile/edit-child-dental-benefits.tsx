import { useState } from 'react';
import type { JSX } from 'react';

import { data, redirect, useFetcher } from 'react-router';

import { Trans, useTranslation } from 'react-i18next';
import validator from 'validator';
import * as z from 'zod';

import type { Route } from './+types/edit-child-dental-benefits';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import { getFixedT, getLocale } from '~/.server/utils/locale.utils';
import { transformFlattenedError } from '~/.server/utils/zod.utils';
import { AppPageTitle } from '~/components/app-page-title';
import { ProtectedBreadcrumbs } from '~/components/breadcrumbs';
import { ButtonLink } from '~/components/buttons';
import { CsrfTokenInput } from '~/components/csrf-token-input';
import { ErrorSummary } from '~/components/error-summary';
import { ErrorSummaryProvider } from '~/components/error-summary-context';
import { InputRadios } from '~/components/input-radios';
import { InputSelect } from '~/components/input-select';
import { LoadingButton } from '~/components/loading-button';
import { useFetcherSubmissionState } from '~/hooks';
import { pageIds } from '~/page-ids';
import { transformAdobeAnalyticsUrl } from '~/route-helpers/adobe-analytics-route-helpers';
import { mergeMeta } from '~/utils/meta-utils';
import { getPathById } from '~/utils/route-utils';
import type { RouteHandleData } from '~/utils/route-utils';
import { getTitleMetaTags } from '~/utils/seo-utils';

const FORM_ACTION = {
  continue: 'continue',
  cancel: 'cancel',
  save: 'save',
} as const;

const HAS_FEDERAL_BENEFITS_OPTION = {
  no: 'no',
  yes: 'yes',
} as const;

const HAS_PROVINCIAL_TERRITORIAL_BENEFITS_OPTION = {
  no: 'no',
  yes: 'yes',
} as const;

export const handle = {
  i18nPreloadNamespace: ['protectedProfile', 'gcweb'],
  layoutOptions: { breadcrumbs: <LayoutBreadcrumbs /> },
  transformAdobeAnalyticsUrl,
  pageIdentifier: pageIds.protected.profile.editChildDentalBenefits,
} as const satisfies RouteHandleData;

function LayoutBreadcrumbs(): JSX.Element {
  const { t } = useTranslation('protectedProfile');
  return (
    <ProtectedBreadcrumbs
      items={[
        {
          content: t(($) => $.editChildDentalBenefits.breadcrumb),
          routeId: 'protected/profile/dental-benefits',
        },
      ]}
    />
  );
}

export const meta: Route.MetaFunction = mergeMeta(({ loaderData }) => {
  return getTitleMetaTags(loaderData.meta.title, loaderData.meta.dcTermsTitle);
});

export async function loader({ context, params, request }: Route.LoaderArgs) {
  const { appContainer, session } = context.get(appContext);
  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  await securityHandler.validateAuthSession({ request, session });
  const clientApplication = await securityHandler.requireClientApplication({ params, request, session });

  const child = clientApplication.children.find((child) => child.information.clientId === params.childId);

  if (!child) {
    throw data('Not Found', { status: 404 });
  }

  const t = await getFixedT(request, ['protectedProfile', 'gcweb']);
  const locale = getLocale(request);

  const { CANADA_COUNTRY_ID } = appContainer.get(TYPES.ClientConfig);

  const federalSocialPrograms = await appContainer.get(TYPES.FederalGovernmentInsurancePlanService).listAndSortLocalizedFederalGovernmentInsurancePlans(locale);
  const allRegions = await appContainer.get(TYPES.ProvinceTerritoryStateService).listAndSortLocalizedProvinceTerritoryStates(locale);
  const provincialTerritorialSocialPrograms = await appContainer.get(TYPES.ProvincialGovernmentInsurancePlanService).listAndSortLocalizedProvincialGovernmentInsurancePlans(locale);
  const regions = allRegions.filter(({ countryId }) => countryId === CANADA_COUNTRY_ID);

  const federalProgram = federalSocialPrograms.find(({ id }) => child.dentalBenefits.includes(id));
  const provincialTerritorialProgram = provincialTerritorialSocialPrograms.find(({ id }) => child.dentalBenefits.includes(id));

  const childName = child.information.firstName;

  const meta = {
    title: t(($) => $.meta.title.mscaTemplate, {
      title: t(($) => $.editChildDentalBenefits.title, {
        childName: childName,
        ns: 'protectedProfile',
      }),

      ns: 'gcweb',
    }),
    dcTermsTitle: t(($) => $.meta.title.mscaTemplate, { ns: 'gcweb', title: t(($) => $.editChildDentalBenefits.dcTermsTitle) }),
  };

  const idToken = session.get('idToken');
  appContainer.get(TYPES.AuditService).createAudit('page-view.profile.edit-child-dental-benefits', { userId: idToken.sub });

  return {
    federalProgram,
    provincialTerritorialProgram,
    federalSocialPrograms,
    meta,
    provincialTerritorialSocialPrograms,
    regions,
    childName,
  };
}

export async function action({ context, params, request }: Route.ActionArgs) {
  const { appContainer, session } = context.get(appContext);
  const formData = await request.formData();

  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  await securityHandler.validateAuthSession({ request, session });
  securityHandler.validateCsrfToken({ formData, session });
  const clientApplication = await securityHandler.requireClientApplication({ params, request, session });

  const child = clientApplication.children.find((child) => child.information.clientId === params.childId);

  if (!child) {
    throw data('Not Found', { status: 404 });
  }

  const t = await getFixedT(request, 'protectedProfile');

  // NOTE: state validation schemas are independent otherwise user have to anwser
  // both question first before the superRefine can be executed
  const federalBenefitsSchema = z
    .object({
      hasFederalBenefits: z.boolean({
        error: t(($) => $.editChildDentalBenefits.errorMessage.federalBenefitRequired),
      }),
      federalSocialProgram: z.string().trim().optional(),
    })
    .superRefine((val, ctx) => {
      if (val.hasFederalBenefits && (!val.federalSocialProgram || validator.isEmpty(val.federalSocialProgram))) {
        ctx.addIssue({
          code: 'custom',
          message: t(($) => $.editChildDentalBenefits.errorMessage.federalBenefitProgramRequired),
          path: ['federalSocialProgram'],
        });
      }
    })
    .transform((val) => {
      return {
        ...val,
        federalSocialProgram: val.hasFederalBenefits ? val.federalSocialProgram : undefined,
      };
    });

  const provincialTerritorialBenefitsSchema = z
    .object({
      hasProvincialTerritorialBenefits: z.boolean({
        error: t(($) => $.editChildDentalBenefits.errorMessage.provincialBenefitRequired),
      }),
      provincialTerritorialSocialProgram: z.string().trim().optional(),
      province: z.string().trim().optional(),
    })
    .superRefine((val, ctx) => {
      if (val.hasProvincialTerritorialBenefits) {
        if (!val.province || validator.isEmpty(val.province)) {
          ctx.addIssue({
            code: 'custom',
            message: t(($) => $.editChildDentalBenefits.errorMessage.provincialTerritorialRequired),
            path: ['province'],
          });
        } else if (!val.provincialTerritorialSocialProgram || validator.isEmpty(val.provincialTerritorialSocialProgram)) {
          ctx.addIssue({
            code: 'custom',
            message: t(($) => $.editChildDentalBenefits.errorMessage.provincialBenefitProgramRequired),
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
    });

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

  const idToken = session.get('idToken');

  await appContainer.get(TYPES.ProfileService).updateDentalBenefits(
    {
      clientId: child.information.clientId,
      hasFederalBenefits: parsedFederalBenefitsResult.data.hasFederalBenefits,
      federalSocialProgram: parsedFederalBenefitsResult.data.federalSocialProgram,
      hasProvincialTerritorialBenefits: parsedProvincialTerritorialBenefitsResult.data.hasProvincialTerritorialBenefits,
      provincialTerritorialSocialProgram: parsedProvincialTerritorialBenefitsResult.data.provincialTerritorialSocialProgram,
    },
    idToken.sub,
  );

  appContainer.get(TYPES.AuditService).createAudit('update-data.profile.edit-child-dental-benefits', { userId: idToken.sub });

  return redirect(getPathById('protected/profile/dental-benefits', params));
}

export default function AccessToDentalInsuranceQuestion({ loaderData, params }: Route.ComponentProps) {
  const { t } = useTranslation('protectedProfile');
  const { federalSocialPrograms, provincialTerritorialSocialPrograms, regions, childName, federalProgram, provincialTerritorialProgram } = loaderData;

  const fetcher = useFetcher<typeof action>();
  const { isSubmitting } = useFetcherSubmissionState(fetcher);
  const [hasFederalBenefitValue, setHasFederalBenefitValue] = useState(federalProgram !== undefined);
  const [hasProvincialTerritorialBenefitValue, setHasProvincialTerritorialBenefitValue] = useState(provincialTerritorialProgram !== undefined);
  const [provincialTerritorialSocialProgramValue, setProvincialTerritorialSocialProgramValue] = useState(provincialTerritorialProgram?.id);
  const [provinceValue, setProvinceValue] = useState(provincialTerritorialProgram?.provinceTerritoryStateId);

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
      <AppPageTitle>{t(($) => $.editChildDentalBenefits.title, { childName })}</AppPageTitle>
      <div className="max-w-prose">
        <p className="mb-4">{t(($) => $.editChildDentalBenefits.accessToDental)}</p>
        <p className="mb-4">{t(($) => $.editChildDentalBenefits.eligibilityCriteria)}</p>
        <p className="mb-4 italic">{t(($) => $.requiredLabel)}</p>
        <ErrorSummaryProvider actionData={fetcher.data}>
          <ErrorSummary />
          <fetcher.Form method="post" noValidate>
            <CsrfTokenInput />
            <fieldset className="mb-6">
              <legend className="font-lato mb-4 text-2xl font-bold">
                {t(($) => $.editChildDentalBenefits.federalBenefits.title, {
                  childName: childName,
                  ns: 'protectedProfile',
                })}
              </legend>
              <InputRadios
                id="has-federal-benefits"
                name="hasFederalBenefits"
                legend={t(($) => $.editChildDentalBenefits.federalBenefits.legend, {
                  childName: childName,
                  ns: 'protectedProfile',
                })}
                options={[
                  {
                    children: <Trans ns="protectedProfile" i18nKey={($) => $.editChildDentalBenefits.federalBenefits.optionYes} />,
                    value: HAS_FEDERAL_BENEFITS_OPTION.yes,
                    defaultChecked: hasFederalBenefitValue === true,
                    onChange: handleOnHasFederalBenefitChanged,
                    append: hasFederalBenefitValue === true && (
                      <InputRadios
                        id="federal-social-programs"
                        name="federalSocialProgram"
                        legend={t(($) => $.editChildDentalBenefits.federalBenefits.socialPrograms.legend)}
                        legendClassName="font-normal"
                        options={federalSocialPrograms.map((option) => ({
                          children: option.name,
                          defaultChecked: federalProgram?.id === option.id,
                          value: option.id,
                        }))}
                        errorMessage={errors?.federalSocialProgram}
                        required
                      />
                    ),
                  },
                  {
                    children: <Trans ns="protectedProfile" i18nKey={($) => $.editChildDentalBenefits.federalBenefits.optionNo} />,
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
              <legend className="font-lato mb-4 text-2xl font-bold">{t(($) => $.editChildDentalBenefits.provincialTerritorialBenefits.title)}</legend>
              <InputRadios
                id="has-provincial-territorial-benefits"
                name="hasProvincialTerritorialBenefits"
                legend={t(($) => $.editChildDentalBenefits.provincialTerritorialBenefits.legend, {
                  childName: childName,
                  ns: 'protectedProfile',
                })}
                options={[
                  {
                    children: <Trans ns="protectedProfile" i18nKey={($) => $.editChildDentalBenefits.provincialTerritorialBenefits.optionYes} />,
                    value: HAS_PROVINCIAL_TERRITORIAL_BENEFITS_OPTION.yes,
                    defaultChecked: provincialTerritorialProgram !== undefined,
                    onChange: handleOnHasProvincialTerritorialBenefitChanged,
                    append: hasProvincialTerritorialBenefitValue === true && (
                      <div className="space-y-6">
                        <InputSelect
                          id="province"
                          name="province"
                          className="w-full sm:w-1/2"
                          label={t(($) => $.editChildDentalBenefits.provincialTerritorialBenefits.socialPrograms.inputLegend)}
                          onChange={handleOnRegionChanged}
                          options={[
                            {
                              children: t(($) => $.editChildDentalBenefits.selectOne),
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
                            legend={t(($) => $.editChildDentalBenefits.provincialTerritorialBenefits.socialPrograms.radioLegend)}
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
                    children: <Trans ns="protectedProfile" i18nKey={($) => $.editChildDentalBenefits.provincialTerritorialBenefits.optionNo} />,
                    value: HAS_PROVINCIAL_TERRITORIAL_BENEFITS_OPTION.no,
                    defaultChecked: provincialTerritorialProgram === undefined,
                    onChange: handleOnHasProvincialTerritorialBenefitChanged,
                  },
                ]}
                errorMessage={errors?.hasProvincialTerritorialBenefits}
                required
              />
            </fieldset>
            <div className="mt-8 flex flex-row-reverse flex-wrap items-center justify-end gap-3">
              <LoadingButton variant="primary" id="save-button" name="_action" value={FORM_ACTION.save} loading={isSubmitting} data-gc-analytics-customclick="ESDC-EDSC:CDCP Applicant Profile-Protected:Save - Access to other dental benefits click">
                {t(($) => $.editDentalBenefits.button.saveBtn)}
              </LoadingButton>
              <ButtonLink
                variant="secondary"
                id="back-button"
                routeId="protected/profile/dental-benefits"
                params={params}
                disabled={isSubmitting}
                data-gc-analytics-customclick="ESDC-EDSC:CDCP Applicant Profile-Protected:Back - Access to other dental benefits click"
              >
                {t(($) => $.editDentalBenefits.button.back)}
              </ButtonLink>
            </div>
          </fetcher.Form>
        </ErrorSummaryProvider>
      </div>
    </>
  );
}
