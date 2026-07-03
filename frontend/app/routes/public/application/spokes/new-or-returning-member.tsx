import { useState } from 'react';
import type { ChangeEventHandler } from 'react';

import { data, redirect, useFetcher } from 'react-router';

import { invariant } from '@dts-stn/invariant';
import { faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons';
import { Trans, useTranslation } from 'react-i18next';
import * as z from 'zod';

import type { Route } from './+types/new-or-returning-member';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import { getContextualAgeCategoryFromDate, getPublicApplicationState, savePublicApplicationState } from '~/.server/routes/helpers/public-application-route-helpers';
import { getFixedT } from '~/.server/utils/locale.utils';
import { transformFlattenedError } from '~/.server/utils/zod.utils';
import { AppPageTitle } from '~/components/app-page-title';
import { ButtonLink } from '~/components/buttons';
import { CsrfTokenInput } from '~/components/csrf-token-input';
import { ErrorSummary } from '~/components/error-summary';
import { ErrorSummaryProvider } from '~/components/error-summary-context';
import { InputPatternField } from '~/components/input-pattern-field';
import { InputRadios } from '~/components/input-radios';
import type { InputRadiosProps } from '~/components/input-radios';
import { LoadingButton } from '~/components/loading-button';
import { pageIds } from '~/page-ids';
import { isValidClientNumberRenewal, renewalCodeInputPatternFormat } from '~/utils/application-code-utils';
import { mergeMeta } from '~/utils/meta-utils';
import type { RouteHandleData } from '~/utils/route-utils';
import { getPathById } from '~/utils/route-utils';
import { getTitleMetaTags } from '~/utils/seo-utils';
import { extractDigits } from '~/utils/string-utils';

const NEW_OR_EXISTING_MEMBER_OPTION = { no: 'no', yes: 'yes' } as const;

export const handle = {
  pageIdentifier: pageIds.public.application.spokes.newOrReturningMember,
} as const satisfies RouteHandleData;

export const meta: Route.MetaFunction = mergeMeta(({ loaderData }) => getTitleMetaTags(loaderData.meta.title));

export async function loader({ context, params, request }: Route.LoaderArgs) {
  const { session } = context.get(appContext);
  const state = getPublicApplicationState({ params, session });
  const t = await getFixedT(request, ['applicationSpokes', 'gcweb']);

  const meta = {
    title: t(($) => $.meta.title.template, { ns: 'gcweb', title: t(($) => $.newOrReturningMember.pageTitle) }),
  };

  invariant(state.applicantInformation?.dateOfBirth, 'Expected applicantInformation.dateOfBirth to be defined');
  const ageCategory = getContextualAgeCategoryFromDate(state.applicantInformation.dateOfBirth, state.applicationYear);

  return { meta, defaultState: state.newOrReturningMember, userAgeCategory: ageCategory };
}

export async function action({ context, params, request }: Route.ActionArgs) {
  const { appContainer, session } = context.get(appContext);
  const formData = await request.formData();

  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  securityHandler.validateCsrfToken({ formData, session });

  const t = await getFixedT(request, 'applicationSpokes');

  const newOrExistingMemberSchema = z
    .object({
      newOrExistingMember: z.enum(NEW_OR_EXISTING_MEMBER_OPTION, {
        error: t(($) => $.newOrReturningMember.errorMessage.isNewOrExistingMemberRequired),
      }),
      memberId: z
        .string()
        .trim()
        .optional()
        .transform((code) => (code ? extractDigits(code) : undefined)),
    })

    .superRefine((val, ctx) => {
      if (val.newOrExistingMember === NEW_OR_EXISTING_MEMBER_OPTION.yes) {
        if (!val.memberId) {
          ctx.addIssue({
            code: 'custom',
            message: t(($) => $.newOrReturningMember.errorMessage.memberIdRequired),
            path: ['memberId'],
          });
        } else if (!isValidClientNumberRenewal(val.memberId)) {
          ctx.addIssue({
            code: 'custom',
            message: t(($) => $.newOrReturningMember.errorMessage.memberIdValid),
            path: ['memberId'],
          });
        }
      }
    });

  const parsedDataResult = newOrExistingMemberSchema.safeParse({
    newOrExistingMember: formData.get('newOrExistingMember'),
    memberId: formData.get('memberId') ? String(formData.get('memberId') ?? '') : undefined,
  });

  if (!parsedDataResult.success) {
    return data({ errors: transformFlattenedError(z.flattenError(parsedDataResult.error)) }, { status: 400 });
  }

  savePublicApplicationState({
    params,
    session,
    state: {
      newOrReturningMember: {
        isNewOrReturningMember: parsedDataResult.data.newOrExistingMember === NEW_OR_EXISTING_MEMBER_OPTION.yes,
        memberId: parsedDataResult.data.memberId,
      },
    },
  });

  return redirect(getPathById('public/application/$id/your-application', params));
}

export default function ApplyFlowNewOrExistingMember({ loaderData, params }: Route.ComponentProps) {
  const { t } = useTranslation(['applicationSpokes', 'application']);
  const { defaultState, userAgeCategory } = loaderData;

  const fetcher = useFetcher<typeof action>();
  const isSubmitting = fetcher.state !== 'idle';
  const errors = typeof fetcher.data === 'object' && 'errors' in fetcher.data ? fetcher.data.errors : undefined;
  const [isNewOrReturningMember, setIsNewOrReturningMember] = useState(defaultState?.isNewOrReturningMember);

  const handleNewOrReturningMemberSelection: ChangeEventHandler<HTMLInputElement> = (e) => {
    setIsNewOrReturningMember(e.target.value === NEW_OR_EXISTING_MEMBER_OPTION.yes);
  };

  const options: InputRadiosProps['options'] = [
    {
      children: <Trans ns="applicationSpokes" i18nKey={($) => $.newOrReturningMember.yes} components={{ bold: <strong /> }} />,
      value: NEW_OR_EXISTING_MEMBER_OPTION.yes,
      defaultChecked: defaultState?.isNewOrReturningMember === true,
      onChange: handleNewOrReturningMemberSelection,
    },
    {
      children: <Trans ns="applicationSpokes" i18nKey={($) => $.newOrReturningMember.no} components={{ bold: <strong /> }} />,
      value: NEW_OR_EXISTING_MEMBER_OPTION.no,
      defaultChecked: defaultState?.isNewOrReturningMember === false,
      onChange: handleNewOrReturningMemberSelection,
    },
  ];

  return (
    <>
      <AppPageTitle>{t(($) => $.newOrReturningMember.pageTitle)}</AppPageTitle>
      <div className="max-w-prose">
        <p className="mb-4 italic">{t(($) => $.requiredLabel, { ns: 'application' })}</p>
        <ErrorSummaryProvider actionData={fetcher.data}>
          <ErrorSummary />
          <fetcher.Form method="post" noValidate>
            <CsrfTokenInput />
            <InputRadios id="new-or-existing-member" name="newOrExistingMember" legend={t(($) => $.newOrReturningMember.previouslyEnrolled)} options={options} errorMessage={errors?.newOrExistingMember} required />
            {isNewOrReturningMember && (
              <div className="my-8">
                <InputPatternField
                  id="member-id"
                  name="memberId"
                  format={renewalCodeInputPatternFormat}
                  label={t(($) => $.newOrReturningMember.memberId)}
                  inputMode="numeric"
                  defaultValue={defaultState?.memberId ?? ''}
                  errorMessage={errors?.memberId}
                  helpMessagePrimary={t(($) => $.newOrReturningMember.memberIdDescription)}
                  required={isNewOrReturningMember}
                />
              </div>
            )}
            <div className="mt-8 flex flex-row-reverse flex-wrap items-center justify-end gap-3">
              <LoadingButton variant="primary" id="continue-button" loading={isSubmitting} endIcon={faChevronRight} data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Adult:Continue - New or existing member click">
                {t(($) => $.newOrReturningMember.saveBtn)}
              </LoadingButton>
              <ButtonLink
                id="back-button"
                variant="secondary"
                routeId={userAgeCategory === 'youth' ? 'public/application/$id/living-independently' : 'public/application/$id/your-application'}
                params={params}
                disabled={isSubmitting}
                startIcon={faChevronLeft}
                data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Adult:Back - New or existing member click"
              >
                {t(($) => $.newOrReturningMember.backBtn)}
              </ButtonLink>
            </div>
          </fetcher.Form>
        </ErrorSummaryProvider>
      </div>
    </>
  );
}
