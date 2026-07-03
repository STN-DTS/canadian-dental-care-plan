import type { ChangeEvent, JSX } from 'react';

import { useSearchParams } from 'react-router';

import { invariant } from '@dts-stn/invariant';
import { useTranslation } from 'react-i18next';
import * as z from 'zod';

import type { Route } from './+types/index';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import { getFixedT } from '~/.server/utils/locale.utils';
import type { IdToken, UserinfoToken } from '~/.server/utils/raoidc.utils';
import { AppPageTitle } from '~/components/app-page-title';
import { ProtectedBreadcrumbs } from '~/components/breadcrumbs';
import { ButtonLink } from '~/components/buttons';
import { ContextualAlert } from '~/components/contextual-alert';
import { InlineLink } from '~/components/inline-link';
import { InputSelect } from '~/components/input-select';
import { useCurrentLanguage } from '~/hooks';
import { pageIds } from '~/page-ids';
import { getNameByLanguage } from '~/utils/locale-utils';
import { mergeMeta } from '~/utils/meta-utils';
import type { RouteHandleData } from '~/utils/route-utils';
import { getTitleMetaTags } from '~/utils/seo-utils';

export const handle = {
  i18nPreloadNamespace: ['letters', 'gcweb'],
  layoutOptions: { breadcrumbs: <LayoutBreadcrumbs /> },
  pageIdentifier: pageIds.protected.letters.index,
} as const satisfies RouteHandleData;

function LayoutBreadcrumbs(): JSX.Element {
  const { t } = useTranslation('letters');
  return (
    <ProtectedBreadcrumbs
      items={[
        {
          content: t(($) => $.index.pageTitle),
          routeId: 'protected/letters/index',
        },
      ]}
    />
  );
}

export const meta: Route.MetaFunction = mergeMeta(({ loaderData }) => getTitleMetaTags(loaderData.meta.title));

const orderEnumSchema = z.enum(['asc', 'desc']);

export async function loader({ context, params, url }: Route.LoaderArgs) {
  const { appContainer, session } = context.get(appContext);
  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  securityHandler.validateFeatureEnabled('view-letters');
  await securityHandler.validateAuthSession({ requestUrl: url, session });
  const applicant = await securityHandler.requireApplicant({ params, requestUrl: url, session });

  const sortParam = url.searchParams.get('sort');
  const sortOrder = orderEnumSchema.catch('desc').parse(sortParam);

  const userInfoToken: UserinfoToken = session.get('userInfoToken');
  invariant(userInfoToken.sin, 'Expected userInfoToken.sin to be defined');

  const clientNumber = applicant.clientNumber;
  const allLetters = await appContainer.get(TYPES.LetterService).findLettersByClientId({ clientId: clientNumber, userId: userInfoToken.sub, sortOrder });
  const letterTypes = await appContainer.get(TYPES.LetterTypeService).listLetterTypes();
  const letters = allLetters.filter(({ letterTypeId }) => letterTypes.some(({ id }) => letterTypeId === id));

  session.set('letters', letters);

  const t = await getFixedT(url, ['letters', 'gcweb']);
  const meta = {
    title: t(($) => $.meta.title.mscaTemplate, { ns: 'gcweb', title: t(($) => $.index.pageTitle) }),
  };
  const { SCCH_BASE_URI } = appContainer.get(TYPES.ClientConfig);

  const idToken: IdToken = session.get('idToken');
  appContainer.get(TYPES.AuditService).createAudit('page-view.letters', { userId: idToken.sub });

  return { letters, letterTypes, meta, sortOrder, SCCH_BASE_URI };
}

export default function LettersIndex({ loaderData, params }: Route.ComponentProps) {
  const { currentLanguage } = useCurrentLanguage();
  const [, setSearchParams] = useSearchParams();
  const { t } = useTranslation(['letters', 'gcweb']);
  const { letters, letterTypes, sortOrder, SCCH_BASE_URI } = loaderData;

  function handleOnSortOrderChange(e: ChangeEvent<HTMLSelectElement>) {
    setSearchParams((prev) => {
      prev.set('sort', e.target.value);
      return prev;
    });
  }

  return (
    <>
      <AppPageTitle>{t(($) => $.index.pageTitle)}</AppPageTitle>
      {letters.length === 0 ? (
        <ContextualAlert type="info">
          <p>{t(($) => $.index.noLetter)}</p>
        </ContextualAlert>
      ) : (
        <>
          <div className="my-6">
            <InputSelect
              className="w-full sm:w-1/2 md:w-1/3 lg:w-1/4"
              id="sort-order"
              value={sortOrder}
              onChange={handleOnSortOrderChange}
              label={t(($) => $.index.filter)}
              name="sortOrder"
              options={[
                {
                  value: orderEnumSchema.enum.desc,
                  children: t(($) => $.index.newest),
                },
                {
                  value: orderEnumSchema.enum.asc,
                  children: t(($) => $.index.oldest),
                },
              ]}
            />
          </div>

          <ul className="divide-y border-y">
            {letters.map((letter) => {
              const letterType = letterTypes.find(({ id }) => id === letter.letterTypeId);
              const gcAnalyticsCustomClickValue = `ESDC-EDSC:CDCP Letters Click:${letterType?.nameEn ?? letter.letterTypeId}`;
              const letterName = letterType ? getNameByLanguage(currentLanguage, letterType) : letter.letterTypeId;

              return (
                <li key={letter.id} className="py-4 sm:py-6">
                  <InlineLink reloadDocument routeId="protected/letters/$id.download" params={{ ...params, id: letter.id }} className="external-link" newTabIndicator target="_blank" data-gc-analytics-customclick={gcAnalyticsCustomClickValue}>
                    {letterName}
                  </InlineLink>
                  <p className="mt-1 text-sm text-gray-500">
                    {t(($) => $.index.date, {
                      date: letter.date,
                      ns: 'letters',
                    })}
                  </p>
                </li>
              );
            })}
          </ul>
        </>
      )}
      <div className="my-6 flex flex-wrap items-center gap-3">
        <ButtonLink
          id="back-button"
          variant="secondary"
          to={t(($) => $.header.menuDashboardHref, {
            baseUri: SCCH_BASE_URI,
            ns: 'gcweb',
          })}
        >
          {t(($) => $.index.button.back)}
        </ButtonLink>
      </div>
    </>
  );
}
