import { data, redirect, useFetcher } from 'react-router';

import { Trans, useTranslation } from 'react-i18next';
import * as z from 'zod';

import type { Route } from './+types/personal-information';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import { isSinReserved } from '~/.server/routes/helpers/base-application-route-helpers';
import type { ProtectedApplicationApplicantInformationState } from '~/.server/routes/helpers/protected-application-route-helpers';
import {
  getContextualAgeCategoryFromDate,
  getProtectedApplicationState,
  getProtectedChildrenSins,
  getProtectedPartnerSin,
  isNewOrReturningMember,
  saveProtectedApplicationState,
  validateProtectedApplicationContext,
} from '~/.server/routes/helpers/protected-application-route-helpers';
import { getFixedT } from '~/.server/utils/locale-utils';
import { transformFlattenedError } from '~/.server/utils/zod-utils';
import { AppPageTitle } from '~/components/app-page-title';
import { ButtonLink } from '~/components/buttons';
import { Collapsible } from '~/components/collapsible';
import { CsrfTokenInput } from '~/components/csrf-token-input';
import { DatePickerField } from '~/components/date-picker-field';
import { ErrorSummary } from '~/components/error-summary';
import { ErrorSummaryProvider } from '~/components/error-summary-context';
import { InputPatternField } from '~/components/input-pattern-field';
import { InputSanitizeField } from '~/components/input-sanitize-field';
import { LoadingButton } from '~/components/loading-button';
import { useFetcherSubmissionState } from '~/hooks';
import { pageIds } from '~/page-ids';
import { extractDateParts, getAgeFromDateString, isPastDateString, isValidDateString } from '~/utils/date-utils';
import { mergeMeta } from '~/utils/meta-utils';
import type { RouteHandleData } from '~/utils/route-utils';
import { getPathById } from '~/utils/route-utils';
import { getTitleMetaTags } from '~/utils/seo-utils';
import { isValidSin, sinInputPatternFormat } from '~/utils/sin-utils';
import { hasDigits, isAllValidInputCharacters } from '~/utils/string-utils';

export const handle = {
  pageIdentifier: pageIds.protected.application.spokes.personalInformation,
} as const satisfies RouteHandleData;

export const meta: Route.MetaFunction = mergeMeta(({ loaderData }) => getTitleMetaTags(loaderData.meta.title));

export async function loader({ context, params, url }: Route.LoaderArgs) {
  const { appContainer, session } = context.get(appContext);
  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  await securityHandler.validateAuthSession({ requestUrl: url, session });

  const state = getProtectedApplicationState({ params, session });
  validateProtectedApplicationContext(state, params, 'intake');

  const t = await getFixedT(url, ['protectedApplicationSpokes', 'gcweb']);
  const meta = {
    title: t(($) => $.meta.title.template, { ns: 'gcweb', title: t(($) => $.personalInformation.pageTitle) }),
  };

  return {
    state: state.applicantInformation,
    meta,
  };
}

export async function action({ context, params, request, url }: Route.ActionArgs) {
  const { appContainer, session } = context.get(appContext);
  const formData = await request.formData();

  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  await securityHandler.validateAuthSession({ requestUrl: url, session });
  securityHandler.validateCsrfToken({ formData, session });

  const state = getProtectedApplicationState({ params, session });
  validateProtectedApplicationContext(state, params, 'intake');

  const t = await getFixedT(url, 'protectedApplicationSpokes');

  const applicantInformationSchema = z
    .object({
      socialInsuranceNumber: z
        .string()
        .trim()
        .min(
          1,
          t(($) => $.personalInformation.errorMessage.sinRequired),
        )
        .superRefine((sin, ctx) => {
          if (!isValidSin(sin)) {
            ctx.addIssue({ code: 'custom', message: t(($) => $.personalInformation.errorMessage.sinValid) });
            return;
          }

          if (isSinReserved(sin, [getProtectedPartnerSin(state), ...getProtectedChildrenSins(state)])) {
            ctx.addIssue({ code: 'custom', message: t(($) => $.personalInformation.errorMessage.sinUnique) });
          }
        }),
      firstName: z
        .string()
        .trim()
        .min(
          1,
          t(($) => $.personalInformation.errorMessage.firstNameRequired),
        )
        .max(100)
        .refine(
          isAllValidInputCharacters,
          t(($) => $.personalInformation.errorMessage.charactersValid),
        )
        .refine(
          (firstName) => !hasDigits(firstName),
          t(($) => $.personalInformation.errorMessage.firstNameNoDigits),
        ),
      lastName: z
        .string()
        .trim()
        .min(
          1,
          t(($) => $.personalInformation.errorMessage.lastNameRequired),
        )
        .max(100)
        .refine(
          isAllValidInputCharacters,
          t(($) => $.personalInformation.errorMessage.charactersValid),
        )
        .refine(
          (lastName) => !hasDigits(lastName),
          t(($) => $.personalInformation.errorMessage.lastNameNoDigits),
        ),
      dateOfBirthYear: z.number({
        error: (issue) => (issue.input === undefined ? t(($) => $.personalInformation.errorMessage.dateOfBirthYearRequired) : t(($) => $.personalInformation.errorMessage.dateOfBirthYearNumber)),
      }),
      dateOfBirthMonth: z.number({
        error: (issue) => (issue.input === undefined ? t(($) => $.personalInformation.errorMessage.dateOfBirthMonthRequired) : undefined),
      }),
      dateOfBirthDay: z.number({
        error: (issue) => (issue.input === undefined ? t(($) => $.personalInformation.errorMessage.dateOfBirthDayRequired) : t(($) => $.personalInformation.errorMessage.dateOfBirthDayNumber)),
      }),
      dateOfBirth: z.string(),
    })

    .superRefine((val, ctx) => {
      const dateOfBirthParts = extractDateParts(`${val.dateOfBirthYear}-${val.dateOfBirthMonth}-${val.dateOfBirthDay}`);
      const dateOfBirth = `${dateOfBirthParts.year}-${dateOfBirthParts.month}-${dateOfBirthParts.day}`;

      if (!isValidDateString(dateOfBirth)) {
        ctx.addIssue({
          code: 'custom',
          message: t(($) => $.personalInformation.errorMessage.dateOfBirthValid),
          path: ['dateOfBirth'],
        });
      } else if (!isPastDateString(dateOfBirth)) {
        ctx.addIssue({
          code: 'custom',
          message: t(($) => $.personalInformation.errorMessage.dateOfBirthIsPast),
          path: ['dateOfBirth'],
        });
      } else if (getAgeFromDateString(dateOfBirth) > 150) {
        ctx.addIssue({
          code: 'custom',
          message: t(($) => $.personalInformation.errorMessage.dateOfBirthIsPastValid),
          path: ['dateOfBirth'],
        });
      }
    })
    .transform((val) => {
      // At this point the year, month and day should have been validated as positive integer
      const dateOfBirthParts = extractDateParts(`${val.dateOfBirthYear}-${val.dateOfBirthMonth}-${val.dateOfBirthDay}`);
      return { ...val, dateOfBirth: `${dateOfBirthParts.year}-${dateOfBirthParts.month}-${dateOfBirthParts.day}` };
    }) satisfies z.ZodType<ProtectedApplicationApplicantInformationState>;

  const parsedDataResult = applicantInformationSchema.safeParse({
    socialInsuranceNumber: String(formData.get('socialInsuranceNumber') ?? ''),
    firstName: String(formData.get('firstName') ?? ''),
    lastName: String(formData.get('lastName') ?? ''),
    dateOfBirthYear: formData.get('dateOfBirthYear') ? Number(formData.get('dateOfBirthYear')) : undefined,
    dateOfBirthMonth: formData.get('dateOfBirthMonth') ? Number(formData.get('dateOfBirthMonth')) : undefined,
    dateOfBirthDay: formData.get('dateOfBirthDay') ? Number(formData.get('dateOfBirthDay')) : undefined,
    dateOfBirth: '',
  });

  if (!parsedDataResult.success) {
    return data({ errors: transformFlattenedError(z.flattenError(parsedDataResult.error)) }, { status: 400 });
  }

  const applicantInformation = {
    firstName: parsedDataResult.data.firstName,
    lastName: parsedDataResult.data.lastName,
    dateOfBirth: parsedDataResult.data.dateOfBirth,
    socialInsuranceNumber: parsedDataResult.data.socialInsuranceNumber,
  };
  const ageCategory = getContextualAgeCategoryFromDate(applicantInformation.dateOfBirth, state.applicationYear);
  const showNewOrReturningMember = isNewOrReturningMember({
    ...state,
    applicantInformation,
  });

  saveProtectedApplicationState({
    params,
    session,
    state: {
      applicantInformation,
      newOrReturningMember: showNewOrReturningMember ? state.newOrReturningMember : undefined,
    },
  });

  if (ageCategory === 'youth') {
    return redirect(getPathById('protected/application/$id/living-independently', params));
  }
  if (ageCategory === 'children') {
    return redirect(getPathById('protected/application/$id/parent-or-guardian', params));
  }

  return redirect(getPathById('protected/application/$id/your-application', params));
}

export default function ApplicationPersonalInformation({ loaderData, params }: Route.ComponentProps) {
  const { t } = useTranslation(['protectedApplicationSpokes', 'protectedApplication']);
  const { state } = loaderData;

  const fetcher = useFetcher<typeof action>();
  const { isSubmitting } = useFetcherSubmissionState(fetcher);
  const errors = typeof fetcher.data === 'object' && 'errors' in fetcher.data ? fetcher.data.errors : undefined;

  return (
    <>
      <AppPageTitle>{t(($) => $.personalInformation.pageTitle)}</AppPageTitle>
      <div className="max-w-prose">
        <ErrorSummaryProvider actionData={fetcher.data}>
          <ErrorSummary />
          <p className="mb-4">{t(($) => $.personalInformation.formInstructionsSin)}</p>
          <p className="mb-6">{t(($) => $.personalInformation.formInstructionsInfo)}</p>
          <p className="mb-4 italic">{t(($) => $.requiredLabel, { ns: 'protectedApplication' })}</p>
          <fetcher.Form method="post" noValidate>
            <CsrfTokenInput />
            <div className="mb-8 space-y-6">
              <div className="grid items-end gap-6 md:grid-cols-2">
                <InputSanitizeField
                  id="first-name"
                  name="firstName"
                  label={t(($) => $.personalInformation.firstName)}
                  className="w-full"
                  maxLength={100}
                  aria-description={t(($) => $.personalInformation.nameInstructions)}
                  autoComplete="given-name"
                  defaultValue={state?.firstName ?? ''}
                  errorMessage={errors?.firstName}
                  required
                />
                <InputSanitizeField
                  id="last-name"
                  name="lastName"
                  label={t(($) => $.personalInformation.lastName)}
                  className="w-full"
                  maxLength={100}
                  aria-description={t(($) => $.personalInformation.nameInstructions)}
                  autoComplete="family-name"
                  defaultValue={state?.lastName ?? ''}
                  errorMessage={errors?.lastName}
                  required
                />
              </div>
              <Collapsible id="name-instructions" summary={t(($) => $.personalInformation.singleLegalName)}>
                <p>
                  <Trans ns="protectedApplicationSpokes" i18nKey={($) => $.personalInformation.nameInstructions} />
                </p>
              </Collapsible>
              <DatePickerField
                id="date-of-birth"
                names={{ day: 'dateOfBirthDay', month: 'dateOfBirthMonth', year: 'dateOfBirthYear' }}
                defaultValue={state?.dateOfBirth ?? ''}
                legend={t(($) => $.personalInformation.dob)}
                errorMessages={{ all: errors?.dateOfBirth, year: errors?.dateOfBirthYear, month: errors?.dateOfBirthMonth, day: errors?.dateOfBirthDay }}
                required
              />
              <InputPatternField
                id="social-insurance-number"
                name="socialInsuranceNumber"
                format={sinInputPatternFormat}
                label={t(($) => $.personalInformation.sin)}
                inputMode="numeric"
                helpMessagePrimary={t(($) => $.personalInformation.helpMessage.sin)}
                helpMessagePrimaryClassName="text-black"
                defaultValue={state?.socialInsuranceNumber ?? ''}
                errorMessage={errors?.socialInsuranceNumber}
                required
              />
            </div>
            <div className="flex flex-row-reverse flex-wrap items-center justify-end gap-3">
              <LoadingButton id="save-button" variant="primary" loading={isSubmitting} data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Spoke:Save - Applicant information click">
                {t(($) => $.personalInformation.saveBtn)}
              </LoadingButton>
              <ButtonLink
                id="back-button"
                variant="secondary"
                routeId={`protected/application/$id/your-application`}
                params={params}
                disabled={isSubmitting}
                data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Spoke:Back - Applicant information click"
              >
                {t(($) => $.personalInformation.backBtn)}
              </ButtonLink>
            </div>
          </fetcher.Form>
        </ErrorSummaryProvider>
      </div>
    </>
  );
}
