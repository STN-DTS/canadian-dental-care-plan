import { useTranslation } from 'react-i18next';

import type { Route } from './+types/communication-preferences';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import { getFixedT, getLocale } from '~/.server/utils/locale.utils';
import { AppPageTitle } from '~/components/app-page-title';
import { ButtonLink } from '~/components/buttons';
import { DefinitionList, DefinitionListItem } from '~/components/definition-list';
import { InlineLink } from '~/components/inline-link';
import { pageIds } from '~/page-ids';
import { mergeMeta } from '~/utils/meta-utils';
import type { RouteHandleData } from '~/utils/route-utils';
import { getTitleMetaTags } from '~/utils/seo-utils';

export const handle = {
  i18nPreloadNamespace: ['protectedProfile', 'gcweb'],
  pageIdentifier: pageIds.protected.profile.communicationPreferences,
} as const satisfies RouteHandleData;

export const meta: Route.MetaFunction = mergeMeta(({ loaderData }) => getTitleMetaTags(loaderData.meta.title));

export async function loader({ context, params, request }: Route.LoaderArgs) {
  const { appContainer, session } = context.get(appContext);
  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  await securityHandler.validateAuthSession({ request, session });
  const clientApplication = await securityHandler.requireClientApplication({ params, request, session });

  const locale = getLocale(request);
  const t = await getFixedT(request, ['protectedProfile', 'gcweb']);
  const meta = {
    title: t(($) => $.meta.title.mscaTemplate, { ns: 'gcweb', title: t(($) => $.communicationPreferences.pageTitle) }),
  };
  const { SCCH_BASE_URI } = appContainer.get(TYPES.ClientConfig);
  const { COMMUNICATION_METHOD_SUNLIFE_EMAIL_ID, COMMUNICATION_METHOD_GC_DIGITAL_ID } = appContainer.get(TYPES.ServerConfig);

  const idToken = session.get('idToken');
  appContainer.get(TYPES.AuditService).createAudit('page-view.profile.communication-preferences', { userId: idToken.sub });

  return {
    meta,
    preferredLanguage: clientApplication.communicationPreferences.preferredLanguage //
      ? appContainer.get(TYPES.LanguageService).getLocalizedLanguageById(clientApplication.communicationPreferences.preferredLanguage, locale)
      : undefined,
    preferredMethodSunLife: clientApplication.communicationPreferences.preferredMethodSunLife
      ? appContainer.get(TYPES.SunLifeCommunicationMethodService).getLocalizedSunLifeCommunicationMethodById(clientApplication.communicationPreferences.preferredMethodSunLife, locale)
      : undefined,
    preferredMethodGovernmentOfCanada: clientApplication.communicationPreferences.preferredMethodGovernmentOfCanada
      ? appContainer.get(TYPES.GCCommunicationMethodService).getLocalizedGCCommunicationMethodById(clientApplication.communicationPreferences.preferredMethodGovernmentOfCanada, locale)
      : undefined,
    SCCH_BASE_URI,
    COMMUNICATION_METHOD_SUNLIFE_EMAIL_ID,
    COMMUNICATION_METHOD_GC_DIGITAL_ID,
  };
}

export default function ViewCommunicationPreferences({ loaderData, params }: Route.ComponentProps) {
  const { t } = useTranslation(['protectedProfile', 'gcweb']);
  const { preferredLanguage, preferredMethodSunLife, preferredMethodGovernmentOfCanada, SCCH_BASE_URI } = loaderData;

  return (
    <>
      <AppPageTitle>{t(($) => $.communicationPreferences.pageTitle)}</AppPageTitle>
      <div className="max-w-prose space-y-10">
        <DefinitionList border>
          <DefinitionListItem term={t(($) => $.communicationPreferences.languagePreference)}>{preferredLanguage?.name}</DefinitionListItem>
          <DefinitionListItem term={t(($) => $.communicationPreferences.sunlifeCommunicationPreference)}>{preferredMethodSunLife?.name}</DefinitionListItem>
          <DefinitionListItem term={t(($) => $.communicationPreferences.gocCommunicationPreference)}>{preferredMethodGovernmentOfCanada?.name}</DefinitionListItem>
        </DefinitionList>
        <div>
          <InlineLink id="update-communication-preferences" routeId="protected/profile/communication-preferences/edit" params={params}>
            {t(($) => $.communicationPreferences.updateLinkText)}
          </InlineLink>
        </div>
        <ButtonLink
          variant="primary"
          id="back-button"
          to={t(($) => $.header.menuDashboardHref, { ns: 'gcweb', baseUri: SCCH_BASE_URI })}
          data-gc-analytics-customclick="ESDC-EDSC:CDCP Applicant Profile-Protected:Return to dashboard - My communication preferences return button click"
        >
          {t(($) => $.communicationPreferences.returnButton)}
        </ButtonLink>
      </div>
    </>
  );
}
