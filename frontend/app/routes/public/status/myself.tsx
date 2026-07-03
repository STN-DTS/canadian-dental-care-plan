import { data, redirect, useFetcher } from 'react-router';

import { faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons';
import HCaptcha from '@hcaptcha/react-hcaptcha';
import { randomUUID } from 'node:crypto';
import { useTranslation } from 'react-i18next';
import * as z from 'zod';

import type { Route } from './+types/myself';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import { getStatusResultUrl, saveStatusState, startStatusState } from '~/.server/routes/helpers/status-route-helpers';
import { getFixedT } from '~/.server/utils/locale.utils';
import { transformFlattenedError } from '~/.server/utils/zod.utils';
import { AppPageTitle } from '~/components/app-page-title';
import { ButtonLink } from '~/components/buttons';
import { CsrfTokenInput } from '~/components/csrf-token-input';
import { ErrorSummary } from '~/components/error-summary';
import { ErrorSummaryProvider } from '~/components/error-summary-context';
import { InputPatternField } from '~/components/input-pattern-field';
import { LoadingButton } from '~/components/loading-button';
import { useFetcherSubmissionState, useHCaptcha } from '~/hooks';
import { pageIds } from '~/page-ids';
import { useFeature } from '~/root';
import { applicationCodeInputPatternFormat, isValidCodeOrNumber } from '~/utils/application-code-utils';
import { mergeMeta } from '~/utils/meta-utils';
import type { RouteHandleData } from '~/utils/route-utils';
import { getPathById } from '~/utils/route-utils';
import { getTitleMetaTags } from '~/utils/seo-utils';
import { formatSin, isValidSin, sinInputPatternFormat } from '~/utils/sin-utils';
import { extractDigits } from '~/utils/string-utils';

export const handle = {
  pageIdentifier: pageIds.public.status.myself,
} as const satisfies RouteHandleData;

export const meta: Route.MetaFunction = mergeMeta(({ loaderData }) => getTitleMetaTags(loaderData.meta.title));

export async function loader({ context, params, url }: Route.LoaderArgs) {
  const { appContainer } = context.get(appContext);
  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  securityHandler.validateFeatureEnabled('status');
  const t = await getFixedT(url, ['status', 'gcweb']);
  const meta = {
    title: t(($) => $.meta.title.template, { ns: 'gcweb', title: t(($) => $.myself.pageTitle) }),
  };
  return { meta };
}

export async function action({ context, params, request, url }: Route.ActionArgs) {
  const { appContainer, session } = context.get(appContext);
  const formData = await request.formData();

  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  securityHandler.validateFeatureEnabled('status');
  securityHandler.validateCsrfToken({ formData, session });
  await securityHandler.validateHCaptchaResponse({ formData, request }, () => {
    throw redirect(getPathById('public/unable-to-process-request', params));
  });

  const t = await getFixedT(url, 'status');

  const formDataSchema = z.object({
    sin: z
      .string({
        error: (issue) => (issue.input === undefined ? t(($) => $.myself.form.errorMessage.sinRequired) : undefined),
      })
      .trim()
      .min(1)
      .refine(
        isValidSin,
        t(($) => $.myself.form.errorMessage.sinValid),
      )
      .transform((sin) => formatSin(sin, '')),
    code: z
      .string({
        error: (issue) => (issue.input === undefined ? t(($) => $.myself.form.errorMessage.applicationCodeRequired) : undefined),
      })
      .trim()
      .min(1)
      .refine(
        isValidCodeOrNumber,
        t(($) => $.myself.form.errorMessage.applicationCodeValid),
      )
      .transform((code) => extractDigits(code)),
  });

  const parsedDataResult = formDataSchema.safeParse({
    sin: formData.get('sin') ? String(formData.get('sin')) : undefined,
    code: formData.get('code') ? String(formData.get('code')) : undefined,
  });

  if (!parsedDataResult.success) {
    return data({ errors: transformFlattenedError(z.flattenError(parsedDataResult.error)) }, { status: 400 });
  }

  const { sin, code } = parsedDataResult.data;
  const applicationStatusService = appContainer.get(TYPES.ApplicationStatusService);
  const statusId = await applicationStatusService.findApplicationStatusIdBySin({
    sin,
    applicationCode: code,
    userId: 'anonymous',
  });

  const id = randomUUID().toString();
  startStatusState({ id, session });
  saveStatusState({
    id,
    params,
    session,
    state: {
      statusCheckResult: {
        statusId: statusId.unwrapUnchecked(),
      },
    },
  });

  return redirect(getStatusResultUrl({ id, params }));
}

export default function StatusCheckerMyself({ loaderData, params }: Route.ComponentProps) {
  const { t } = useTranslation('status');
  const hCaptchaEnabled = useFeature('hcaptcha');
  const { captchaRef, onLoad, sitekey } = useHCaptcha();

  const fetcher = useFetcher<typeof action>();
  const { isSubmitting } = useFetcherSubmissionState(fetcher);
  const errors = fetcher.data && 'errors' in fetcher.data ? fetcher.data.errors : undefined;

  async function handleSubmit(event: React.SyntheticEvent<HTMLFormElement, SubmitEvent>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    if (hCaptchaEnabled && captchaRef.current) {
      try {
        const response = captchaRef.current.getResponse();
        formData.set('h-captcha-response', response);
      } catch {
        /* intentionally ignore and proceed with submission */
      } finally {
        captchaRef.current.resetCaptcha();
      }
    }

    await fetcher.submit(formData, { method: 'POST' });
  }

  return (
    <>
      <AppPageTitle>{t(($) => $.myself.pageTitle)}</AppPageTitle>
      <div className="max-w-prose">
        <p className="mb-4 italic">{t(($) => $.myself.form.completeFields)}</p>
        <ErrorSummaryProvider actionData={fetcher.data}>
          <ErrorSummary />
          <fetcher.Form method="post" onSubmit={handleSubmit} noValidate autoComplete="off" data-gc-analytics-formname="ESDC-EDSC: Canadian Dental Care Plan Status Checker">
            <CsrfTokenInput />
            {hCaptchaEnabled && <HCaptcha size="invisible" sitekey={sitekey} ref={captchaRef} onLoad={onLoad} />}
            <div className="mb-8 space-y-6">
              <InputPatternField
                id="code"
                name="code"
                format={applicationCodeInputPatternFormat}
                label={t(($) => $.myself.form.applicationCodeLabel)}
                inputMode="numeric"
                helpMessagePrimary={t(($) => $.myself.form.applicationCodeDescription)}
                required
                errorMessage={errors?.code}
                defaultValue=""
              />
              <InputPatternField id="sin" name="sin" format={sinInputPatternFormat} label={t(($) => $.myself.form.sinLabel)} helpMessagePrimary={t(($) => $.myself.form.sinDescription)} required errorMessage={errors?.sin} defaultValue="" />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <ButtonLink id="back-button" variant="secondary" routeId="public/status/index" params={params} startIcon={faChevronLeft} disabled={isSubmitting}>
                {t(($) => $.myself.form.backBtn)}
              </ButtonLink>
              <LoadingButton variant="primary" id="submit" loading={isSubmitting} data-gc-analytics-formsubmit="submit" endIcon={faChevronRight}>
                {t(($) => $.myself.form.submit)}
              </LoadingButton>
            </div>
          </fetcher.Form>
        </ErrorSummaryProvider>
      </div>
    </>
  );
}
