import type { JSX } from 'react';

import { data, redirect, useFetcher } from 'react-router';

import { useTranslation } from 'react-i18next';
import validator from 'validator';
import * as z from 'zod';

import type { Route } from './+types/email';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import { getFixedT } from '~/.server/utils/locale-utils';
import { transformFlattenedError } from '~/.server/utils/zod-utils';
import { AppPageTitle } from '~/components/app-page-title';
import { ProtectedBreadcrumbs } from '~/components/breadcrumbs';
import { ButtonLink } from '~/components/buttons';
import { CsrfTokenInput } from '~/components/csrf-token-input';
import { ErrorSummary } from '~/components/error-summary';
import { ErrorSummaryProvider } from '~/components/error-summary-context';
import { InputField } from '~/components/input-field';
import { LoadingButton } from '~/components/loading-button';
import { useFetcherSubmissionState } from '~/hooks';
import { pageIds } from '~/page-ids';
import { mergeMeta } from '~/utils/meta-utils';
import type { RouteHandleData } from '~/utils/route-utils';
import { getPathById } from '~/utils/route-utils';
import { getTitleMetaTags } from '~/utils/seo-utils';

// prettier-ignore
const profileEmailContextSchema = z
  .object({
    context: z.literal('contact').optional(),
    // eslint-disable-next-line unicorn/no-useless-undefined
    pref_lang: z.any().transform(() => undefined).optional(),
    // eslint-disable-next-line unicorn/no-useless-undefined
    pref_method_sl: z.any().transform(() => undefined).optional(),
    // eslint-disable-next-line unicorn/no-useless-undefined
    pref_method_goc: z.any().transform(() => undefined).optional(),
  })
  .or(
    z.object({
      context: z.literal('communication-preferences'),
      pref_lang: z.string(),
      pref_method_sl: z.string(),
      pref_method_goc: z.string(),
    }),
  );

export type ProfileEmailContext = z.infer<typeof profileEmailContextSchema>;

function requireProfileEmailContext({ url, params }: Pick<Route.LoaderArgs | Route.ActionArgs, 'url' | 'params'>): ProfileEmailContext {
  const searchParams = Object.fromEntries(url.searchParams);
  const parsed = profileEmailContextSchema.safeParse(searchParams);

  if (!parsed.success) {
    throw redirect(getPathById('protected/profile/contact/email-address', params));
  }

  return parsed.data;
}

export const handle = {
  i18nPreloadNamespace: ['protectedProfile', 'gcweb'],
  layoutOptions: { breadcrumbs: <LayoutBreadcrumbs /> },
  pageIdentifier: pageIds.protected.profile.email,
} as const satisfies RouteHandleData;

function LayoutBreadcrumbs(): JSX.Element {
  const { t } = useTranslation('protectedProfile');
  return (
    <ProtectedBreadcrumbs
      items={[
        {
          content: t(($) => $.contactInformation.pageTitle),
          routeId: 'protected/profile/contact-information',
        },
      ]}
    />
  );
}

export const meta: Route.MetaFunction = mergeMeta(({ loaderData }) => getTitleMetaTags(loaderData.meta.title));

export async function loader({ context, params, request, url }: Route.LoaderArgs) {
  const { appContainer, session } = context.get(appContext);
  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  await securityHandler.validateAuthSession({ requestUrl: url, session });
  const clientApplication = await securityHandler.requireClientApplication({ params, requestUrl: url, session });
  const profileEmailContext = requireProfileEmailContext({ url, params });

  const t = await getFixedT(url, ['protectedProfile', 'gcweb']);
  const meta = {
    title: t(($) => $.meta.title.mscaTemplate, { ns: 'gcweb', title: t(($) => $.email.pageTitle) }),
  };

  const idToken = session.get('idToken');
  appContainer.get(TYPES.AuditService).createAudit('page-view.profile.email-address', { userId: idToken.sub });

  return {
    meta,
    defaultState: clientApplication.contactInformation.email,
    context: profileEmailContext.context,
  };
}

export async function action({ context, params, request, url }: Route.ActionArgs) {
  const { appContainer, session } = context.get(appContext);
  const formData = await request.formData();

  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  await securityHandler.validateAuthSession({ requestUrl: url, session });
  securityHandler.validateCsrfToken({ formData, session });
  const clientApplication = await securityHandler.requireClientApplication({ params, requestUrl: url, session });
  const profileEmailContext = requireProfileEmailContext({ url, params });

  const t = await getFixedT(url, 'protectedProfile');
  const { ENGLISH_LANGUAGE_CODE } = appContainer.get(TYPES.ServerConfig);
  const idToken = session.get('idToken');

  const emailSchema = z.object({
    email: z
      .string(t(($) => $.email.errorMessage.emailRequired))
      .trim()
      .toLowerCase()
      .min(1)
      .max(64)
      .refine(
        (val) => validator.isEmail(val),
        t(($) => $.email.errorMessage.emailValid),
      ),
  });

  const parsedDataResult = emailSchema.safeParse({
    email: formData.get('email') ? String(formData.get('email') ?? '') : undefined,
  });

  if (!parsedDataResult.success) {
    return data({ errors: transformFlattenedError(z.flattenError(parsedDataResult.error)) }, { status: 400 });
  }

  appContainer.get(TYPES.AuditService).createAudit('update-data.profile.email-address', { userId: idToken.sub });

  const isNewEmail =
    clientApplication.contactInformation.email !== parsedDataResult.data.email ||
    clientApplication.contactInformation.email.localeCompare(parsedDataResult.data.email, undefined, { sensitivity: 'accent' }) !== 0 ||
    clientApplication.contactInformation.emailVerified === false;

  if (isNewEmail) {
    const verificationCodeService = appContainer.get(TYPES.VerificationCodeService);
    const verificationCode = verificationCodeService.createVerificationCode(idToken.sub);

    session.set(
      'profileEmailAddressFlowState',
      profileEmailContext.context === 'communication-preferences'
        ? {
            context: profileEmailContext.context,
            preferredLanguage: profileEmailContext.pref_lang,
            preferredMethodSunLife: profileEmailContext.pref_method_sl,
            preferredMethodGovernmentOfCanada: profileEmailContext.pref_method_goc,
            emailAddress: parsedDataResult.data.email,
            verificationCode,
            verificationAttempts: 0,
          }
        : {
            context: profileEmailContext.context,
            emailAddress: parsedDataResult.data.email,
            verificationCode,
            verificationAttempts: 0,
          },
    );

    await verificationCodeService.sendVerificationCodeEmail({
      email: parsedDataResult.data.email,
      verificationCode,
      preferredLanguage: clientApplication.communicationPreferences.preferredLanguage === ENGLISH_LANGUAGE_CODE.toString() ? 'en' : 'fr',
      userId: idToken.sub,
    });

    return redirect(getPathById('protected/profile/contact/email-address/verify', params));
  }

  if (profileEmailContext.context === 'communication-preferences') {
    return redirect(getPathById('protected/profile/communication-preferences', params));
  }

  return redirect(getPathById('protected/profile/contact-information', params));
}

export default function ProtectedProfileEmailAddress({ loaderData, params }: Route.ComponentProps) {
  const { t } = useTranslation('protectedProfile');
  const { defaultState, context } = loaderData;

  const fetcher = useFetcher<typeof action>();
  const { isSubmitting } = useFetcherSubmissionState(fetcher);
  const errors = fetcher.data?.errors;

  const backButtonRouteId = context === 'communication-preferences' ? 'protected/profile/communication-preferences/edit' : 'protected/profile/contact-information';

  return (
    <>
      <AppPageTitle>{t(($) => $.email.pageTitle)}</AppPageTitle>
      <div className="max-w-prose">
        <ErrorSummaryProvider actionData={fetcher.data}>
          <ErrorSummary />
          <fetcher.Form method="post" noValidate>
            <CsrfTokenInput />
            <p className="mb-4">{t(($) => $.email.provideEmail)}</p>
            <p className="mb-8">{t(($) => $.email.verifyEmail)}</p>
            <p className="mb-4 italic">{t(($) => $.requiredLabel)}</p>
            <div className="mb-6">
              <InputField id="email" name="email" type="email" inputMode="email" className="w-full" autoComplete="email" defaultValue={defaultState} errorMessage={errors?.email} label={t(($) => $.email.emailLegend)} maxLength={64} required />
            </div>

            <div className="flex flex-row-reverse flex-wrap items-center justify-end gap-3">
              <LoadingButton variant="primary" id="save-button" loading={isSubmitting} data-gc-analytics-customclick="ESDC-EDSC:CDCP Applicant Profile-Protected:Save - Email address click">
                {t(($) => $.email.continueBtn)}
              </LoadingButton>
              <ButtonLink variant="secondary" id="back-button" routeId={backButtonRouteId} params={params} disabled={isSubmitting} data-gc-analytics-customclick="ESDC-EDSC:CDCP Applicant Profile-Protected:Back - Email address click">
                {t(($) => $.email.back)}
              </ButtonLink>
            </div>
          </fetcher.Form>
        </ErrorSummaryProvider>
      </div>
    </>
  );
}
