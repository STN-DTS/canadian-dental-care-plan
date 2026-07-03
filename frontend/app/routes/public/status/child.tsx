import { useState } from 'react';

import { redirect, useFetcher } from 'react-router';

import { faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons';
import HCaptcha from '@hcaptcha/react-hcaptcha';
import { randomUUID } from 'node:crypto';
import type { Option } from 'oxide.ts';
import { Trans, useTranslation } from 'react-i18next';
import * as z from 'zod';

import type { Route } from './+types/child';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import { getStatusResultUrl, saveStatusState, startStatusState } from '~/.server/routes/helpers/status-route-helpers';
import { getFixedT } from '~/.server/utils/locale.utils';
import { transformFlattenedError } from '~/.server/utils/zod.utils';
import { AppPageTitle } from '~/components/app-page-title';
import { ButtonLink } from '~/components/buttons';
import { Collapsible } from '~/components/collapsible';
import { CsrfTokenInput } from '~/components/csrf-token-input';
import { DatePickerField } from '~/components/date-picker-field';
import { ErrorSummary } from '~/components/error-summary';
import { ErrorSummaryProvider } from '~/components/error-summary-context';
import { InputPatternField } from '~/components/input-pattern-field';
import { InputRadios } from '~/components/input-radios';
import { InputSanitizeField } from '~/components/input-sanitize-field';
import { LoadingButton } from '~/components/loading-button';
import { useFetcherSubmissionState, useHCaptcha } from '~/hooks';
import { pageIds } from '~/page-ids';
import { useFeature } from '~/root';
import { applicationCodeInputPatternFormat, isValidCodeOrNumber } from '~/utils/application-code-utils';
import { extractDateParts, getAgeFromDateString, isPastDateString, isValidDateString } from '~/utils/date-utils';
import { mergeMeta } from '~/utils/meta-utils';
import type { RouteHandleData } from '~/utils/route-utils';
import { getPathById } from '~/utils/route-utils';
import { getTitleMetaTags } from '~/utils/seo-utils';
import { formatSin, isValidSin, sinInputPatternFormat } from '~/utils/sin-utils';
import { extractDigits, isAllValidInputCharacters } from '~/utils/string-utils';

const CHILD_HAS_SIN = {
  no: 'no',
  yes: 'yes',
} as const;

export const handle = {
  pageIdentifier: pageIds.public.status.child,
} as const satisfies RouteHandleData;

export const meta: Route.MetaFunction = mergeMeta(({ loaderData }) => getTitleMetaTags(loaderData.meta.title));

export async function loader({ context, params, url }: Route.LoaderArgs) {
  const { appContainer } = context.get(appContext);
  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  securityHandler.validateFeatureEnabled('status');
  const t = await getFixedT(url, ['status', 'gcweb']);
  const meta = {
    title: t(($) => $.meta.title.template, { ns: 'gcweb', title: t(($) => $.child.pageTitle) }),
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

  const codeSchema = z.object({
    code: z
      .string()
      .trim()
      .min(
        1,
        t(($) => $.child.form.errorMessage.applicationCodeRequired),
      )
      .refine(
        isValidCodeOrNumber,
        t(($) => $.child.form.errorMessage.applicationCodeValid),
      )
      .transform((code) => extractDigits(code)),
  });

  const childHasSinSchema = z.object({
    childHasSin: z.boolean({
      error: t(($) => $.child.form.errorMessage.radioRequired),
    }),
  });

  const sinSchema = z.object({
    sin: z
      .string()
      .trim()
      .min(
        1,
        t(($) => $.child.form.errorMessage.sinRequired),
      )
      .refine(
        isValidSin,
        t(($) => $.child.form.errorMessage.sinValid),
      )
      .transform((sin) => formatSin(sin, '')),
  });

  const childInfoSchema = z
    .object({
      firstName: z
        .string()
        .trim()
        .max(
          100,
          t(($) => $.child.form.errorMessage.firstNameTooLong),
        )
        .refine(
          isAllValidInputCharacters,
          t(($) => $.child.form.errorMessage.charactersValid),
        )
        .optional(),
      lastName: z
        .string()
        .trim()
        .min(
          1,
          t(($) => $.child.form.errorMessage.lastNameRequired),
        )
        .max(100)
        .refine(
          isAllValidInputCharacters,
          t(($) => $.child.form.errorMessage.charactersValid),
        ),
      dateOfBirthYear: z.number({
        error: (issue) => (issue.input === undefined ? t(($) => $.child.form.errorMessage.dateOfBirthYearRequired) : t(($) => $.child.form.errorMessage.dateOfBirthYearNumber)),
      }),
      dateOfBirthMonth: z.number({
        error: (issue) => (issue.input === undefined ? t(($) => $.child.form.errorMessage.dateOfBirthMonthRequired) : undefined),
      }),
      dateOfBirthDay: z.number({
        error: (issue) => (issue.input === undefined ? t(($) => $.child.form.errorMessage.dateOfBirthDayRequired) : t(($) => $.child.form.errorMessage.dateOfBirthDayNumber)),
      }),
      dateOfBirth: z.string(),
    })

    .superRefine((val, ctx) => {
      // At this point the year, month and day should have been validated as positive integer
      const dateOfBirthParts = extractDateParts(`${val.dateOfBirthYear}-${val.dateOfBirthMonth}-${val.dateOfBirthDay}`);
      const dateOfBirth = `${dateOfBirthParts.year}-${dateOfBirthParts.month}-${dateOfBirthParts.day}`;

      if (!isValidDateString(dateOfBirth)) {
        ctx.addIssue({
          code: 'custom',
          message: t(($) => $.child.form.errorMessage.dateOfBirthValid),
          path: ['dateOfBirth'],
        });
      } else if (!isPastDateString(dateOfBirth)) {
        ctx.addIssue({
          code: 'custom',
          message: t(($) => $.child.form.errorMessage.dateOfBirthIsPast),
          path: ['dateOfBirth'],
        });
      } else if (getAgeFromDateString(dateOfBirth) > 150) {
        ctx.addIssue({
          code: 'custom',
          message: t(($) => $.child.form.errorMessage.dateOfBirthIsPastValid),
          path: ['dateOfBirth'],
        });
      }
    })
    .transform((val) => {
      // At this point the year, month and day should have been validated as positive integer
      const dateOfBirthParts = extractDateParts(`${val.dateOfBirthYear}-${val.dateOfBirthMonth}-${val.dateOfBirthDay}`);
      return {
        ...val,
        dateOfBirth: `${dateOfBirthParts.year}-${dateOfBirthParts.month}-${dateOfBirthParts.day}`,
      };
    });

  const parsedCodeResult = codeSchema.safeParse({ code: String(formData.get('code') ?? '') });

  const parsedChildHasSinResult = childHasSinSchema.safeParse({
    childHasSin: formData.get('childHasSin') ? formData.get('childHasSin') === CHILD_HAS_SIN.yes : undefined,
  });

  // only validate if childHasSinSchema parsing is successful and parsed childHasSin is "true"
  const parsedSinResult = parsedChildHasSinResult.success && parsedChildHasSinResult.data.childHasSin ? sinSchema.safeParse({ sin: String(formData.get('sin') ?? '') }) : undefined;

  // only validate if childHasSinSchema parsing is successful and parsed childHasSin is "false"
  const parsedChildInfoResult =
    parsedChildHasSinResult.success && !parsedChildHasSinResult.data.childHasSin
      ? childInfoSchema.safeParse({
          firstName: String(formData.get('firstName') ?? ''),
          lastName: String(formData.get('lastName') ?? ''),
          dateOfBirthYear: formData.get('dateOfBirthYear') ? Number(formData.get('dateOfBirthYear')) : undefined,
          dateOfBirthMonth: formData.get('dateOfBirthMonth') ? Number(formData.get('dateOfBirthMonth')) : undefined,
          dateOfBirthDay: formData.get('dateOfBirthDay') ? Number(formData.get('dateOfBirthDay')) : undefined,
          dateOfBirth: '',
        })
      : undefined;

  if (!parsedCodeResult.success || !parsedChildHasSinResult.success || parsedSinResult?.success === false || parsedChildInfoResult?.success === false) {
    return {
      errors: {
        ...(parsedCodeResult.success === false ? transformFlattenedError(z.flattenError(parsedCodeResult.error)) : {}),
        ...(parsedChildHasSinResult.success === false ? transformFlattenedError(z.flattenError(parsedChildHasSinResult.error)) : {}),
        ...(parsedSinResult?.success === false ? transformFlattenedError(z.flattenError(parsedSinResult.error)) : {}),
        ...(parsedChildInfoResult?.success === false ? transformFlattenedError(z.flattenError(parsedChildInfoResult.error)) : {}),
      },
    };
  }

  const applicationStatusService = appContainer.get(TYPES.ApplicationStatusService);
  const statusId: Option<string> = parsedSinResult
    ? await applicationStatusService.findApplicationStatusIdBySin({
        sin: parsedSinResult.data.sin,
        applicationCode: parsedCodeResult.data.code,
        userId: 'anonymous',
      })
    : await applicationStatusService.findApplicationStatusIdByBasicInfo({
        applicationCode: parsedCodeResult.data.code,
        firstName: parsedChildInfoResult?.data.firstName ?? '',
        lastName: parsedChildInfoResult?.data.lastName ?? '',
        dateOfBirth: parsedChildInfoResult?.data.dateOfBirth ?? '',
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

export default function StatusCheckerChild({ loaderData, params }: Route.ComponentProps) {
  const { t } = useTranslation('status');
  const hCaptchaEnabled = useFeature('hcaptcha');
  const { captchaRef, onLoad, sitekey } = useHCaptcha();

  const [childHasSinState, setChildHasSinState] = useState<boolean>();

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

  function handleOnChildHasSinChanged(e: React.ChangeEvent<HTMLInputElement>) {
    setChildHasSinState(e.target.value === CHILD_HAS_SIN.yes);
  }

  return (
    <>
      <AppPageTitle>{t(($) => $.child.pageTitle)}</AppPageTitle>
      <div className="max-w-prose">
        <p className="mb-4 italic">{t(($) => $.child.form.completeFields)}</p>
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
                label={t(($) => $.child.form.applicationCodeLabel)}
                inputMode="numeric"
                helpMessagePrimary={t(($) => $.child.form.applicationCodeDescription)}
                required
                errorMessage={errors?.code}
                defaultValue=""
              />
              <InputRadios
                id="child-has-sin"
                name="childHasSin"
                legend={t(($) => $.child.form.radioLegend)}
                options={[
                  {
                    value: CHILD_HAS_SIN.yes,
                    children: <Trans ns="status" i18nKey={($) => $.child.form.optionYes} />,
                    onChange: handleOnChildHasSinChanged,
                  },
                  {
                    value: CHILD_HAS_SIN.no,
                    children: <Trans ns="status" i18nKey={($) => $.child.form.optionNo} />,
                    onChange: handleOnChildHasSinChanged,
                  },
                ]}
                errorMessage={errors?.childHasSin}
                required
              />
              {childHasSinState === true && (
                <InputPatternField id="sin" name="sin" format={sinInputPatternFormat} label={t(($) => $.child.form.sinLabel)} helpMessagePrimary={t(($) => $.child.form.sinDescription)} required errorMessage={errors?.sin} defaultValue="" />
              )}
              {childHasSinState === false && (
                <>
                  <Collapsible summary={t(($) => $.child.form.ifChildSummary)} className="mt-8">
                    <div className="space-y-4">
                      <p>{t(($) => $.child.form.ifChildDesc)}</p>
                    </div>
                  </Collapsible>
                  <div className="grid items-end gap-6 md:grid-cols-2">
                    <InputSanitizeField id="first-name" name="firstName" label={t(($) => $.child.form.firstName)} className="w-full" maxLength={100} aria-describedby="name-instructions" required errorMessage={errors?.firstName} defaultValue="" />
                    <InputSanitizeField id="last-name" name="lastName" label={t(($) => $.child.form.lastName)} className="w-full" maxLength={100} aria-describedby="name-instructions" required errorMessage={errors?.lastName} defaultValue="" />
                  </div>
                  <DatePickerField
                    id="date-of-birth"
                    names={{
                      day: 'dateOfBirthDay',
                      month: 'dateOfBirthMonth',
                      year: 'dateOfBirthYear',
                    }}
                    defaultValue=""
                    legend={t(($) => $.child.form.dateOfBirthLabel)}
                    required
                    errorMessages={{
                      all: errors?.dateOfBirth,
                      year: errors?.dateOfBirthYear,
                      month: errors?.dateOfBirthMonth,
                      day: errors?.dateOfBirthDay,
                    }}
                  />
                </>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <ButtonLink id="back-button" variant="secondary" routeId="public/status/index" params={params} startIcon={faChevronLeft} disabled={isSubmitting}>
                {t(($) => $.child.form.backBtn)}
              </ButtonLink>
              <LoadingButton variant="primary" id="submit" loading={isSubmitting} data-gc-analytics-formsubmit="submit" endIcon={faChevronRight}>
                {t(($) => $.child.form.submit)}
              </LoadingButton>
            </div>
          </fetcher.Form>
        </ErrorSummaryProvider>
      </div>
    </>
  );
}
