import type { ReactNode } from 'react';
import { useEffect } from 'react';

import { data, useFetcher, useNavigate } from 'react-router';

import { Trans, useTranslation } from 'react-i18next';
import * as z from 'zod';

import type { Route } from './+types/communication-preferences';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import { getProtectedApplicationState, saveProtectedApplicationState, validateApplicationFlow } from '~/.server/routes/helpers/protected-application-route-helpers';
import type { ApplicationFlow } from '~/.server/routes/helpers/protected-application-route-helpers';
import { getFixedT, getLocale } from '~/.server/utils/locale.utils';
import { transformFlattenedError } from '~/.server/utils/zod.utils';
import { AppPageTitle } from '~/components/app-page-title';
import { ButtonLink } from '~/components/buttons';
import { ContextualAlert } from '~/components/contextual-alert';
import { CsrfTokenInput } from '~/components/csrf-token-input';
import { ErrorSummary } from '~/components/error-summary';
import { ErrorSummaryProvider } from '~/components/error-summary-context';
import { InputRadios } from '~/components/input-radios';
import type { InputRadiosProps } from '~/components/input-radios';
import { LoadingButton } from '~/components/loading-button';
import { useFetcherSubmissionState } from '~/hooks';
import { pageIds } from '~/page-ids';
import { useClientEnv } from '~/root';
import * as adobeAnalytics from '~/utils/adobe-analytics.client';
import { mergeMeta } from '~/utils/meta-utils';
import { getPathById } from '~/utils/route-utils';
import type { RouteHandleData } from '~/utils/route-utils';
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
  pageIdentifier: pageIds.protected.application.spokes.communicationPreferences,
} as const satisfies RouteHandleData;

export const meta: Route.MetaFunction = mergeMeta(({ loaderData }) => getTitleMetaTags(loaderData.meta.title));

export async function loader({ context, params, request }: Route.LoaderArgs) {
  const { appContainer, session } = context.get(appContext);
  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  await securityHandler.validateAuthSession({ request, session });

  const state = getProtectedApplicationState({ params, session });
  validateApplicationFlow(state, params, ['intake-adult', 'intake-children', 'intake-family', 'renewal-adult', 'renewal-family', 'renewal-children']);

  const t = await getFixedT(request, ['protectedApplicationSpokes', 'gcweb']);
  const locale = getLocale(request);

  const meta = {
    title: t(($) => $.meta.title.template, { ns: 'gcweb', title: t(($) => $.communicationPreferences.pageTitle) }),
  };

  const languages = appContainer.get(TYPES.LanguageService).listAndSortLocalizedLanguages(locale);
  const gcCommunicationMethods = appContainer.get(TYPES.GCCommunicationMethodService).listLocalizedGCCommunicationMethods(locale);
  const sunLifeCommunicationMethods = appContainer.get(TYPES.SunLifeCommunicationMethodService).listLocalizedSunLifeCommunicationMethods(locale);

  return {
    defaultState: state.communicationPreferences?.value,
    applicationFlow: `${state.context}-${state.typeOfApplication}` as const,
    languages,
    gcCommunicationMethods,
    sunLifeCommunicationMethods,
    meta,
  };
}

export async function action({ context, params, request }: Route.ActionArgs) {
  const { appContainer, session } = context.get(appContext);
  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  await securityHandler.validateAuthSession({ request, session });

  const state = getProtectedApplicationState({ params, session });
  validateApplicationFlow(state, params, ['intake-adult', 'intake-children', 'intake-family', 'renewal-adult', 'renewal-family', 'renewal-children']);

  const formData = await request.formData();

  securityHandler.validateCsrfToken({ formData, session });

  const t = await getFixedT(request, 'protectedApplicationSpokes');

  const applicationFlow: ApplicationFlow = `${state.context}-${state.typeOfApplication}`;

  const { COMMUNICATION_METHOD_GC_DIGITAL_ID } = appContainer.get(TYPES.ServerConfig);

  // state validation schema
  const communicationPreferencesSchema = z.object({
    preferredLanguage: z
      .string()
      .trim()
      .min(
        1,
        t(($) => $.communicationPreferences.errorMessage.preferredLanguageRequired),
      ),
    preferredMethod: z
      .string()
      .trim()
      .min(
        1,
        t(($) => $.communicationPreferences.errorMessage.preferredMethodRequired),
      ),
  });

  const parsedDataResult = communicationPreferencesSchema.safeParse({
    preferredLanguage: String(formData.get('preferredLanguage') ?? ''),
    preferredMethod: String(formData.get('preferredMethod') ?? ''),
  });

  if (!parsedDataResult.success) {
    return data({ errors: transformFlattenedError(z.flattenError(parsedDataResult.error)) }, { status: 400 });
  }

  saveProtectedApplicationState({
    params,
    session,
    state: {
      communicationPreferences: {
        hasChanged: true,
        value: {
          preferredLanguage: parsedDataResult.data.preferredLanguage,
          preferredMethod: parsedDataResult.data.preferredMethod,
          preferredNotificationMethod: COMMUNICATION_METHOD_GC_DIGITAL_ID,
        },
      },
    },
  });

  const redirectUrl = getPathById(getRouteFromApplicationFlow(applicationFlow), params);
  return { success: true, redirectUrl, revalidate: false };
}

export default function ApplicationSpokeCommunicationPreferences({ loaderData, params }: Route.ComponentProps) {
  const { t } = useTranslation(['protectedApplicationSpokes', 'protectedApplication']);
  const { defaultState, applicationFlow, sunLifeCommunicationMethods } = loaderData;
  const { COMMUNICATION_METHOD_SUNLIFE_EMAIL_ID } = useClientEnv();

  const navigate = useNavigate();
  const fetcher = useFetcher<typeof action>();
  const { isSubmitting } = useFetcherSubmissionState(fetcher);
  const errors = fetcher.data && 'errors' in fetcher.data ? fetcher.data.errors : undefined;
  const success = fetcher.data && 'success' in fetcher.data && fetcher.data.success === true;
  const redirectUrl = fetcher.data && 'redirectUrl' in fetcher.data ? fetcher.data.redirectUrl : undefined;

  // Consider the form to be in a submitting or successful state if it's currently being submitted or if it has been
  // successfully submitted to prevent multiple submissions and navigating away from the page while the form is being submitted
  const isSubmittingOrSuccess = isSubmitting || success === true;

  useEffect(() => {
    // Only navigate when the form has been successfully submitted to avoid interrupting ongoing navigations or navigating
    // away while the form is being submitted
    if (!isSubmitting && success && redirectUrl) {
      // Push form submit event to Adobe Analytics with form values when the form is successfully submitted
      if (adobeAnalytics.isConfigured()) {
        const formName = 'ESDC-EDSC:CDCP Communication preferences in MSCA application';
        const formValues = new Map<string, { elementType: 'radio'; value: string }>();

        function getCheckedValue(name: string, fieldId: string) {
          const selectedEl = document.querySelector<HTMLInputElement>(`input[name="${CSS.escape(name)}"]:checked`);
          if (selectedEl) {
            formValues.set(fieldId, {
              elementType: 'radio',
              value: selectedEl.attributes.getNamedItem('data-gc-analytics-value')?.value ?? selectedEl.value,
            });
          }
        }

        getCheckedValue('preferredLanguage', 'preferred-language');
        getCheckedValue('preferredMethod', 'preferred-method-sunlife');

        adobeAnalytics.pushFormSubmitEvent(formName, formValues);
      }

      void navigate(redirectUrl);
    }
  }, [isSubmitting, navigate, redirectUrl, success]);

  const preferredLanguageOptions: InputRadiosProps['options'] = loaderData.languages.map((language) => ({
    value: language.id,
    children: language.name,
    defaultChecked: defaultState?.preferredLanguage === language.id,
    'data-gc-analytics-value': language.code,
  }));

  const sunLifeCommunicationMethodOptions: InputRadiosProps['options'] = sunLifeCommunicationMethods.map((method) => {
    let children: ReactNode = <span className="font-semibold">{method.name}</span>;

    if (method.id === COMMUNICATION_METHOD_SUNLIFE_EMAIL_ID) {
      children = <Trans ns="protectedApplicationSpokes" i18nKey={($) => $.communicationPreferences.byEmail} values={{ name: method.name }} components={{ span: <span className="font-semibold" /> }} />;
    }

    return {
      value: method.id,
      children,
      defaultChecked: defaultState ? defaultState.preferredMethod === method.id : method.id === COMMUNICATION_METHOD_SUNLIFE_EMAIL_ID,
      'data-gc-analytics-value': method.code,
    };
  });

  return (
    <>
      <AppPageTitle>{t(($) => $.communicationPreferences.pageTitle)}</AppPageTitle>
      <ErrorSummaryProvider actionData={fetcher.data}>
        <div className="max-w-prose">
          <ContextualAlert type="info" id="dental-insurance-confirmation-no">
            <p>{t(($) => $.communicationPreferences.alert)}</p>
          </ContextualAlert>
          <p className="my-4 italic">{t(($) => $.requiredLabel, { ns: 'protectedApplication' })}</p>
          <ErrorSummary />
          <fetcher.Form method="post" noValidate>
            <CsrfTokenInput />
            <div className="mb-8 space-y-6">
              <InputRadios id="preferred-language" name="preferredLanguage" legend={t(($) => $.communicationPreferences.preferredLanguage)} options={preferredLanguageOptions} errorMessage={errors?.preferredLanguage} required />
              <InputRadios
                id="preferred-method-sunlife"
                legend={t(($) => $.communicationPreferences.preferredMethod)}
                name="preferredMethod"
                helpMessagePrimary={t(($) => $.communicationPreferences.preferredMethodHelpMessage)}
                helpMessagePrimaryClassName="text-black"
                options={sunLifeCommunicationMethodOptions}
                errorMessage={errors?.preferredMethod}
                required
              />
            </div>
            <div className="flex flex-row-reverse flex-wrap items-center justify-end gap-3">
              <LoadingButton variant="primary" id="save-button" loading={isSubmittingOrSuccess} data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Spoke:Save - Communication preferences click">
                {t(($) => $.communicationPreferences.save)}
              </LoadingButton>
              <ButtonLink
                id="back-button"
                variant="secondary"
                routeId={getRouteFromApplicationFlow(applicationFlow)}
                params={params}
                disabled={isSubmittingOrSuccess}
                data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Spoke:Back - Communication preferences click"
              >
                {t(($) => $.communicationPreferences.back)}
              </ButtonLink>
            </div>
          </fetcher.Form>
        </div>
      </ErrorSummaryProvider>
    </>
  );
}
