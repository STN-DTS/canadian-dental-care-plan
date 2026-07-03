import { data, redirectDocument, useFetcher } from 'react-router';

import { UTCDate } from '@date-fns/utc';
import { useTranslation } from 'react-i18next';
import * as z from 'zod';

import type { Route } from './+types/stub-login';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import { getFixedT } from '~/.server/utils/locale.utils';
import type { IdToken, UserinfoToken } from '~/.server/utils/raoidc.utils';
import { transformFlattenedError } from '~/.server/utils/zod.utils';
import { AppPageTitle } from '~/components/app-page-title';
import { Button } from '~/components/buttons';
import { ErrorSummary } from '~/components/error-summary';
import { ErrorSummaryProvider } from '~/components/error-summary-context';
import { InputField } from '~/components/input-field';
import { InputPatternField } from '~/components/input-pattern-field';
import { InputSelect } from '~/components/input-select';
import { mergeMeta } from '~/utils/meta-utils';
import type { RouteHandleData } from '~/utils/route-utils';
import { getPathById } from '~/utils/route-utils';
import { getTitleMetaTags } from '~/utils/seo-utils';
import { isValidSin, sinInputPatternFormat } from '~/utils/sin-utils';

export const handle = {
  i18nPreloadNamespace: ['stubLogin', 'gcweb'],
  pageIdentifier: 'CDCP-00XX',
} as const satisfies RouteHandleData;

export const meta: Route.MetaFunction = mergeMeta(({ loaderData }) => getTitleMetaTags(loaderData.meta.title));

export async function loader({ context, request }: Route.LoaderArgs) {
  const { appContainer, session } = context.get(appContext);
  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  securityHandler.validateFeatureEnabled('stub-login');

  const t = await getFixedT(request, ['stubLogin', 'gcweb']);
  const meta = {
    title: t(($) => $.meta.title.mscaTemplate, { ns: 'gcweb', title: t(($) => $.index.pageTitle) }),
  };

  const idTokenOption = session.find('idToken');
  const userInfoTokenOption = session.find('userInfoToken');

  const defaultValues = {
    sin: userInfoTokenOption.mapOr<string>('', (userInfoToken) => userInfoToken.sin ?? ''),
    sid: idTokenOption.mapOr<string>('00000000-0000-0000-0000-000000000000', (idToken) => idToken.sid),
    sub: idTokenOption.mapOr<string>('00000000-0000-0000-0000-000000000000', (idToken) => idToken.sub),
  };

  return { meta, defaultValues };
}

export async function action({ context, params, request }: Route.ActionArgs) {
  const { appContainer, session } = context.get(appContext);
  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  securityHandler.validateFeatureEnabled('stub-login');

  const t = await getFixedT(request, 'stubLogin');

  const stubLoginSchema = z.object({
    sin: z
      .string()
      .trim()
      .nonempty(t(($) => $.index.errorMessage.sinRequired))
      .refine(
        isValidSin,
        t(($) => $.index.errorMessage.sinInvalid),
      ),
    destinationRouteId: z
      .string()
      .trim()
      .nonempty(t(($) => $.index.errorMessage.destinationRequired)),
    sid: z
      .string()
      .trim()
      .nonempty(t(($) => $.index.errorMessage.sidRequired)),
    sub: z
      .string()
      .trim()
      .nonempty(t(($) => $.index.errorMessage.subRequired)),
  });

  const formData = await request.formData();

  const parsedDataResult = stubLoginSchema.safeParse({
    sin: String(formData.get('sin') ?? ''),
    destinationRouteId: String(formData.get('destinationRouteId') ?? ''),
    sid: String(formData.get('sid') ?? ''),
    sub: String(formData.get('sub') ?? ''),
  });

  if (!parsedDataResult.success) {
    return data({ errors: transformFlattenedError(z.flattenError(parsedDataResult.error)) }, { status: 400 });
  }

  const sin = parsedDataResult.data.sin.replaceAll(/\s+/g, ''); // Remove any spaces
  const sid = parsedDataResult.data.sid;
  const sub = parsedDataResult.data.sub;

  const currentDateInSeconds = Math.floor(UTCDate.now() / 1000);

  const idToken: IdToken = {
    iss: 'GC-ECAS',
    jti: '71b080e9-2524-4572-a085-a53e63a98116',
    nbf: currentDateInSeconds - 30,
    exp: currentDateInSeconds + 300, //five minutes TTL for the token
    iat: currentDateInSeconds,
    aud: 'CDCP',
    sid,
    sub,
    nonce: 'hqwVxGbvJ5g7NSWoOv1BvrA9avVAY7CL',
    locale: 'en-CA',
  };

  const userInfoTokenPayload: UserinfoToken = {
    aud: 'CDCP',
    birthdate: '2000-01-01',
    iss: 'GC-ECAS-MOCK',
    jti: '71b080e9-2524-4572-a085-a53e63a98116',
    nbf: currentDateInSeconds - 30,
    exp: currentDateInSeconds + 300, //five minutes TTL for the token
    iat: currentDateInSeconds,
    locale: 'en-CA',
    sid,
    sin,
    sub,
    mocked: true,
  };

  if (session.has('userInfoToken')) {
    const userInfoToken = session.get('userInfoToken');
    userInfoToken.sin = sin;
    userInfoToken.sub = sub;

    session.set('userInfoToken', userInfoToken);
  } else {
    session.set('userInfoToken', userInfoTokenPayload);
  }

  session.set('idToken', idToken);
  session.unset('applicant');

  return redirectDocument(getPathById(parsedDataResult.data.destinationRouteId, params));
}

export default function StubLogin({ loaderData, params }: Route.ComponentProps) {
  const { t } = useTranslation('stubLogin');
  const { defaultValues } = loaderData;
  const fetcher = useFetcher<typeof action>();
  const errors = fetcher.data?.errors;

  return (
    <>
      <AppPageTitle>{t(($) => $.index.pageTitle)}</AppPageTitle>
      <div className="max-w-prose">
        <ErrorSummaryProvider actionData={fetcher.data}>
          <ErrorSummary />
          <fetcher.Form method="post" noValidate className="space-y-6">
            <InputPatternField id="sin" name="sin" format={sinInputPatternFormat} label={t(($) => $.index.sin)} required inputMode="numeric" defaultValue={defaultValues.sin} errorMessage={errors?.sin} />
            <InputSelect
              id="destination-page"
              name="destinationRouteId"
              label={t(($) => $.index.destination)}
              errorMessage={errors?.destinationRouteId}
              defaultValue=""
              required
              options={[
                { children: 'Select a destination', value: '', disabled: true, hidden: true },
                {
                  children: 'Application',
                  value: 'protected/application/index',
                },
                {
                  children: 'Documents',
                  value: 'protected/documents/index',
                },
                {
                  children: 'Letters',
                  value: 'protected/letters/index',
                },
                {
                  children: 'Member Eligibility',
                  value: 'protected/profile/eligibility',
                },
                {
                  children: 'Profile - Applicant Information',
                  value: 'protected/profile/applicant-information',
                },
                {
                  children: 'Profile - Communication Preferences',
                  value: 'protected/profile/communication-preferences',
                },
                {
                  children: 'Profile - Contact Information',
                  value: 'protected/profile/contact-information',
                },
                {
                  children: 'Profile - Dental Benefits',
                  value: 'protected/profile/dental-benefits',
                },
              ]}
            />
            <fieldset>
              <legend className="mb-2 text-xl font-semibold">{t(($) => $.index.raoidc)}</legend>
              <div className="space-y-6">
                <InputField id="sid" name="sid" className="w-full" inputMode="text" label={t(($) => $.index.sid)} defaultValue={defaultValues.sid} errorMessage={errors?.sid} />
                <InputField id="sub" name="sub" className="w-full" inputMode="text" label={t(($) => $.index.sub)} defaultValue={defaultValues.sub} errorMessage={errors?.sub} />
              </div>
            </fieldset>
            <Button variant="primary" id="login-button">
              {t(($) => $.index.login)}
            </Button>
          </fetcher.Form>
        </ErrorSummaryProvider>
      </div>
    </>
  );
}
