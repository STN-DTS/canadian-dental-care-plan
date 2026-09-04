import type { PropsWithChildren } from 'react';
import { useEffect } from 'react';

import { Link } from 'react-router';

import type { Namespace } from 'i18next';
import { Trans, useTranslation } from 'react-i18next';

import { Banner } from '~/components/banner';
import { PublicBreadcrumbs } from '~/components/breadcrumbs';
import { BrowserCompatibilityBanner } from '~/components/browser-compatibility-banner';
import { InlineLink } from '~/components/inline-link';
import { PageDetails } from '~/components/page-details';
import { PageHeaderBrand } from '~/components/page-header-brand';
import { PageTitle } from '~/components/page-title';
import { SkipNavigationLinks } from '~/components/skip-navigation-links';
import { useCurrentLanguage, useFeature } from '~/hooks';
import * as adobeAnalytics from '~/utils/adobe-analytics.client';
import { getClientEnv } from '~/utils/env-utils';
import { useLayoutOptions } from '~/utils/route-utils';

export const publicLayoutI18nNamespace = 'gcweb' satisfies Namespace;
/**
 * GCWeb Application page template.
 * see: https://wet-boew.github.io/GCWeb/templates/application/application-docs-en.html
 */
export function PublicLayout({ children }: PropsWithChildren) {
  const { breadcrumbs } = useLayoutOptions();
  return (
    <>
      <PageHeader />
      <div className="my-4 print:hidden">{breadcrumbs ?? <PublicBreadcrumbs />}</div>
      <main className="container" property="mainContentOfPage" resource="#wb-main" typeof="WebPageElement">
        {children}
        <PageDetails />
      </main>
      <PageFooter />
    </>
  );
}

function PageHeader() {
  const { currentLanguage } = useCurrentLanguage();
  const { t } = useTranslation(publicLayoutI18nNamespace);
  const { HEADER_LOGO_URL_EN, HEADER_LOGO_URL_FR } = getClientEnv();

  // Select the correct logo URL based on the current language
  const headerLogoUrl = currentLanguage === 'fr' ? HEADER_LOGO_URL_FR : HEADER_LOGO_URL_EN;

  return (
    <header className="border-b-[3px] border-slate-700 print:hidden">
      <SkipNavigationLinks />
      <BrowserCompatibilityBanner />
      {useFeature('show-prototype-banner') && <Banner alert={t(($) => $.header.banner.alert)} description={t(($) => $.header.banner.desc)} />}
      <PageHeaderBrand headerLogoUrl={headerLogoUrl} />
    </header>
  );
}

function PageFooter() {
  const { t } = useTranslation('gcweb');
  return (
    <footer id="wb-info" tabIndex={-1} className="bg-stone-50 print:hidden">
      <div className="bg-gray-700 text-white">
        <section className="container py-6">
          <h2 className="mb-4">{t(($) => $.footer.mainBand.header.public)}</h2>
          <div className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
            <Link className="hover:underline" to={t(($) => $.footer.mainBand.links.contactUs.publicHref)} data-gc-analytics-navigation={`Footer:Footer:${t(($) => $.footer.mainBand.links.contactUs.content)}`}>
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
              <Link className="text-slate-700 hover:underline" to={t(($) => $.footer.termsConditions.publicHref)} data-gc-analytics-navigation={`Footer:Footer:${t(($) => $.footer.termsConditions.text)}`}>
                {t(($) => $.footer.termsConditions.text)}
              </Link>
              <div className="hidden size-0 rounded-full border-[3px] border-slate-700 sm:block"></div>
              <Link className="text-slate-700 hover:underline" to={t(($) => $.footer.privacy.publicHref)} data-gc-analytics-navigation={`Footer:Footer:${t(($) => $.footer.privacy.text)}`}>
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

interface BilingualNotFoundErrorProps {
  error?: unknown;
}

/**
 * A 404 page that renders both languages, for when the user's language cannot be detected
 */
export function BilingualNotFoundError({ error }: BilingualNotFoundErrorProps) {
  const { i18n } = useTranslation();
  const en = i18n.getFixedT('en', 'gcweb');
  const fr = i18n.getFixedT('fr', 'gcweb');

  useEffect(() => {
    if (adobeAnalytics.isConfigured()) {
      adobeAnalytics.pushErrorEvent(404);
    }
  }, []);

  return (
    <>
      <header className="border-b-[3px] border-slate-700 print:hidden">
        <div id="wb-bnr">
          <div className="container flex items-center justify-between gap-6 py-2.5 sm:py-3.5">
            <div property="publisher" typeof="GovernmentOrganization">
              <a href="https://canada.ca/" property="url">
                <img className="h-8 w-auto" src="/assets/sig-blk-en.svg" alt={en(($) => $.header.govtOfCanadaText)} property="logo" width="300" height="28" decoding="async" />
                <span className="sr-only">
                  / <span lang="fr">{fr(($) => $.header.govtOfCanadaText)}</span>
                </span>
              </a>
              <meta property="name" content={`${en(($) => $.header.govtOfCanadaText)} / ${fr(($) => $.header.govtOfCanadaText)}`} />
              <meta property="areaServed" typeof="Country" content="Canada" />
              <link property="logo" href="/assets/wmms-blk.svg" />
            </div>
          </div>
        </div>
      </header>
      <main className="container" property="mainContentOfPage" resource="#wb-main" typeof="WebPageElement">
        <div className="grid grid-cols-1 gap-6 py-2.5 sm:grid-cols-2 sm:py-3.5">
          <div id="english" lang="en">
            <PageTitle className="my-8">
              <span>{en(($) => $.publicNotFound.pageTitle)}</span>
              <small className="block text-2xl font-normal text-neutral-500">{en(($) => $.publicNotFound.pageSubtitle)}</small>
            </PageTitle>
            <p className="mb-8 text-lg text-gray-500">{en(($) => $.publicNotFound.pageMessage)}</p>
            <ul className="list-disc space-y-2 pl-10">
              <li>
                <Trans t={en} i18nKey={($) => $.publicNotFound.returnCdcp} components={{ englishCdcpLink: <InlineLink to={en(($) => $.publicNotFound.cdcpLink)} className="external-link" newTabIndicator target="_blank" /> }} />
              </li>
            </ul>
          </div>
          <div id="french" lang="fr">
            <PageTitle className="my-8">
              <span>{fr(($) => $.publicNotFound.pageTitle)}</span>
              <small className="block text-2xl font-normal text-neutral-500">{fr(($) => $.publicNotFound.pageSubtitle)}</small>
            </PageTitle>
            <p className="mb-8 text-lg text-gray-500">{fr(($) => $.publicNotFound.pageMessage)}</p>
            <ul className="list-disc space-y-2 pl-10">
              <li>
                <Trans t={fr} i18nKey={($) => $.publicNotFound.returnCdcp} components={{ frenchCdcpLink: <InlineLink to={fr(($) => $.publicNotFound.cdcpLink)} className="external-link" newTabIndicator target="_blank" /> }} />
              </li>
            </ul>
          </div>
        </div>
      </main>
      <footer id="wb-info" tabIndex={-1} className="bg-stone-50 print:hidden">
        <div className="container flex items-center justify-end gap-6 py-2.5 sm:py-3.5">
          <div>
            <h2 className="sr-only">
              <span lang="en">{en(($) => $.footer.aboutSite)}</span> / <span lang="fr">{fr(($) => $.footer.aboutSite)}</span>
            </h2>
            <div>
              <img src="/assets/wmms-blk.svg" alt={`${en(($) => $.footer.gcSymbol)} / ${fr(($) => $.footer.gcSymbol)}`} width={300} height={71} className="h-10 w-auto" />
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}

interface NotFoundErrorProps {
  error?: unknown;
}

export function NotFoundError({ error }: NotFoundErrorProps) {
  const { t } = useTranslation(publicLayoutI18nNamespace);
  const cdcpLink = <InlineLink to={t(($) => $.publicNotFound.cdcpLink)} className="external-link" newTabIndicator target="_blank" />;

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
          <span>{t(($) => $.publicNotFound.pageTitle)}</span>
          <small className="block text-2xl font-normal text-neutral-500">{t(($) => $.publicNotFound.pageSubtitle)}</small>
        </PageTitle>
        <p className="mb-8 text-lg text-gray-500">{t(($) => $.publicNotFound.pageMessage)}</p>
        <ul className="list-disc space-y-2 pl-10">
          <li>
            <Trans ns={publicLayoutI18nNamespace} i18nKey={($) => $.publicNotFound.unilingualReturnCdcp} components={{ cdcpLink }} />
          </li>
        </ul>
        <PageDetails />
      </main>
      <PageFooter />
    </>
  );
}

interface BilingualServerErrorProps {
  error: unknown;
}

export function BilingualServerError({ error }: BilingualServerErrorProps) {
  const { i18n } = useTranslation();
  const en = i18n.getFixedT('en', 'gcweb');
  const fr = i18n.getFixedT('fr', 'gcweb');

  useEffect(() => {
    if (adobeAnalytics.isConfigured()) {
      adobeAnalytics.pushErrorEvent(500);
    }
  }, []);

  useEffect(() => {
    document.title = en(($) => $.meta.title.template, { ns: 'gcweb', title: en(($) => $.serverError.documentTitle) });
  }, [en]);

  return (
    <>
      <header className="border-b-[3px] border-slate-700 print:hidden">
        <div id="wb-bnr">
          <div className="container flex items-center justify-between gap-6 py-2.5 sm:py-3.5">
            <div property="publisher" typeof="GovernmentOrganization">
              <a href="https://canada.ca/" property="url">
                <img className="h-8 w-auto" src="/assets/sig-blk-en.svg" alt={en(($) => $.header.govtOfCanadaText)} property="logo" width="300" height="28" decoding="async" />
                <span className="sr-only">
                  / <span lang="fr">{fr(($) => $.header.govtOfCanadaText)}</span>
                </span>
              </a>
              <meta property="name" content={`${en(($) => $.header.govtOfCanadaText)} / ${fr(($) => $.header.govtOfCanadaText)}`} />
              <meta property="areaServed" typeof="Country" content="Canada" />
              <link property="logo" href="/assets/wmms-blk.svg" />
            </div>
          </div>
        </div>
      </header>
      <main className="container" property="mainContentOfPage" resource="#wb-main" typeof="WebPageElement">
        <div className="grid grid-cols-1 gap-6 py-2.5 sm:grid-cols-2 sm:py-3.5">
          <div id="english" lang="en">
            <PageTitle className="my-8">
              <span>{en(($) => $.serverError.pageTitle)}</span>
              <small className="block text-2xl font-normal text-neutral-500">{en(($) => $.serverError.pageSubtitle)}</small>
            </PageTitle>
            <p className="mb-8 text-lg text-gray-500">{en(($) => $.serverError.pageMessage)}</p>
            <ul className="list-disc space-y-2 pl-10">
              <li>{en(($) => $.serverError.option01)}</li>
              <li>
                <Trans t={en} i18nKey={($) => $.serverError.option02} components={{ home: <InlineLink to="/" /> }} />
              </li>
            </ul>
          </div>
          <div id="french" lang="fr">
            <PageTitle className="my-8">
              <span>{fr(($) => $.serverError.pageTitle)}</span>
              <small className="block text-2xl font-normal text-neutral-500">{fr(($) => $.serverError.pageSubtitle)}</small>
            </PageTitle>
            <p className="mb-8 text-lg text-gray-500">{fr(($) => $.serverError.pageMessage)}</p>
            <ul className="list-disc space-y-2 pl-10">
              <li>{fr(($) => $.serverError.option01)}</li>
              <li>
                <Trans t={fr} i18nKey={($) => $.serverError.option02} components={{ home: <InlineLink to="/" /> }} />
              </li>
            </ul>
          </div>
        </div>
      </main>
      <footer id="wb-info" tabIndex={-1} className="bg-stone-50 print:hidden">
        <div className="container flex items-center justify-end gap-6 py-2.5 sm:py-3.5">
          <div>
            <h2 className="sr-only">
              <span lang="en">{en(($) => $.footer.aboutSite)}</span> / <span lang="fr">{fr(($) => $.footer.aboutSite)}</span>
            </h2>
            <div>
              <img src="/assets/wmms-blk.svg" alt={`${en(($) => $.footer.gcSymbol)} / ${fr(($) => $.footer.gcSymbol)}`} width={300} height={71} className="h-10 w-auto" />
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}

interface ServerErrorProps {
  error: unknown;
}

export function ServerError({ error }: ServerErrorProps) {
  const { t } = useTranslation(publicLayoutI18nNamespace);
  const home = <InlineLink to="/" />;

  useEffect(() => {
    document.title = t(($) => $.meta.title.template, { ns: 'gcweb', title: t(($) => $.serverError.documentTitle) });
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
            <Trans ns={publicLayoutI18nNamespace} i18nKey={($) => $.serverError.option02} components={{ home }} />
          </li>
        </ul>
        <PageDetails />
      </main>
      <PageFooter />
    </>
  );
}
