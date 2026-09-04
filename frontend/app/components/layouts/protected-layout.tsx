import { useEffect } from 'react';
import type { PropsWithChildren } from 'react';

import { Link } from 'react-router';

import { faArrowRightFromBracket, faChevronDown, faCircleUser, faEnvelope } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { Namespace } from 'i18next';
import { Trans, useTranslation } from 'react-i18next';

import { AppLink } from '~/components/app-link';
import { Banner } from '~/components/banner';
import { ProtectedBreadcrumbs } from '~/components/breadcrumbs';
import { BrowserCompatibilityBanner } from '~/components/browser-compatibility-banner';
import { ButtonLink } from '~/components/buttons';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '~/components/dropdown-menu';
import { InlineLink } from '~/components/inline-link';
import { PageDetails } from '~/components/page-details';
import { PageHeaderBrand } from '~/components/page-header-brand';
import { PageTitle } from '~/components/page-title';
import { SkipNavigationLinks } from '~/components/skip-navigation-links';
import { useFeature } from '~/hooks';
import * as adobeAnalytics from '~/utils/adobe-analytics.client';
import { getClientEnv } from '~/utils/env-utils';
import { useLayoutOptions } from '~/utils/route-utils';

export const protectedLayoutI18nNamespace = 'gcweb' satisfies Namespace;

/**
 * GCWeb Application page template.
 * see: https://wet-boew.github.io/GCWeb/templates/application/application-docs-en.html
 */
export function ProtectedLayout({ children }: PropsWithChildren) {
  const { breadcrumbs } = useLayoutOptions();
  return (
    <>
      <PageHeader />
      <div className="my-4 print:hidden">{breadcrumbs ?? <ProtectedBreadcrumbs />}</div>
      <main className="container" property="mainContentOfPage" resource="#wb-main" typeof="WebPageElement">
        {children}
        <PageDetails />
      </main>
      <PageFooter />
    </>
  );
}

function NavigationMenu() {
  const { t, i18n } = useTranslation(protectedLayoutI18nNamespace);
  const { SCCH_BASE_URI } = getClientEnv();

  return (
    <div className="sm:w-65">
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <button className="inline-flex w-full items-center justify-between bg-slate-200 px-4 py-3 align-middle font-bold text-slate-700 outline-offset-2 hover:bg-neutral-300 focus:bg-neutral-300" id="dropdownNavbarLink">
            <span className="inline-flex w-full appearance-none items-center gap-4">
              <FontAwesomeIcon icon={faCircleUser} className="size-9 shrink-0" />
              <span>{t(($) => $.header.menuTitle)}</span>
            </span>
            <FontAwesomeIcon icon={faChevronDown} className="size-3 shrink-0" />
          </button>
        </DropdownMenuTrigger>
        {/* Use of a workaround (onFocusOutside={(e) => e.preventDefault()}) for the drowndownmenucontent with the resize issue raised by accessibility : https://github.com/radix-ui/primitives/issues/2754 */}
        <DropdownMenuContent onFocusOutside={(e) => e.preventDefault()} side="bottom" avoidCollisions={false} className="w-svw rounded-t-none sm:w-65" sideOffset={0} align="center">
          <DropdownMenuItem asChild className="cursor-pointer">
            <Link to={t(($) => $.header.menuDashboardHref, { baseUri: SCCH_BASE_URI })} data-gc-analytics-customclick="ESDC-EDSC_MSCA-MSDC-SCH:Nav Menu:my-dashboard">
              {t(($) => $.header.menuDashboardText)}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="cursor-pointer">
            <Link to={t(($) => $.header.menuProfileHref, { baseUri: SCCH_BASE_URI })} data-gc-analytics-customclick="ESDC-EDSC_MSCA-MSDC-SCH:Nav Menu:profile">
              {t(($) => $.header.menuProfileText)}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="cursor-pointer">
            <Link to={t(($) => $.header.menuSecuritySettingsHref, { baseUri: SCCH_BASE_URI })} data-gc-analytics-customclick="ESDC-EDSC_MSCA-MSDC-SCH:Nav Menu:security">
              {t(($) => $.header.menuSecuritySettingsText)}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="cursor-pointer">
            <Link to={t(($) => $.header.menuContactUsHref, { baseUri: SCCH_BASE_URI })} data-gc-analytics-customclick="ESDC-EDSC_MSCA-MSDC-SCH:Nav Menu:contact">
              {t(($) => $.header.menuContactUsText)}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild className="cursor-pointer">
            <Link
              to={{
                pathname: '/auth/logout',
                search: '?locale=' + i18n.language,
              }}
              className="flex items-center justify-between gap-2"
              data-gc-analytics-customclick="ESDC-EDSC_MSCA-MSDC-SCH:Nav Menu:signOut"
            >
              {t(($) => $.header.menuSignOutText)} <FontAwesomeIcon icon={faArrowRightFromBracket} className="size-4 shrink-0" />
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function PageHeader() {
  const { t } = useTranslation(protectedLayoutI18nNamespace);
  const { SCCH_BASE_URI } = getClientEnv();

  return (
    <header>
      <SkipNavigationLinks />
      <BrowserCompatibilityBanner />
      {useFeature('show-prototype-banner') && <Banner alert={t(($) => $.header.banner.alert)} description={t(($) => $.header.banner.desc)} />}
      <PageHeaderBrand />
      <section className="bg-gray-700 text-white">
        <div className="sm:container">
          <div className="flex flex-col items-stretch justify-between sm:flex-row sm:items-center">
            <h2 className="font-lato p-4 text-xl font-semibold sm:p-0 sm:py-3 sm:text-2xl">
              <AppLink to={t(($) => $.header.menuDashboardHref, { baseUri: SCCH_BASE_URI })} className="hover:underline">
                {t(($) => $.header.applicationTitleMsca)}
              </AppLink>
            </h2>
            <div className="items-center gap-8 md:flex">
              <ButtonLink
                variant="alternative"
                startIcon={faEnvelope}
                startIconProps={{ size: 'xl' }}
                className="hidden px-3 py-1.5 font-sans text-xl text-gray-700 md:flex"
                to={t(($) => $.header.menuInboxHref, { baseUri: SCCH_BASE_URI })}
                data-gc-analytics-customclick="ESDC-EDSC_MSCA-MSDC-SCH:Nav Menu:my-dashboard"
              >
                {t(($) => $.header.menuInboxText)}
              </ButtonLink>
              <NavigationMenu />
            </div>
          </div>
        </div>
      </section>
      <div className="container mt-6 md:hidden">
        <ButtonLink
          variant="secondary"
          startIcon={faEnvelope}
          startIconProps={{ size: 'xl' }}
          className="px-3 py-1.5 font-sans text-xl text-gray-700"
          to={t(($) => $.header.menuInboxHref, { baseUri: SCCH_BASE_URI })}
          data-gc-analytics-customclick="ESDC-EDSC_MSCA-MSDC-SCH:Nav Menu:my-dashboard"
        >
          {t(($) => $.header.menuInboxText)}
        </ButtonLink>
      </div>
    </header>
  );
}

function PageFooter() {
  const { ECAS_BASE_URI, SCCH_BASE_URI } = getClientEnv();
  const { t } = useTranslation('gcweb');

  return (
    <footer id="wb-info" tabIndex={-1} className="bg-stone-50 print:hidden">
      <div className="bg-gray-700 text-white">
        <section className="container py-6">
          <h2 className="mb-4">{t(($) => $.footer.mainBand.header.protected)}</h2>
          <div className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
            <Link className="hover:underline" to={t(($) => $.footer.mainBand.links.contactUs.protectedHref, { baseUri: SCCH_BASE_URI })} data-gc-analytics-navigation={`Footer:Footer:${t(($) => $.footer.mainBand.links.contactUs.content)}`}>
              {t(($) => $.footer.mainBand.links.contactUs.content)}
            </Link>
          </div>
        </section>
      </div>
      <div className="container py-7">
        <h2 className="sr-only">{t(($) => $.footer.aboutSite)}</h2>
        <div className="flex items-center justify-between gap-4">
          <nav aria-labelledby="gc-corporate">
            <h3 id="gc-corporate" className="sr-only">
              {t(($) => $.footer.gcCorporate)}
            </h3>
            <div className="flex flex-col items-start gap-2 text-sm leading-6 sm:flex-row sm:items-center sm:gap-4">
              <Link className="text-slate-700 hover:underline" to={t(($) => $.footer.termsConditions.protectedHref, { baseUri: ECAS_BASE_URI })} data-gc-analytics-navigation={`Footer:Footer:${t(($) => $.footer.termsConditions.text)}`}>
                {t(($) => $.footer.termsConditions.text)}
              </Link>
              <div className="hidden size-0 rounded-full border-[3px] border-slate-700 sm:block"></div>
              <Link className="text-slate-700 hover:underline" to={t(($) => $.footer.privacy.protectedHref, { baseUri: ECAS_BASE_URI })} data-gc-analytics-navigation={`Footer:Footer:${t(($) => $.footer.privacy.text)}`}>
                {t(($) => $.footer.privacy.text)}
              </Link>
            </div>
          </nav>
          <div>
            <img src="/assets/wmms-blk.svg" alt={t(($) => $.footer.gcSymbol)} width={300} height={71} className="h-10 w-auto" />
          </div>
        </div>
      </div>
    </footer>
  );
}

interface NotFoundErrorProps {
  error?: unknown;
}

export function NotFoundError({ error }: NotFoundErrorProps) {
  const { t } = useTranslation(protectedLayoutI18nNamespace);
  const { SCCH_BASE_URI } = getClientEnv();
  const dashboard = <InlineLink to={t(($) => $.header.menuDashboardHref, { baseUri: SCCH_BASE_URI })} />;

  useEffect(() => {
    if (adobeAnalytics.isConfigured()) {
      adobeAnalytics.pushErrorEvent(404);
    }
  }, []);

  return (
    <>
      <PageHeader />
      <main className="container" property="mainContentOfPage" resource="#wb-main" typeof="WebPageElement">
        <PageTitle className="my-8">
          <span>{t(($) => $.protectedNotFound.pageTitle)}</span>
          <small className="block text-2xl font-normal text-neutral-500">{t(($) => $.protectedNotFound.pageSubtitle)}</small>
        </PageTitle>
        <p className="mb-8 text-lg text-gray-500">{t(($) => $.protectedNotFound.pageMessage)}</p>
        <ul className="list-disc space-y-2 pl-10">
          <li>
            <Trans ns={protectedLayoutI18nNamespace} i18nKey={($) => $.protectedNotFound.pageLink} components={{ dashboard }} />
          </li>
        </ul>
        <PageDetails />
      </main>
      <PageFooter />
    </>
  );
}

interface ServerErrorProps {
  error: unknown;
}

export function ServerError({ error }: ServerErrorProps) {
  const { t } = useTranslation(protectedLayoutI18nNamespace);
  const home = <InlineLink to="/" />;

  useEffect(() => {
    document.title = t(($) => $.meta.title.template, {
      title: t(($) => $.serverError.documentTitle),
    });
  }, [t]);

  useEffect(() => {
    if (adobeAnalytics.isConfigured()) {
      adobeAnalytics.pushErrorEvent(500);
    }
  }, []);

  return (
    <>
      <PageHeader />
      <main className="container" property="mainContentOfPage" resource="#wb-main" typeof="WebPageElement">
        <PageTitle className="my-8">
          <span>{t(($) => $.serverError.pageTitle)}</span>
          <small className="block text-2xl font-normal text-neutral-500">{t(($) => $.serverError.pageSubtitle)}</small>
        </PageTitle>
        <p className="mb-8 text-lg text-gray-500">{t(($) => $.serverError.pageMessage)}</p>
        <ul className="list-disc space-y-2 pl-10">
          <li>{t(($) => $.serverError.option01)}</li>
          <li>
            <Trans ns={protectedLayoutI18nNamespace} i18nKey={($) => $.serverError.option02} components={{ home }} />
          </li>
        </ul>
        <PageDetails />
      </main>
      <PageFooter />
    </>
  );
}
