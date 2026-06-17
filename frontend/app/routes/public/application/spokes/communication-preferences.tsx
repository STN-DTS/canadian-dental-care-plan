import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

import { data, useFetcher, useNavigate } from 'react-router';

import { Trans, useTranslation } from 'react-i18next';
import * as z from 'zod';

import type { Route } from './+types/communication-preferences';

import { TYPES } from '~/.server/constants';
import { getPublicApplicationState, savePublicApplicationState, validateApplicationFlow } from '~/.server/routes/helpers/public-application-route-helpers';
import type { ApplicationFlow, PublicApplicationCommunicationPreferencesState } from '~/.server/routes/helpers/public-application-route-helpers';
import { getFixedT, getLocale } from '~/.server/utils/locale.utils';
import { transformFlattenedError } from '~/.server/utils/zod.utils';
import { AppPageTitle } from '~/components/app-page-title';
import { ButtonLink } from '~/components/buttons';
import { CsrfTokenInput } from '~/components/csrf-token-input';
import { ErrorSummary } from '~/components/error-summary';
import { ErrorSummaryProvider } from '~/components/error-summary-context';
import { InlineLink } from '~/components/inline-link';
import { InputRadios } from '~/components/input-radios';
import type { InputRadiosProps } from '~/components/input-radios';
import { LoadingButton } from '~/components/loading-button';
import { useFetcherSubmissionState } from '~/hooks';
import { pageIds } from '~/page-ids';
import * as adobeAnalytics from '~/utils/adobe-analytics.client';
import { mergeMeta } from '~/utils/meta-utils';
import { getPathById } from '~/utils/route-utils';
import type { RouteHandleData } from '~/utils/route-utils';
import { getTitleMetaTags } from '~/utils/seo-utils';

function getRouteFromApplicationFlow(applicationFlow: ApplicationFlow) {
  switch (applicationFlow) {
    case 'full-children': {
      return `public/application/$id/${applicationFlow}/parent-or-guardian`;
    }
    case 'simplified-children': {
      return `public/application/$id/${applicationFlow}/parent-or-guardian`;
    }
    default: {
      return `public/application/$id/${applicationFlow}/contact-information`;
    }
  }
}

export const handle = {
  pageIdentifier: pageIds.public.application.spokes.communicationPreferences,
} as const satisfies RouteHandleData;

export const meta: Route.MetaFunction = mergeMeta(({ loaderData }) => getTitleMetaTags(loaderData.meta.title));

export async function loader({ context: { appContainer, session }, params, request }: Route.LoaderArgs) {
  const state = getPublicApplicationState({ params, session });
  validateApplicationFlow(state, params, ['full-adult', 'full-children', 'full-family', 'simplified-adult', 'simplified-family', 'simplified-children']);

  const t = await getFixedT(request, ['applicationSpokes', 'gcweb']);
  const locale = getLocale(request);

  const meta = {
    title: t(($) => $.meta.title.template, { ns: 'gcweb', title: t(($) => $.communicationPreferences.pageTitle) }),
  };

  const languages = appContainer.get(TYPES.LanguageService).listAndSortLocalizedLanguages(locale);
  const gcCommunicationMethods = appContainer.get(TYPES.GCCommunicationMethodService).listLocalizedGCCommunicationMethods(locale);
  const sunLifeCommunicationMethods = appContainer.get(TYPES.SunLifeCommunicationMethodService).listLocalizedSunLifeCommunicationMethods(locale);
  const { COMMUNICATION_METHOD_SUNLIFE_EMAIL_ID, COMMUNICATION_METHOD_GC_DIGITAL_ID, COMMUNICATION_METHOD_GC_MAIL_ID } = appContainer.get(TYPES.ServerConfig);

  return {
    defaultState: state.communicationPreferences?.value,
    applicationFlow: `${state.inputModel}-${state.typeOfApplication}` as const,
    languages,
    gcCommunicationMethods,
    sunLifeCommunicationMethods,
    COMMUNICATION_METHOD_SUNLIFE_EMAIL_ID,
    COMMUNICATION_METHOD_GC_DIGITAL_ID,
    COMMUNICATION_METHOD_GC_MAIL_ID,
    meta,
  };
}

export async function action({ context: { appContainer, session }, params, request }: Route.ActionArgs) {
  const state = getPublicApplicationState({ params, session });
  validateApplicationFlow(state, params, ['full-adult', 'full-children', 'full-family', 'simplified-adult', 'simplified-family', 'simplified-children']);

  const formData = await request.formData();

  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  securityHandler.validateCsrfToken({ formData, session });

  const t = await getFixedT(request, 'applicationSpokes');

  const applicationFlow: ApplicationFlow = `${state.inputModel}-${state.typeOfApplication}`;

  const { COMMUNICATION_METHOD_SUNLIFE_EMAIL_ID, COMMUNICATION_METHOD_GC_DIGITAL_ID } = appContainer.get(TYPES.ServerConfig);

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
    preferredNotificationMethod: z
      .string()
      .trim()
      .min(
        1,
        t(($) => $.communicationPreferences.errorMessage.preferredNotificationMethodRequired),
      ),
  }) satisfies z.ZodType<PublicApplicationCommunicationPreferencesState>;

  const parsedDataResult = communicationPreferencesSchema.safeParse({
    preferredLanguage: String(formData.get('preferredLanguage') ?? ''),
    preferredMethod: String(formData.get('preferredMethod') ?? ''),
    preferredNotificationMethod: String(formData.get('preferredNotificationMethod') ?? ''),
  });

  if (!parsedDataResult.success) {
    return data({ errors: transformFlattenedError(z.flattenError(parsedDataResult.error)) }, { status: 400 });
  }

  savePublicApplicationState({
    params,
    session,
    state: {
      communicationPreferences: {
        hasChanged: true,
        value: {
          preferredLanguage: parsedDataResult.data.preferredLanguage,
          preferredMethod: parsedDataResult.data.preferredMethod,
          preferredNotificationMethod: parsedDataResult.data.preferredNotificationMethod,
        },
      },
    },
  });

  if (parsedDataResult.data.preferredMethod === COMMUNICATION_METHOD_SUNLIFE_EMAIL_ID || parsedDataResult.data.preferredNotificationMethod === COMMUNICATION_METHOD_GC_DIGITAL_ID) {
    const redirectUrl = getPathById('public/application/$id/email', params);
    return { success: true, redirectUrl, revalidate: false };
  }

  const redirectUrl = getPathById(getRouteFromApplicationFlow(applicationFlow), params);
  return { success: true, redirectUrl, revalidate: false };
}

export default function ApplicationSpokeCommunicationPreferences({ loaderData, params }: Route.ComponentProps) {
  const { t } = useTranslation(['applicationSpokes', 'application']);
  const { defaultState, applicationFlow, gcCommunicationMethods, sunLifeCommunicationMethods, COMMUNICATION_METHOD_GC_MAIL_ID, COMMUNICATION_METHOD_SUNLIFE_EMAIL_ID, COMMUNICATION_METHOD_GC_DIGITAL_ID } = loaderData;

  const [preferredMethod, setPreferredMethod] = useState(defaultState?.preferredMethod ?? COMMUNICATION_METHOD_SUNLIFE_EMAIL_ID);
  const [preferredNotification, setPreferredNotification] = useState(defaultState?.preferredNotificationMethod ?? COMMUNICATION_METHOD_GC_DIGITAL_ID);

  const navigate = useNavigate();
  const fetcher = useFetcher<typeof action>();
  const { isSubmitting } = useFetcherSubmissionState(fetcher);

  const mscaLinkAccount = <InlineLink to={t(($) => $.communicationPreferences.mscaLinkAccount)} className="external-link" newTabIndicator target="_blank" />;

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
        const formName = 'ESDC-EDSC:CDCP Communication preferences in online application';
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
        getCheckedValue('preferredNotificationMethod', 'preferred-method-government-of-canada');

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
      children = <Trans ns="applicationSpokes" i18nKey={($) => $.communicationPreferences.byEmail} values={{ name: method.name }} components={{ span: <span className="font-semibold" /> }} />;
    }

    return {
      value: method.id,
      children,
      defaultChecked: defaultState ? defaultState.preferredMethod === method.id : method.id === COMMUNICATION_METHOD_SUNLIFE_EMAIL_ID,
      onChange: (e) => setPreferredMethod(e.target.value),
      'data-gc-analytics-value': method.code,
    };
  });

  const gcCommunicationMethodOptions: InputRadiosProps['options'] = gcCommunicationMethods.map((method) => {
    let children: ReactNode = <span className="font-semibold">{method.name}</span>;

    if (method.id === COMMUNICATION_METHOD_GC_DIGITAL_ID) {
      children = <Trans ns="applicationSpokes" i18nKey={($) => $.communicationPreferences.preferredNotificationMethodMsca} values={{ name: method.name }} components={{ span: <span className="font-semibold" />, mscaLinkAccount }} />;
    } else if (method.id === COMMUNICATION_METHOD_GC_MAIL_ID) {
      children = <Trans ns="applicationSpokes" i18nKey={($) => $.communicationPreferences.preferredNotificationMethodMail} values={{ name: method.name }} components={{ span: <span className="font-semibold" />, mscaLinkAccount }} />;
    }

    return {
      value: method.id,
      children,
      defaultChecked: defaultState ? defaultState.preferredNotificationMethod === method.id : method.id === COMMUNICATION_METHOD_GC_DIGITAL_ID,
      onChange: (e) => setPreferredNotification(e.target.value),
      'data-gc-analytics-value': method.code,
    };
  });

  return (
    <>
      <AppPageTitle>{t(($) => $.communicationPreferences.pageTitle)}</AppPageTitle>
      <ErrorSummaryProvider actionData={fetcher.data}>
        <div className="max-w-prose">
          <p className="mb-4 italic">{t(($) => $.requiredLabel, { ns: 'application' })}</p>
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
              <InputRadios
                id="preferred-method-gc"
                name="preferredNotificationMethod"
                legend={t(($) => $.communicationPreferences.preferredNotificationMethod)}
                options={gcCommunicationMethodOptions}
                required
                errorMessage={errors?.preferredNotificationMethod}
              />
            </div>
            <div className="flex flex-row-reverse flex-wrap items-center justify-end gap-3">
              <LoadingButton variant="primary" id="continue-button" loading={isSubmittingOrSuccess} data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Spoke:Continue - Communication preferences click">
                {preferredMethod === COMMUNICATION_METHOD_SUNLIFE_EMAIL_ID || preferredNotification === COMMUNICATION_METHOD_GC_DIGITAL_ID ? t(($) => $.communicationPreferences.continue) : t(($) => $.communicationPreferences.save)}
              </LoadingButton>
              <ButtonLink
                id="back-button"
                variant="secondary"
                routeId={getRouteFromApplicationFlow(applicationFlow)}
                params={params}
                disabled={isSubmittingOrSuccess}
                data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Spoke:Back - Communication preferences click"
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
