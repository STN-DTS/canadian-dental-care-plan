import { data, redirect, useFetcher } from 'react-router';

import { Trans, useTranslation } from 'react-i18next';
import * as z from 'zod';

import type { Route } from './+types/phone-number';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import { getProtectedApplicationState, saveProtectedApplicationState, validateApplicationFlow } from '~/.server/routes/helpers/protected-application-route-helpers';
import type { ApplicationFlow } from '~/.server/routes/helpers/protected-application-route-helpers';
import { getFixedT } from '~/.server/utils/locale.utils';
import { transformFlattenedError } from '~/.server/utils/zod.utils';
import { phoneSchema } from '~/.server/validation/phone-schema';
import { AppPageTitle } from '~/components/app-page-title';
import { ButtonLink } from '~/components/buttons';
import { Collapsible } from '~/components/collapsible';
import { CsrfTokenInput } from '~/components/csrf-token-input';
import { ErrorSummary } from '~/components/error-summary';
import { ErrorSummaryProvider } from '~/components/error-summary-context';
import { InlineLink } from '~/components/inline-link';
import { InputPhoneField } from '~/components/input-phone-field';
import { LoadingButton } from '~/components/loading-button';
import { useFetcherSubmissionState } from '~/hooks';
import { pageIds } from '~/page-ids';
import { mergeMeta } from '~/utils/meta-utils';
import type { RouteHandleData } from '~/utils/route-utils';
import { getPathById } from '~/utils/route-utils';
import { getTitleMetaTags } from '~/utils/seo-utils';

function getRouteFromApplicationFlow(applicationFlow: ApplicationFlow) {
  switch (applicationFlow) {
    case 'intake-children': {
      return `protected/application/$id/${applicationFlow}/parent-or-guardian`;
    }
    case 'renewal-children': {
      return `protected/application/$id/${applicationFlow}/parent-or-guardian`;
    }
    default: {
      return `protected/application/$id/${applicationFlow}/contact-information`;
    }
  }
}

export const handle = {
  pageIdentifier: pageIds.protected.application.spokes.phoneNumber,
} as const satisfies RouteHandleData;

export const meta: Route.MetaFunction = mergeMeta(({ loaderData }) => getTitleMetaTags(loaderData.meta.title));

export async function loader({ context, params, url }: Route.LoaderArgs) {
  const { appContainer, session } = context.get(appContext);
  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  await securityHandler.validateAuthSession({ requestUrl: url, session });

  const state = getProtectedApplicationState({ params, session });
  validateApplicationFlow(state, params, ['renewal-adult', 'intake-adult', 'intake-children', 'intake-family', 'renewal-family', 'renewal-children']);

  const t = await getFixedT(url, ['protectedApplicationSpokes', 'gcweb']);

  const meta = {
    title: t(($) => $.meta.title.template, { ns: 'gcweb', title: t(($) => $.phoneNumber.pageTitle) }),
  };
  return {
    defaultState: {
      phoneNumber: state.phoneNumber?.value?.primary,
      phoneNumberAlt: state.phoneNumber?.value?.alternate,
    },
    applicationFlow: `${state.context}-${state.typeOfApplication}` as const,
    meta,
  };
}

export async function action({ context, params, request, url }: Route.ActionArgs) {
  const { appContainer, session } = context.get(appContext);
  const state = getProtectedApplicationState({ params, session });
  validateApplicationFlow(state, params, ['intake-adult', 'intake-children', 'intake-family', 'renewal-adult', 'renewal-family', 'renewal-children']);

  const formData = await request.formData();

  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  await securityHandler.validateAuthSession({ requestUrl: url, session });
  securityHandler.validateCsrfToken({ formData, session });

  const t = await getFixedT(url, 'protectedApplicationSpokes');

  const applicationFlow: ApplicationFlow = `${state.context}-${state.typeOfApplication}`;

  const phoneNumberSchema = z.object({
    phoneNumber: phoneSchema({
      required_error: t(($) => $.phoneNumber.errorMessage.phoneRequired),
      invalid_phone_canadian_error: t(($) => $.phoneNumber.errorMessage.phoneNumberValid),
      invalid_phone_international_error: t(($) => $.phoneNumber.errorMessage.phoneNumberValidInternational),
    }),
    phoneNumberAlt: phoneSchema({
      invalid_phone_canadian_error: t(($) => $.phoneNumber.errorMessage.phoneNumberAltValid),
      invalid_phone_international_error: t(($) => $.phoneNumber.errorMessage.phoneNumberAltValidInternational),
    }).optional(),
  });

  const parsedDataResult = phoneNumberSchema.safeParse({
    phoneNumber: formData.get('phoneNumber')?.toString(),
    phoneNumberAlt: formData.get('phoneNumberAlt') ? String(formData.get('phoneNumberAlt')) : undefined,
  });

  if (!parsedDataResult.success) {
    return data({ errors: transformFlattenedError(z.flattenError(parsedDataResult.error)) }, { status: 400 });
  }

  saveProtectedApplicationState({
    params,
    session,
    state: {
      phoneNumber: {
        hasChanged: true,
        value: {
          primary: parsedDataResult.data.phoneNumber,
          alternate: parsedDataResult.data.phoneNumberAlt,
        },
      },
    },
  });

  return redirect(getPathById(getRouteFromApplicationFlow(applicationFlow), params));
}

export default function PhoneNumber({ loaderData, params }: Route.ComponentProps) {
  const { t } = useTranslation(['protectedApplicationSpokes', 'protectedApplication']);
  const { defaultState, applicationFlow } = loaderData;

  const fetcher = useFetcher<typeof action>();
  const { isSubmitting } = useFetcherSubmissionState(fetcher);

  const errors = typeof fetcher.data === 'object' && 'errors' in fetcher.data ? fetcher.data.errors : undefined;

  const findOffice = <InlineLink to={t(($) => $.phoneNumber.officeLink)} className="external-link" newTabIndicator target="_blank" />;

  return (
    <>
      <AppPageTitle>{t(($) => $.phoneNumber.pageTitle)}</AppPageTitle>
      <div className="max-w-prose">
        <ErrorSummaryProvider actionData={fetcher.data}>
          <ErrorSummary />
          <fetcher.Form method="post" noValidate>
            <CsrfTokenInput />
            <div className="mb-6">
              <p className="mb-4 italic">{t(($) => $.optionalLabel, { ns: 'protectedApplication' })}</p>
              <div className="grid items-end gap-6">
                <InputPhoneField
                  id="phone-number"
                  name="phoneNumber"
                  type="tel"
                  inputMode="tel"
                  className="w-full"
                  autoComplete="tel"
                  defaultValue={defaultState.phoneNumber ?? ''}
                  errorMessage={errors?.phoneNumber}
                  label={t(($) => $.phoneNumber.phoneNumber)}
                  maxLength={100}
                  helpMessagePrimary={t(($) => $.phoneNumber.helpMessage)}
                  helpMessagePrimaryClassName="text-gray-600"
                />
                <InputPhoneField
                  id="phone-number-alt"
                  name="phoneNumberAlt"
                  type="tel"
                  inputMode="tel"
                  className="w-full"
                  autoComplete="tel"
                  defaultValue={defaultState.phoneNumberAlt ?? ''}
                  errorMessage={errors?.phoneNumberAlt}
                  label={t(($) => $.phoneNumber.phoneNumberAlt)}
                  maxLength={100}
                  helpMessagePrimary={t(($) => $.phoneNumber.helpMessageAlt)}
                  helpMessagePrimaryClassName="text-gray-600"
                />
              </div>
            </div>
            <Collapsible summary={t(($) => $.phoneNumber.dontHaveNumber)}>
              <div className="space-y-6">
                <section className="space-y-4">
                  <p>{t(($) => $.phoneNumber.needPhoneNumber)}</p>
                  <ul className="list-disc space-y-1 pl-7">
                    <li>
                      <Trans ns="protectedApplicationSpokes" i18nKey={($) => $.phoneNumber.serviceCanada} components={{ noWrap: <span className="whitespace-nowrap" /> }} />
                    </li>
                    <li>
                      <Trans ns="protectedApplicationSpokes" i18nKey={($) => $.phoneNumber.inPerson} components={{ findOffice }} />
                    </li>
                  </ul>
                </section>
              </div>
            </Collapsible>
            <div className="mt-8 flex flex-row-reverse flex-wrap items-center justify-end gap-3">
              <LoadingButton variant="primary" id="save-button" loading={isSubmitting} data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Spoke:Save - Phone number click">
                {t(($) => $.phoneNumber.saveBtn)}
              </LoadingButton>
              <ButtonLink
                id="back-button"
                variant="secondary"
                routeId={getRouteFromApplicationFlow(applicationFlow)}
                params={params}
                disabled={isSubmitting}
                data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Spoke:Back - Phone number click"
              >
                {t(($) => $.phoneNumber.backBtn)}
              </ButtonLink>
            </div>
          </fetcher.Form>
        </ErrorSummaryProvider>
      </div>
    </>
  );
}
