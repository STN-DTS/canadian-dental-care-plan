import { useEffect, useState } from 'react';
import type { JSX, ReactNode } from 'react';

import { data, useFetcher, useNavigate } from 'react-router';

import { Trans, useTranslation } from 'react-i18next';
import type { PickDeep } from 'type-fest';
import * as z from 'zod';

import type { Route } from './+types/edit-communication-preferences';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import type { ClientApplicationDto } from '~/.server/domain/dtos';
import { getFixedT, getLocale } from '~/.server/utils/locale-utils';
import { transformFlattenedError } from '~/.server/utils/zod-utils';
import { AppPageTitle } from '~/components/app-page-title';
import { ProtectedBreadcrumbs } from '~/components/breadcrumbs';
import { ButtonLink } from '~/components/buttons';
import { CsrfTokenInput } from '~/components/csrf-token-input';
import { ErrorSummary } from '~/components/error-summary';
import { ErrorSummaryProvider } from '~/components/error-summary-context';
import { InputRadios } from '~/components/input-radios';
import type { InputRadiosProps } from '~/components/input-radios';
import { LoadingButton } from '~/components/loading-button';
import { useFetcherSubmissionState } from '~/hooks';
import { pageIds } from '~/page-ids';
import { useClientEnv } from '~/root';
import type { ProfileEmailContext } from '~/routes/protected/profile/email';
import * as adobeAnalytics from '~/utils/adobe-analytics.client';
import { mergeMeta } from '~/utils/meta-utils';
import type { RouteHandleData } from '~/utils/route-utils';
import { getPathById } from '~/utils/route-utils';
import { getTitleMetaTags } from '~/utils/seo-utils';

export const handle = {
  i18nPreloadNamespace: ['protectedProfile', 'gcweb'],
  layoutOptions: { breadcrumbs: <LayoutBreadcrumbs /> },
  pageIdentifier: pageIds.protected.profile.editCommunicationPreferences,
} as const satisfies RouteHandleData;

function LayoutBreadcrumbs(): JSX.Element {
  const { t } = useTranslation('protectedProfile');
  return (
    <ProtectedBreadcrumbs
      items={[
        {
          content: t(($) => $.communicationPreferences.pageTitle),
          routeId: 'protected/profile/communication-preferences',
        },
      ]}
    />
  );
}

export const meta: Route.MetaFunction = mergeMeta(({ loaderData }) => getTitleMetaTags(loaderData.meta.title));

function isClientApplicationEmailAddressVerified(clientApplication: PickDeep<ClientApplicationDto, 'contactInformation.email' | 'contactInformation.emailVerified'>): boolean {
  const hasEmailAddress = clientApplication.contactInformation.email !== undefined;
  const emailAddressVerified = clientApplication.contactInformation.emailVerified === true;
  return hasEmailAddress && emailAddressVerified;
}

export async function loader({ context, params, url }: Route.LoaderArgs) {
  const { appContainer, session } = context.get(appContext);
  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  await securityHandler.validateAuthSession({ requestUrl: url, session });
  const clientApplication = await securityHandler.requireClientApplication({ params, requestUrl: url, session });
  const { COMMUNICATION_METHOD_SUNLIFE_EMAIL_ID, COMMUNICATION_METHOD_GC_DIGITAL_ID } = appContainer.get(TYPES.ServerConfig);

  const t = await getFixedT(url, ['protectedProfile', 'gcweb']);
  const locale = getLocale(url);

  const meta = {
    title: t(($) => $.meta.title.mscaTemplate, { ns: 'gcweb', title: t(($) => $.editCommunicationPreferences.pageTitle) }),
  };

  const languages = appContainer.get(TYPES.LanguageService).listAndSortLocalizedLanguages(locale);
  const gcCommunicationMethods = appContainer.get(TYPES.GCCommunicationMethodService).listLocalizedGCCommunicationMethods(locale);
  const sunLifeCommunicationMethods = appContainer.get(TYPES.SunLifeCommunicationMethodService).listLocalizedSunLifeCommunicationMethods(locale);

  const idToken = session.get('idToken');
  appContainer.get(TYPES.AuditService).createAudit('page-view.profile.edit-communication-preferences', { userId: idToken.sub });

  return {
    meta,
    defaultState: {
      preferredLanguage: clientApplication.communicationPreferences.preferredLanguage,
      preferredMethodSunLife: COMMUNICATION_METHOD_SUNLIFE_EMAIL_ID,
      preferredMethodGovernmentOfCanada: COMMUNICATION_METHOD_GC_DIGITAL_ID,
    },
    languages,
    gcCommunicationMethods,
    sunLifeCommunicationMethods,
    isClientApplicationEmailAddressVerified: isClientApplicationEmailAddressVerified(clientApplication),
  };
}

export async function action({ context, params, request, url }: Route.ActionArgs) {
  const { appContainer, session } = context.get(appContext);
  const formData = await request.formData();

  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  await securityHandler.validateAuthSession({ requestUrl: url, session });
  securityHandler.validateCsrfToken({ formData, session });
  const clientApplication = await securityHandler.requireClientApplication({ params, requestUrl: url, session });
  const { COMMUNICATION_METHOD_SUNLIFE_EMAIL_ID, COMMUNICATION_METHOD_GC_DIGITAL_ID } = appContainer.get(TYPES.ServerConfig);

  const t = await getFixedT(url, 'protectedProfile');

  const formSchema = z.object({
    preferredLanguage: z
      .string()
      .trim()
      .min(
        1,
        t(($) => $.editCommunicationPreferences.errorMessage.preferredLanguageRequired),
      ),
    preferredMethodSunLife: z
      .string()
      .trim()
      .min(
        1,
        t(($) => $.editCommunicationPreferences.errorMessage.preferredMethodSunlifeRequired),
      ),
    preferredMethodGovernmentOfCanada: z
      .string()
      .trim()
      .min(
        1,
        t(($) => $.editCommunicationPreferences.errorMessage.preferredMethodGcRequired),
      ),
  });

  const parsedDataResult = formSchema.safeParse({
    preferredLanguage: String(formData.get('preferredLanguage') ?? ''),
    preferredMethodSunLife: String(formData.get('preferredMethodSunLife') ?? ''),
    preferredMethodGovernmentOfCanada: String(formData.get('preferredMethodGovernmentOfCanada') ?? ''),
  });

  if (!parsedDataResult.success) {
    return data({ errors: transformFlattenedError(z.flattenError(parsedDataResult.error)) }, { status: 400 });
  }

  // Redirect to edit email address if digital communication method is selected without a verified email address
  const isDigitalCommunicationMethodSelected = parsedDataResult.data.preferredMethodSunLife === COMMUNICATION_METHOD_SUNLIFE_EMAIL_ID || parsedDataResult.data.preferredMethodGovernmentOfCanada === COMMUNICATION_METHOD_GC_DIGITAL_ID;
  if (isDigitalCommunicationMethodSelected && !isClientApplicationEmailAddressVerified(clientApplication)) {
    const profileEmailContext: ProfileEmailContext = {
      context: 'communication-preferences',
      pref_lang: parsedDataResult.data.preferredLanguage,
      pref_method_sl: parsedDataResult.data.preferredMethodSunLife,
      pref_method_goc: parsedDataResult.data.preferredMethodGovernmentOfCanada,
    };

    const redirectUrl = getPathById('protected/profile/contact/email-address', params) + `?${new URLSearchParams(profileEmailContext)}`;
    return { success: true, redirectUrl, revalidate: false };
  }

  // Update communication preferences
  const idToken = session.get('idToken');

  await appContainer.get(TYPES.ProfileService).updateCommunicationPreferences(
    {
      clientId: clientApplication.applicantInformation.clientId,
      preferredLanguage: parsedDataResult.data.preferredLanguage,
      preferredMethodSunLife: parsedDataResult.data.preferredMethodSunLife,
      preferredMethodGovernmentOfCanada: parsedDataResult.data.preferredMethodGovernmentOfCanada,
    },
    idToken.sub,
  );

  appContainer.get(TYPES.AuditService).createAudit('update-data.profile.edit-communication-preferences', { userId: idToken.sub });

  const redirectUrl = getPathById('protected/profile/communication-preferences', params);
  return { success: true, redirectUrl, revalidate: false };
}

export default function EditCommunicationPreferences({ loaderData, params }: Route.ComponentProps) {
  const { t } = useTranslation('protectedProfile');
  const { defaultState, languages, sunLifeCommunicationMethods, gcCommunicationMethods, isClientApplicationEmailAddressVerified } = loaderData;
  const { COMMUNICATION_METHOD_GC_DIGITAL_ID, COMMUNICATION_METHOD_GC_MAIL_ID, COMMUNICATION_METHOD_SUNLIFE_EMAIL_ID } = useClientEnv();

  const [selectedPreferredMethodSunLife, setSelectedPreferredMethodSunLife] = useState(defaultState.preferredMethodSunLife);
  const [selectedPreferredMethodGovernmentOfCanada, setSelectedPreferredMethodGovernmentOfCanada] = useState(defaultState.preferredMethodGovernmentOfCanada);

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
        const formName = 'ESDC-EDSC:CDCP Communication preferences in MSCA profile';
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
        getCheckedValue('preferredMethodSunLife', 'preferred-method-sunlife');
        getCheckedValue('preferredMethodGovernmentOfCanada', 'preferred-method-government-of-canada');

        adobeAnalytics.pushFormSubmitEvent(formName, formValues);
      }

      void navigate(redirectUrl);
    }
  }, [isSubmitting, navigate, redirectUrl, success]);

  const preferredLanguageOptions: InputRadiosProps['options'] = languages.map((language) => ({
    value: language.id,
    children: language.name,
    defaultChecked: defaultState.preferredLanguage === language.id,
    'data-gc-analytics-value': language.code,
  }));

  const sunLifeCommunicationMethodOptions: InputRadiosProps['options'] = sunLifeCommunicationMethods.map((method) => ({
    value: method.id,
    children: <span className="font-semibold">{method.name}</span>,
    defaultChecked: selectedPreferredMethodSunLife === method.id,
    onChange: (e) => setSelectedPreferredMethodSunLife(e.target.value),
    'data-gc-analytics-value': method.code,
  }));

  const gcCommunicationMethodOptions: InputRadiosProps['options'] = gcCommunicationMethods.map((method) => {
    let children: ReactNode = <span className="font-semibold">{method.name}</span>;

    if (method.id === COMMUNICATION_METHOD_GC_DIGITAL_ID) {
      children = <Trans ns="protectedProfile" i18nKey={($) => $.editCommunicationPreferences.preferredMethodGcDigital} values={{ name: method.name }} components={{ span: <span className="font-semibold" /> }} />;
    } else if (method.id === COMMUNICATION_METHOD_GC_MAIL_ID) {
      children = <Trans ns="protectedProfile" i18nKey={($) => $.editCommunicationPreferences.preferredMethodGcMail} values={{ name: method.name }} components={{ span: <span className="font-semibold" /> }} />;
    }

    return {
      value: method.id,
      children,
      defaultChecked: selectedPreferredMethodGovernmentOfCanada === method.id,
      onChange: (e) => setSelectedPreferredMethodGovernmentOfCanada(e.target.value),
      'data-gc-analytics-value': method.code,
    };
  });

  const isDigitalCommunicationMethodSelected = selectedPreferredMethodSunLife === COMMUNICATION_METHOD_SUNLIFE_EMAIL_ID || selectedPreferredMethodGovernmentOfCanada === COMMUNICATION_METHOD_GC_DIGITAL_ID;
  const submitButtonText = isDigitalCommunicationMethodSelected && !isClientApplicationEmailAddressVerified ? t(($) => $.editCommunicationPreferences.continue) : t(($) => $.editCommunicationPreferences.save);

  return (
    <>
      <AppPageTitle>{t(($) => $.editCommunicationPreferences.pageTitle)}</AppPageTitle>
      <div className="max-w-prose">
        <p className="mb-4 italic">{t(($) => $.requiredLabel)}</p>
        <ErrorSummaryProvider actionData={fetcher.data}>
          <ErrorSummary />
          <fetcher.Form method="post" noValidate>
            <CsrfTokenInput />
            <div className="mb-8 space-y-6">
              <InputRadios id="preferred-language" name="preferredLanguage" legend={t(($) => $.editCommunicationPreferences.preferredLanguage)} options={preferredLanguageOptions} errorMessage={errors?.preferredLanguage} required />
              <InputRadios
                id="preferred-method-sunlife"
                legend={t(($) => $.editCommunicationPreferences.preferredMethodSunlife)}
                name="preferredMethodSunLife"
                options={sunLifeCommunicationMethodOptions}
                errorMessage={errors?.preferredMethodSunLife}
                required
              />
              <InputRadios
                id="preferred-method-gc"
                name="preferredMethodGovernmentOfCanada"
                legend={t(($) => $.editCommunicationPreferences.preferredMethodGc)}
                options={gcCommunicationMethodOptions}
                required
                errorMessage={errors?.preferredMethodGovernmentOfCanada}
              />
            </div>
            <div className="flex flex-row-reverse flex-wrap items-center justify-end gap-3">
              <LoadingButton variant="primary" id="save-button" loading={isSubmittingOrSuccess} data-gc-analytics-customclick="ESDC-EDSC:CDCP Applicant Profile-Protected:Save - Communication preferences click">
                {submitButtonText}
              </LoadingButton>
              <ButtonLink
                variant="secondary"
                id="back-button"
                routeId="protected/profile/communication-preferences"
                params={params}
                disabled={isSubmittingOrSuccess}
                data-gc-analytics-customclick="ESDC-EDSC:CDCP Applicant Profile-Protected:Back - Communication preferences click"
              >
                {t(($) => $.editCommunicationPreferences.back)}
              </ButtonLink>
            </div>
          </fetcher.Form>
        </ErrorSummaryProvider>
      </div>
    </>
  );
}
