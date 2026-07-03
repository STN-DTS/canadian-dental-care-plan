import type { JSX } from 'react';

import { data, redirect, useFetcher } from 'react-router';

import { useTranslation } from 'react-i18next';
import * as z from 'zod';

import type { Route } from './+types/phone-number';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import { getFixedT } from '~/.server/utils/locale.utils';
import { transformFlattenedError } from '~/.server/utils/zod.utils';
import { phoneSchema } from '~/.server/validation/phone-schema';
import { AppPageTitle } from '~/components/app-page-title';
import { ProtectedBreadcrumbs } from '~/components/breadcrumbs';
import { ButtonLink } from '~/components/buttons';
import { CsrfTokenInput } from '~/components/csrf-token-input';
import { ErrorSummary } from '~/components/error-summary';
import { ErrorSummaryProvider } from '~/components/error-summary-context';
import { InputPhoneField } from '~/components/input-phone-field';
import { LoadingButton } from '~/components/loading-button';
import { useFetcherSubmissionState } from '~/hooks';
import { pageIds } from '~/page-ids';
import { mergeMeta } from '~/utils/meta-utils';
import type { RouteHandleData } from '~/utils/route-utils';
import { getPathById } from '~/utils/route-utils';
import { getTitleMetaTags } from '~/utils/seo-utils';

export const handle = {
  i18nPreloadNamespace: ['protectedProfile', 'gcweb'],
  layoutOptions: { breadcrumbs: <LayoutBreadcrumbs /> },
  pageIdentifier: pageIds.protected.profile.phoneNumber,
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

export async function loader({ context, params, request }: Route.LoaderArgs) {
  const { appContainer, session } = context.get(appContext);
  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  await securityHandler.validateAuthSession({ request, session });
  const clientApplication = await securityHandler.requireClientApplication({ params, request, session });

  const t = await getFixedT(request, ['protectedProfile', 'gcweb']);
  const meta = {
    title: t(($) => $.meta.title.mscaTemplate, { ns: 'gcweb', title: t(($) => $.phoneNumber.pageTitle) }),
  };

  const idToken = session.get('idToken');
  appContainer.get(TYPES.AuditService).createAudit('page-view.profile.phone-number', { userId: idToken.sub });

  return {
    meta,
    defaultState: {
      phoneNumber: clientApplication.contactInformation.phoneNumber,
      phoneNumberAlt: clientApplication.contactInformation.phoneNumberAlt,
    },
  };
}

export async function action({ context, params, request }: Route.ActionArgs) {
  const { appContainer, session } = context.get(appContext);
  const formData = await request.formData();

  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  await securityHandler.validateAuthSession({ request, session });
  securityHandler.validateCsrfToken({ formData, session });
  const clientApplication = await securityHandler.requireClientApplication({ params, request, session });

  const t = await getFixedT(request, 'protectedProfile');

  const phoneNumberSchema = z.object({
    phoneNumber: phoneSchema({
      invalid_phone_canadian_error: t(($) => $.phoneNumber.errorMessage.phoneNumberValid),
      invalid_phone_international_error: t(($) => $.phoneNumber.errorMessage.phoneNumberValidInternational),
    }).optional(),
    phoneNumberAlt: phoneSchema({
      invalid_phone_canadian_error: t(($) => $.phoneNumber.errorMessage.phoneNumberAltValid),
      invalid_phone_international_error: t(($) => $.phoneNumber.errorMessage.phoneNumberAltValidInternational),
    }).optional(),
  });

  const parsedDataResult = phoneNumberSchema.safeParse({
    phoneNumber: formData.get('phoneNumber') ? String(formData.get('phoneNumber')) : undefined,
    phoneNumberAlt: formData.get('phoneNumberAlt') ? String(formData.get('phoneNumberAlt')) : undefined,
  });

  if (!parsedDataResult.success) {
    return data({ errors: transformFlattenedError(z.flattenError(parsedDataResult.error)) }, { status: 400 });
  }
  const idToken = session.get('idToken');

  await appContainer.get(TYPES.ProfileService).updatePhoneNumbers(
    {
      clientId: clientApplication.applicantInformation.clientId,
      phoneNumber: parsedDataResult.data.phoneNumber,
      phoneNumberAlt: parsedDataResult.data.phoneNumberAlt,
    },
    idToken.sub,
  );

  appContainer.get(TYPES.AuditService).createAudit('update-data.profile.phone-number', { userId: idToken.sub });

  return redirect(getPathById('protected/profile/contact-information', params));
}

export default function PhoneNumber({ loaderData, params }: Route.ComponentProps) {
  const { t } = useTranslation('protectedProfile');
  const { defaultState } = loaderData;
  const fetcher = useFetcher<typeof action>();
  const { isSubmitting } = useFetcherSubmissionState(fetcher);
  const errors = fetcher.data?.errors;

  return (
    <>
      <AppPageTitle>{t(($) => $.phoneNumber.pageTitle)}</AppPageTitle>
      <div className="max-w-prose">
        <ErrorSummaryProvider actionData={fetcher.data}>
          <ErrorSummary />
          <fetcher.Form method="post" noValidate>
            <CsrfTokenInput />
            <div className="mb-6">
              <p className="mb-4">{t(($) => $.phoneNumber.addPhoneNumber)}</p>
              <p className="mb-4 italic">{t(($) => $.allOptionalLabel)}</p>
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
            <div className="mt-8 flex flex-row-reverse flex-wrap items-center justify-end gap-3">
              <LoadingButton variant="primary" id="save-button" loading={isSubmitting} data-gc-analytics-customclick="ESDC-EDSC:CDCP Applicant Profile-Protected:Save - Phone number click">
                {t(($) => $.phoneNumber.saveBtn)}
              </LoadingButton>
              <ButtonLink variant="secondary" id="back-button" routeId="protected/profile/contact-information" params={params} disabled={isSubmitting} data-gc-analytics-customclick="ESDC-EDSC:CDCP Applicant Profile-Protected:Back - Phone number click">
                {t(($) => $.phoneNumber.backBtn)}
              </ButtonLink>
            </div>
          </fetcher.Form>
        </ErrorSummaryProvider>
      </div>
    </>
  );
}
