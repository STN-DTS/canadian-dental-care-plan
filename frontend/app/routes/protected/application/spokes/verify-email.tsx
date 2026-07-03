import { useState } from 'react';

import { data, redirect, useFetcher } from 'react-router';

import { invariant } from '@dts-stn/invariant';
import { Trans, useTranslation } from 'react-i18next';
import * as z from 'zod';

import type { Route } from './+types/verify-email';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import { getProtectedApplicationState, saveProtectedApplicationState, validateApplicationFlow } from '~/.server/routes/helpers/protected-application-route-helpers';
import type { ApplicationFlow } from '~/.server/routes/helpers/protected-application-route-helpers';
import { getFixedT } from '~/.server/utils/locale.utils';
import { transformFlattenedError } from '~/.server/utils/zod.utils';
import { AppPageTitle } from '~/components/app-page-title';
import { Button, ButtonLink } from '~/components/buttons';
import { Collapsible } from '~/components/collapsible';
import { CsrfTokenInput } from '~/components/csrf-token-input';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '~/components/dialog';
import { useErrorAlert } from '~/components/error-alert';
import { ErrorSummary } from '~/components/error-summary';
import { ErrorSummaryProvider } from '~/components/error-summary-context';
import { InputField } from '~/components/input-field';
import { LoadingButton } from '~/components/loading-button';
import { useFetcherSubmissionState } from '~/hooks';
import { pageIds } from '~/page-ids';
import { useCsrfToken } from '~/root';
import { mergeMeta } from '~/utils/meta-utils';
import { getPathById } from '~/utils/route-utils';
import type { RouteHandleData } from '~/utils/route-utils';
import { getTitleMetaTags } from '~/utils/seo-utils';
import { extractDigits } from '~/utils/string-utils';

const FORM_ACTION = {
  request: 'request',
  submit: 'submit',
} as const;

const MAX_ATTEMPTS = 5;

function getRouteFromApplicationFlow(applicationFlow: ApplicationFlow) {
  switch (applicationFlow) {
    case 'intake-children':
    case 'renewal-children': {
      return `protected/application/$id/${applicationFlow}/parent-or-guardian`;
    }
    default: {
      return `protected/application/$id/${applicationFlow}/contact-information`;
    }
  }
}

export const handle = {
  pageIdentifier: pageIds.protected.application.spokes.verifyEmail,
} as const satisfies RouteHandleData;

export const meta: Route.MetaFunction = mergeMeta(({ loaderData }) => getTitleMetaTags(loaderData.meta.title));

export async function loader({ context, params, url }: Route.LoaderArgs) {
  const { appContainer, session } = context.get(appContext);
  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  await securityHandler.validateAuthSession({ requestUrl: url, session });

  const state = getProtectedApplicationState({ params, session });
  validateApplicationFlow(state, params, ['intake-adult', 'intake-children', 'intake-family', 'renewal-adult', 'renewal-family', 'renewal-children']);

  invariant(state.email, 'Expected state.email to be defined');

  const t = await getFixedT(url, ['protectedApplicationSpokes', 'gcweb']);

  const meta = {
    title: t(($) => $.meta.title.template, { ns: 'gcweb', title: t(($) => $.verifyEmail.pageTitle) }),
  };
  return {
    defaultState: state.email,
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

  const { ENGLISH_LANGUAGE_CODE } = appContainer.get(TYPES.ServerConfig);

  const verificationCodeService = appContainer.get(TYPES.VerificationCodeService);

  const formAction = z.enum(FORM_ACTION).parse(formData.get('_action'));

  if (formAction === FORM_ACTION.request) {
    const verificationCode = verificationCodeService.createVerificationCode('anonymous');

    saveProtectedApplicationState({
      params,
      session,
      state: {
        verifyEmail: {
          verificationCode,
          verificationAttempts: 0,
        },
        emailVerified: false,
      },
    });

    if (state.email && state.communicationPreferences?.value?.preferredLanguage) {
      await verificationCodeService.sendVerificationCodeEmail({
        email: state.email,
        verificationCode,
        preferredLanguage: state.communicationPreferences.value.preferredLanguage === ENGLISH_LANGUAGE_CODE.toString() ? 'en' : 'fr',
        userId: 'anonymous',
      });
      return { status: 'verification-code-sent' } as const;
    }
  }
  if (formAction === FORM_ACTION.submit) {
    const verificationCodeSchema = z.object({
      verificationCode: z
        .string()
        .trim()
        .min(
          1,
          t(($) => $.verifyEmail.errorMessage.verificationCodeRequired),
        )
        .transform(extractDigits)

        .superRefine((val, ctx) => {
          if (state.verifyEmail && state.verifyEmail.verificationAttempts >= MAX_ATTEMPTS) {
            ctx.addIssue({
              code: 'custom',
              message: t(($) => $.verifyEmail.errorMessage.verificationCodeMaxAttempts),
              path: ['verificationCode'],
            });
          }
        }),
    });

    const parsedDataResult = verificationCodeSchema.safeParse({
      verificationCode: formData.get('verificationCode') ?? '',
    });

    if (!parsedDataResult.success) {
      return data({ errors: transformFlattenedError(z.flattenError(parsedDataResult.error)) }, { status: 400 });
    }

    // Check if the verification code matches
    if (state.verifyEmail && state.verifyEmail.verificationCode !== parsedDataResult.data.verificationCode) {
      const verificationAttempts = state.verifyEmail.verificationAttempts + 1;

      saveProtectedApplicationState({
        params,
        session,
        state: {
          verifyEmail: {
            ...state.verifyEmail,
            verificationAttempts,
          },
        },
      });

      return { status: 'verification-code-mismatch' } as const;
    }

    if (state.verifyEmail) {
      saveProtectedApplicationState({
        params,
        session,
        state: {
          verifyEmail: {
            ...state.verifyEmail,
            verificationAttempts: 0,
          },
          emailVerified: true,
        },
      });
    }

    return redirect(getPathById(getRouteFromApplicationFlow(applicationFlow), params));
  }
}

export default function ApplicationVerifyEmail({ loaderData, params }: Route.ComponentProps) {
  const { t } = useTranslation(['protectedApplicationSpokes', 'protectedApplication']);
  const { defaultState } = loaderData;
  const [showDialog, setShowDialog] = useState(false);
  const csrfToken = useCsrfToken();

  const fetcher = useFetcher<typeof action>();
  const { isSubmitting, submitAction } = useFetcherSubmissionState(fetcher);

  const fetcherStatus = typeof fetcher.data === 'object' && 'status' in fetcher.data ? fetcher.data : undefined;
  const errors = typeof fetcher.data === 'object' && 'errors' in fetcher.data ? fetcher.data.errors : undefined;
  const { ErrorAlert } = useErrorAlert(fetcherStatus?.status === 'verification-code-mismatch');

  // Adjust the state while rendering to ensure the dialog opens when the verification code is sent
  const [prevFetcherStatus, setPrevFetcherStatus] = useState(fetcherStatus);
  if (prevFetcherStatus !== fetcherStatus) {
    setPrevFetcherStatus(fetcherStatus);
    if (fetcherStatus?.status === 'verification-code-sent') {
      setShowDialog(true);
    }
  }

  function handleRequestNewCode() {
    const formData = new FormData();
    formData.append('_action', FORM_ACTION.request);
    formData.append('_csrf', csrfToken);

    void fetcher.submit(formData, { method: 'post' });
  }

  const requestLink = (
    <LoadingButton
      id="alert-request-button"
      type="button"
      name="_action"
      variant="link"
      className="mb-1 text-[17px]"
      disabled={isSubmitting}
      loading={isSubmitting && submitAction === FORM_ACTION.request}
      value={FORM_ACTION.request}
      onClick={handleRequestNewCode}
    />
  );

  return (
    <>
      <AppPageTitle>{t(($) => $.verifyEmail.pageTitle)}</AppPageTitle>
      <div className="max-w-prose">
        <ErrorAlert>
          <h2 className="mb-2 font-bold">{t(($) => $.verifyEmail.verificationCodeAlert.heading)}</h2>
          <p className="-mb-3">
            <Trans ns="protectedApplicationSpokes" i18nKey={($) => $.verifyEmail.verificationCodeAlert.detail} components={{ requestLink }} />
          </p>
        </ErrorAlert>
        <ErrorSummaryProvider actionData={fetcher.data}>
          <p className="mb-4">{t(($) => $.verifyEmail.verificationCode, { email: defaultState })}</p>
          <p className="mb-4">{t(($) => $.verifyEmail.requestNew)}</p>
          <Collapsible summary={t(($) => $.verifyEmail.cannotValidate.heading)}>
            <p>{t(($) => $.verifyEmail.cannotValidate.detail)}</p>
          </Collapsible>
          <p className="my-4 italic">{t(($) => $.requiredLabel, { ns: 'protectedApplication' })}</p>
          <ErrorSummary />
          <fetcher.Form method="post" noValidate>
            <CsrfTokenInput />
            <div className="mb-6">
              <div className="grid items-end gap-6 md:grid-cols-2">
                <InputField id="verification-code" name="verificationCode" className="w-full" errorMessage={errors?.verificationCode} label={t(($) => $.verifyEmail.verificationCodeLabel)} inputMode="numeric" required />
              </div>
              <LoadingButton
                id="request-button"
                type="button"
                name="_action"
                variant="link"
                className="no-underline hover:underline"
                disabled={isSubmitting}
                loading={isSubmitting && submitAction === FORM_ACTION.request}
                value={FORM_ACTION.request}
                data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Spoke:Request new verification code - Verify email click"
                onClick={async () => {
                  const formData = new FormData();
                  formData.append('_action', FORM_ACTION.request);
                  formData.append('_csrf', csrfToken);

                  await fetcher.submit(formData, { method: 'post' });
                }}
              >
                {t(($) => $.verifyEmail.requestNewCode)}
              </LoadingButton>
            </div>

            <div className="flex flex-row-reverse flex-wrap items-center justify-end gap-3">
              <LoadingButton
                variant="primary"
                id="continue-button"
                name="_action"
                value={FORM_ACTION.submit}
                disabled={isSubmitting}
                loading={isSubmitting && submitAction === FORM_ACTION.submit}
                data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Spoke:Continue - Verify email click"
              >
                {t(($) => $.verifyEmail.continue)}
              </LoadingButton>
              <ButtonLink
                id="back-button"
                variant="secondary"
                routeId="protected/application/$id/email"
                params={params}
                disabled={isSubmitting}
                data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Spoke:Back - Verify email click"
              >
                {t(($) => $.verifyEmail.back)}
              </ButtonLink>
            </div>
          </fetcher.Form>
        </ErrorSummaryProvider>
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t(($) => $.verifyEmail.codeSent.heading)}</DialogTitle>
            </DialogHeader>
            <DialogDescription>
              {t(($) => $.verifyEmail.codeSent.detail, {
                email: defaultState,
              })}
            </DialogDescription>
            <DialogFooter>
              <DialogClose asChild>
                <Button id="modal-continue" disabled={isSubmitting} variant="primary" size="sm" data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Spoke:Modal Continue - Verify email click">
                  {t(($) => $.verifyEmail.continue)}
                </Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
