import type { ChangeEventHandler } from 'react';
import { useState } from 'react';

import { data, redirect, useFetcher } from 'react-router';

import { Trans, useTranslation } from 'react-i18next';
import * as z from 'zod';

import type { Route } from './+types/child-information';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import { isChildOrYouth, isSinReserved } from '~/.server/routes/helpers/base-application-route-helpers';
import type { ProtectedApplicationChildInformationState, ProtectedApplicationChildSinState } from '~/.server/routes/helpers/protected-application-route-helpers';
import {
  getProtectedApplicantSin,
  getProtectedApplicationState,
  getProtectedChildrenSins,
  getProtectedPartnerSin,
  getSingleChildState,
  saveProtectedApplicationState,
  validateApplicationFlow,
} from '~/.server/routes/helpers/protected-application-route-helpers';
import { getFixedT } from '~/.server/utils/locale.utils';
import { transformFlattenedError } from '~/.server/utils/zod.utils';
import { AppPageTitle } from '~/components/app-page-title';
import { ButtonLink } from '~/components/buttons';
import { Collapsible } from '~/components/collapsible';
import { CsrfTokenInput } from '~/components/csrf-token-input';
import { DatePickerField } from '~/components/date-picker-field';
import { useErrorAlert } from '~/components/error-alert';
import { ErrorSummary } from '~/components/error-summary';
import { ErrorSummaryProvider } from '~/components/error-summary-context';
import { InputPatternField } from '~/components/input-pattern-field';
import type { InputRadiosProps } from '~/components/input-radios';
import { InputRadios } from '~/components/input-radios';
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

const YES_NO_OPTION = {
  yes: 'yes',
  no: 'no',
} as const;

export const handle = {
  pageIdentifier: pageIds.protected.application.spokes.childInformation,
} as const satisfies RouteHandleData;

export const meta: Route.MetaFunction = mergeMeta(({ loaderData }) => {
  return getTitleMetaTags(loaderData.meta.title, loaderData.meta.dcTermsTitle);
});

export async function loader({ context, params, request }: Route.LoaderArgs) {
  const { appContainer, session } = context.get(appContext);
  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  await securityHandler.validateAuthSession({ request, session });

  const state = getProtectedApplicationState({ params, session });
  validateApplicationFlow(state, params, ['intake-children', 'intake-family', 'renewal-children', 'renewal-family']);
  const childState = getSingleChildState({ params, session });

  const t = await getFixedT(request, ['protectedApplicationSpokes', 'gcweb']);

  const childNumber = t(($) => $.children.childNumber, {
    childNumber: childState.childNumber,
  });
  const childName = childState.isNew ? childNumber : (childState.information?.firstName ?? childNumber);

  const meta = {
    title: t(($) => $.meta.title.template, {
      title: t(($) => $.children.information.pageTitle, {
        childName: childName,
      }),

      ns: 'gcweb',
    }),
    dcTermsTitle: t(($) => $.meta.title.template, {
      title: t(($) => $.children.information.pageTitle, {
        childName: childNumber,
      }),

      ns: 'gcweb',
    }),
  };

  return {
    meta,
    defaultState: childState.information,
    childName,
    isNew: childState.isNew,
    applicationFlow: `${state.context}-${state.typeOfApplication}` as const,
  };
}

export async function action({ context, params, request }: Route.ActionArgs) {
  const { appContainer, session } = context.get(appContext);
  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  await securityHandler.validateAuthSession({ request, session });

  const state = getProtectedApplicationState({ params, session });
  validateApplicationFlow(state, params, ['intake-children', 'intake-family', 'renewal-children', 'renewal-family']);

  const formData = await request.formData();

  securityHandler.validateCsrfToken({ formData, session });

  const childState = getSingleChildState({ params, session });
  const t = await getFixedT(request, 'protectedApplicationSpokes');

  // Form action Continue & Save
  // state validation schema
  const childInformationSchema = z
    .object({
      firstName: z
        .string()
        .trim()
        .min(
          1,
          t(($) => $.children.information.errorMessage.firstNameRequired),
        )
        .max(100)
        .refine(
          isAllValidInputCharacters,
          t(($) => $.children.information.errorMessage.charactersValid),
        )
        .refine(
          (firstName) => !hasDigits(firstName),
          t(($) => $.children.information.errorMessage.firstNameNoDigits),
        ),
      lastName: z
        .string()
        .trim()
        .min(
          1,
          t(($) => $.children.information.errorMessage.lastNameRequired),
        )
        .max(100)
        .refine(
          isAllValidInputCharacters,
          t(($) => $.children.information.errorMessage.charactersValid),
        )
        .refine(
          (lastName) => !hasDigits(lastName),
          t(($) => $.children.information.errorMessage.lastNameNoDigits),
        ),
      dateOfBirthYear: z.number({
        error: (issue) => (issue.input === undefined ? t(($) => $.children.information.errorMessage.dateOfBirthYearRequired) : t(($) => $.children.information.errorMessage.dateOfBirthYearNumber)),
      }),
      dateOfBirthMonth: z.number({
        error: (issue) => (issue.input === undefined ? t(($) => $.children.information.errorMessage.dateOfBirthMonthRequired) : undefined),
      }),
      dateOfBirthDay: z.number({
        error: (issue) => (issue.input === undefined ? t(($) => $.children.information.errorMessage.dateOfBirthDayRequired) : t(($) => $.children.information.errorMessage.dateOfBirthDayNumber)),
      }),
      dateOfBirth: z.string(),
      isParent: z.boolean({
        error: t(($) => $.children.information.errorMessage.isParent),
      }),
    })
    .superRefine((val, ctx) => {
      // At this point the year, month and day should have been validated as positive integer
      const dateOfBirthParts = extractDateParts(`${val.dateOfBirthYear}-${val.dateOfBirthMonth}-${val.dateOfBirthDay}`);
      const dateOfBirth = `${dateOfBirthParts.year}-${dateOfBirthParts.month}-${dateOfBirthParts.day}`;

      if (!isValidDateString(dateOfBirth)) {
        ctx.addIssue({
          code: 'custom',
          message: t(($) => $.children.information.errorMessage.dateOfBirthValid),
          path: ['dateOfBirth'],
        });
      } else if (!isPastDateString(dateOfBirth)) {
        ctx.addIssue({
          code: 'custom',
          message: t(($) => $.children.information.errorMessage.dateOfBirthIsPast),
          path: ['dateOfBirth'],
        });
      } else if (getAgeFromDateString(dateOfBirth) > 150) {
        ctx.addIssue({
          code: 'custom',
          message: t(($) => $.children.information.errorMessage.dateOfBirthIsPastValid),
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
    }) satisfies z.ZodType<OmitStrict<ProtectedApplicationChildInformationState, 'hasSocialInsuranceNumber' | 'socialInsuranceNumber'>>;

  const childSinSchema = z
    .object({
      hasSocialInsuranceNumber: z.boolean({
        error: t(($) => $.children.information.errorMessage.hasSocialInsuranceNumber),
      }),
      socialInsuranceNumber: z.string().trim().optional(),
    })
    .superRefine((val, ctx) => {
      if (!val.hasSocialInsuranceNumber) return;

      if (!val.socialInsuranceNumber) {
        ctx.addIssue({ code: 'custom', message: t(($) => $.children.information.errorMessage.sinRequired), path: ['socialInsuranceNumber'] });
        return;
      }

      if (!isValidSin(val.socialInsuranceNumber)) {
        ctx.addIssue({ code: 'custom', message: t(($) => $.children.information.errorMessage.sinValid), path: ['socialInsuranceNumber'] });
        return;
      }

      if (isSinReserved(val.socialInsuranceNumber, [getProtectedApplicantSin(state), getProtectedPartnerSin(state), ...getProtectedChildrenSins(state, childState.id)])) {
        ctx.addIssue({ code: 'custom', message: t(($) => $.children.information.errorMessage.sinUnique), path: ['socialInsuranceNumber'] });
      }
    }) satisfies z.ZodType<ProtectedApplicationChildSinState>;

  const parsedDataResult = childInformationSchema.safeParse({
    firstName: String(formData.get('firstName') ?? ''),
    lastName: String(formData.get('lastName') ?? ''),
    dateOfBirthYear: formData.get('dateOfBirthYear') ? Number(formData.get('dateOfBirthYear')) : undefined,
    dateOfBirthMonth: formData.get('dateOfBirthMonth') ? Number(formData.get('dateOfBirthMonth')) : undefined,
    dateOfBirthDay: formData.get('dateOfBirthDay') ? Number(formData.get('dateOfBirthDay')) : undefined,
    dateOfBirth: '',
    isParent: formData.get('isParent') ? formData.get('isParent') === YES_NO_OPTION.yes : undefined,
  });

  const parsedSinDataResult = childSinSchema.safeParse({
    hasSocialInsuranceNumber: formData.get('hasSocialInsuranceNumber') ? formData.get('hasSocialInsuranceNumber') === YES_NO_OPTION.yes : undefined,
    socialInsuranceNumber: formData.get('socialInsuranceNumber') ? String(formData.get('socialInsuranceNumber') ?? '') : undefined,
  });

  if (!parsedDataResult.success || !parsedSinDataResult.success) {
    return data(
      {
        errors: {
          ...(parsedDataResult.success ? {} : transformFlattenedError(z.flattenError(parsedDataResult.error))),
          ...(parsedSinDataResult.success ? {} : transformFlattenedError(z.flattenError(parsedSinDataResult.error))),
        },
      },
      { status: 400 },
    );
  }

  saveProtectedApplicationState({
    params,
    session,
    state: {
      children: state.children.map((child) => {
        if (child.id !== childState.id) return child;
        const information = { ...parsedDataResult.data, ...parsedSinDataResult.data };
        return { ...child, information };
      }),
    },
  });

  if (!parsedDataResult.data.isParent) {
    return redirect(getPathById('protected/application/$id/children/$childId/parent-or-guardian', params));
  }

  if (!isChildOrYouth(parsedDataResult.data.dateOfBirth, state.applicationYear)) {
    return redirect(getPathById('protected/application/$id/children/$childId/cannot-apply-child', params));
  }

  return redirect(getPathById(`protected/application/$id/${state.context}-${state.typeOfApplication}/childrens-application`, params));
}

export default function ChildInformation({ loaderData, params }: Route.ComponentProps) {
  const { t } = useTranslation(['protectedApplicationSpokes', 'protectedApplication']);
  const { defaultState, childName, isNew, applicationFlow } = loaderData;

  const fetcher = useFetcher<typeof action>();
  const { isSubmitting } = useFetcherSubmissionState(fetcher);

  const fetcherStatus = typeof fetcher.data === 'object' && 'status' in fetcher.data ? fetcher.data.status : undefined;
  const errors = typeof fetcher.data === 'object' && 'errors' in fetcher.data ? fetcher.data.errors : undefined;

  const { ErrorAlert } = useErrorAlert(fetcherStatus === 'not-eligible');

  const [hasSocialInsuranceNumberValue, setHasSocialInsuranceNumberValue] = useState(defaultState?.hasSocialInsuranceNumber ?? true);

  const handleSocialInsuranceNumberSelection: ChangeEventHandler<HTMLInputElement> = (e) => {
    setHasSocialInsuranceNumberValue(e.target.value === YES_NO_OPTION.yes);
  };

  const options: InputRadiosProps['options'] = [
    {
      children: <Trans ns="protectedApplicationSpokes" i18nKey={($) => $.children.information.sinYes} components={{ bold: <strong /> }} />,
      value: YES_NO_OPTION.yes,
      defaultChecked: defaultState?.hasSocialInsuranceNumber ?? true,
      append: hasSocialInsuranceNumberValue === true && (
        <div className="mb-6">
          <InputPatternField
            id="social-insurance-number"
            name="socialInsuranceNumber"
            format={sinInputPatternFormat}
            label={t(($) => $.children.information.sin)}
            inputMode="numeric"
            defaultValue={defaultState?.socialInsuranceNumber ?? ''}
            errorMessage={errors?.socialInsuranceNumber}
            required
          />
        </div>
      ),
      onChange: handleSocialInsuranceNumberSelection,
    },
    {
      children: <Trans ns="protectedApplicationSpokes" i18nKey={($) => $.children.information.sinNo} components={{ bold: <strong /> }} />,
      value: YES_NO_OPTION.no,
      defaultChecked: defaultState?.hasSocialInsuranceNumber === false,
      onChange: handleSocialInsuranceNumberSelection,
    },
  ];

  return (
    <ErrorSummaryProvider actionData={fetcher.data}>
      <AppPageTitle>
        {t(($) => $.children.information.pageTitle, {
          childName: childName,
        })}
      </AppPageTitle>
      <div className="max-w-prose">
        <ErrorAlert>
          <h2 className="mb-2 font-bold">{t(($) => $.children.information.errorMessage.alert.heading)}</h2>
          <p className="mb-2">
            <Trans ns="protectedApplicationSpokes" i18nKey={($) => $.children.information.errorMessage.alert.detail} components={{ noWrap: <span className="whitespace-nowrap" /> }} />
          </p>
          <p className="mb-2">{t(($) => $.children.information.errorMessage.alert.detailAdultMustApply)}</p>
          <p className="mb-2">{t(($) => $.children.information.errorMessage.alert.applyDate)}</p>
        </ErrorAlert>
        <p className="mb-4">{t(($) => $.children.information.formInstructionsSin)}</p>
        <p className="mb-4 italic">{t(($) => $.requiredLabel, { ns: 'protectedApplication' })}</p>
        <ErrorSummary />
        <fetcher.Form method="post" noValidate>
          <CsrfTokenInput />
          <div className="mb-8 space-y-6">
            <Collapsible id="name-instructions" summary={t(($) => $.children.information.singleLegalName)}>
              <p>{t(($) => $.children.information.nameInstructions)}</p>
            </Collapsible>
            <div className="grid items-end gap-6 md:grid-cols-2">
              <InputSanitizeField
                id="first-name"
                name="firstName"
                label={t(($) => $.children.information.firstName)}
                className="w-full"
                maxLength={100}
                aria-description={t(($) => $.children.information.nameInstructions)}
                autoComplete="given-name"
                errorMessage={errors?.firstName}
                defaultValue={defaultState?.firstName ?? ''}
                required
              />
              <InputSanitizeField
                id="last-name"
                name="lastName"
                label={t(($) => $.children.information.lastName)}
                className="w-full"
                maxLength={100}
                autoComplete="family-name"
                defaultValue={defaultState?.lastName ?? ''}
                errorMessage={errors?.lastName}
                aria-description={t(($) => $.children.information.nameInstructions)}
                required
              />
            </div>
            <DatePickerField
              id="date-of-birth"
              names={{
                day: 'dateOfBirthDay',
                month: 'dateOfBirthMonth',
                year: 'dateOfBirthYear',
              }}
              defaultValue={defaultState?.dateOfBirth ?? ''}
              legend={t(($) => $.children.information.dateOfBirth)}
              errorMessages={{
                all: errors?.dateOfBirth,
                year: errors?.dateOfBirthYear,
                month: errors?.dateOfBirthMonth,
                day: errors?.dateOfBirthDay,
              }}
              required
            />

            <InputRadios id="has-social-insurance-number" legend={t(($) => $.children.information.sinLegend)} name="hasSocialInsuranceNumber" options={options} errorMessage={errors?.hasSocialInsuranceNumber} required />

            <InputRadios
              id="is-parent-radios"
              name="isParent"
              legend={t(($) => $.children.information.parentLegend)}
              options={[
                {
                  value: YES_NO_OPTION.yes,
                  children: t(($) => $.children.information.radioOptions.yes),
                  defaultChecked: defaultState?.isParent === true,
                  readOnly: !isNew,
                  tabIndex: isNew ? 0 : -1,
                },
                {
                  value: YES_NO_OPTION.no,
                  children: t(($) => $.children.information.radioOptions.no),
                  defaultChecked: defaultState?.isParent === false,
                  readOnly: !isNew,
                  tabIndex: isNew ? 0 : -1,
                },
              ]}
              errorMessage={errors?.isParent}
              required
            />
          </div>
          <div className="flex flex-row-reverse flex-wrap items-center justify-end gap-3">
            <LoadingButton id="save-button" variant="primary" loading={isSubmitting} data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Spoke:Save - Child Information click">
              {t(($) => $.children.information.saveBtn)}
            </LoadingButton>
            <ButtonLink
              id="back-button"
              variant="secondary"
              routeId={`protected/application/$id/${applicationFlow}/childrens-application`}
              params={params}
              disabled={isSubmitting}
              data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Spoke:Back - Child Information click"
            >
              {t(($) => $.children.information.backBtn)}
            </ButtonLink>
          </div>
        </fetcher.Form>
      </div>
    </ErrorSummaryProvider>
  );
}
