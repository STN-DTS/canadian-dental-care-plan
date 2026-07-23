import { use, useEffect } from 'react';

import { Links, Meta, Outlet, Scripts, ScrollRestoration, useLocation, useRouteLoaderData } from 'react-router';

import { invariant } from '@dts-stn/invariant';
import { config as fontAwesomeConfig } from '@fortawesome/fontawesome-svg-core';
import { Trans, useTranslation } from 'react-i18next';

import type { Route } from './+types/root';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import { getFixedT, getLocale } from '~/.server/utils/locale-utils';
import { ClientEnv } from '~/components/client-env';
import { InlineLink } from '~/components/inline-link';
import { NonceContext } from '~/components/nonce-context';
import { PageTitle } from '~/components/page-title';
import { RouteChangeAnnouncer } from '~/components/route-change-announcer';
import { ZodConfig } from '~/components/zod-config';
import indexStyleSheet from '~/index.css?url';
import tailwindStyleSheet from '~/tailwind.css?url';
import * as adobeAnalytics from '~/utils/adobe-analytics.client';
import type { FeatureName } from '~/utils/env-utils';
import { useTransformAdobeAnalyticsUrl } from '~/utils/route-utils';
import { getDescriptionMetaTags, getTitleMetaTags, useAlternateLanguages, useCanonicalURL } from '~/utils/seo-utils';

// see: https://docs.fontawesome.com/web/dig-deeper/security#content-security-policy
fontAwesomeConfig.autoAddCss = false;

export const links: Route.LinksFunction = () => [
  { rel: 'stylesheet', href: indexStyleSheet }, //
  { rel: 'stylesheet', href: tailwindStyleSheet },
];

export const meta: Route.MetaFunction = ({ loaderData }) => {
  if (!loaderData) {
    return [];
  }

  return [
    ...getTitleMetaTags(loaderData.meta.title),
    ...getDescriptionMetaTags(loaderData.meta.description),
    { name: 'author', content: loaderData.meta.author },
    { name: 'dcterms.accessRights', content: '2' },
    { name: 'dcterms.creator', content: loaderData.meta.author },
    { name: 'dcterms.language', content: loaderData.meta.language },
    { name: 'dcterms.service', content: 'ESDC-EDSC_CDCP-RCSD' },
    { name: 'dcterms.spatial', content: 'Canada' },
    { name: 'dcterms.subject', content: loaderData.meta.subject },
    { name: 'robots', content: 'noindex' },
    { property: 'og:locale', content: loaderData.meta.locale },
    { property: 'og:site_name', content: loaderData.meta.siteName },
    { property: 'og:type', content: 'website' },
  ];
};

export const headers: Route.HeadersFunction = () => {
  return {
    'Cache-Control': 'private, no-cache, no-store, must-revalidate, max-age=0',
  };
};

export async function loader({ context, url }: Route.LoaderArgs) {
  const { appContainer, session } = context.get(appContext);
  const buildInfoService = appContainer.get(TYPES.BuildInfoService);
  const dynatraceService = appContainer.get(TYPES.DynatraceService);
  const locale = getLocale(url);
  const t = await getFixedT(url, 'gcweb');

  const buildInfo = buildInfoService.getBuildInfo();
  const dynatraceRumScript = await dynatraceService.findDynatraceRumScript();
  const env = appContainer.get(TYPES.ClientConfig);
  const meta = {
    author: t(($) => $.meta.author),
    description: t(($) => $.meta.description),
    language: locale === 'fr' ? 'fra' : 'eng',
    locale: `${locale}_CA`,
    siteName: t(($) => $.meta.siteName),
    subject: t(($) => $.meta.subject),
    title: t(($) => $.meta.title.default),
  };
  const origin = url.origin;
  const csrfToken = session.get('csrfToken');

  return {
    buildInfo,
    csrfToken,
    dynatraceRumScript,
    env,
    meta,
    origin,
  };
}

export default function App({ loaderData }: Route.ComponentProps) {
  const { dynatraceRumScript, env, origin } = loaderData;

  const { nonce } = use(NonceContext);
  const location = useLocation();
  const { i18n } = useTranslation();
  const canonicalURL = useCanonicalURL(origin);
  const alternateLanguages = useAlternateLanguages(origin);
  const transformAdobeAnalyticsUrl = useTransformAdobeAnalyticsUrl();

  useEffect(() => {
    if (adobeAnalytics.isConfigured()) {
      const locationUrl = new URL(location.pathname, origin);
      const adobeLocationUrl = transformAdobeAnalyticsUrl ? transformAdobeAnalyticsUrl(locationUrl) : locationUrl;
      adobeAnalytics.pushPageviewEvent(adobeLocationUrl);
    }
  }, [location.pathname, origin, transformAdobeAnalyticsUrl]);

  return (
    <html lang={i18n.language}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <link rel="canonical" href={canonicalURL} />
        {alternateLanguages.map(({ href, hrefLang }) => (
          <link key={hrefLang} rel="alternate" hrefLang={hrefLang} href={href} />
        ))}
        <Links nonce={nonce} />
        {dynatraceRumScript && <script src={dynatraceRumScript.src} data-dtconfig={dynatraceRumScript['data-dtconfig']} nonce={nonce} suppressHydrationWarning />}
        {env.ADOBE_ANALYTICS_SRC && env.ADOBE_ANALYTICS_JQUERY_SRC && (
          <>
            <script src={env.ADOBE_ANALYTICS_JQUERY_SRC} nonce={nonce} suppressHydrationWarning />
            <script src={env.ADOBE_ANALYTICS_SRC} nonce={nonce} suppressHydrationWarning />
          </>
        )}
      </head>
      <body vocab="https://schema.org/" typeof="WebPage">
        <RouteChangeAnnouncer />
        <Outlet />
        <ScrollRestoration nonce={nonce} />
        <ClientEnv env={env} nonce={nonce} />
        <ZodConfig nonce={nonce} />
        <Scripts nonce={nonce} />
      </body>
    </html>
  );
}

/**
 * A custom hook to retrieve the loader data for the 'root' route.
 *
 * @returns The loader data for the 'root' route, or `undefined` if not available.
 */
function useRootLoaderData() {
  const rootLoaderData = useRouteLoaderData<typeof loader>('root');
  invariant(rootLoaderData, 'Expected rootLoaderData to be defined');
  return rootLoaderData;
}

/**
 * A custom hook to retrieve client-side environment variables from the route loader data.
 *
 * @returns The `env` object containing client-side environment variables, or `undefined` if not available.
 */
export function useClientEnv() {
  const rootLoaderData = useRootLoaderData();
  return rootLoaderData.env;
}

/**
 * A custom hook to retrieve the CSRF token from the route loader data.
 *
 * @returns
 */
export function useCsrfToken() {
  const rootLoaderData = useRootLoaderData();
  return rootLoaderData.csrfToken;
}

/**
 * A custom hook to check if a feature is enabled.
 *
 * @param feature The name of the feature to check.
 * @returns `true` if the feature is enabled, `false` otherwise.
 */
export function useFeature(feature: FeatureName) {
  const clientEnv = useClientEnv();
  return clientEnv.ENABLED_FEATURES.includes(feature);
}

export function ErrorBoundary() {
  const { nonce } = use(NonceContext);
  const { i18n } = useTranslation();
  const en = i18n.getFixedT('en', 'gcweb');
  const fr = i18n.getFixedT('fr', 'gcweb');

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links nonce={nonce} />
      </head>
      <body vocab="https://schema.org/" typeof="WebPage">
        <header className="border-b-[3px] border-slate-700 print:hidden">
          <div id="wb-bnr">
            <div className="container flex items-center justify-between gap-6 py-2.5 sm:py-3.5">
              <div property="publisher" typeof="GovernmentOrganization">
                <a href="https://canada.ca/" property="url">
                  <img className="h-8 w-auto" src="/assets/sig-blk-en.svg" alt={`${en(($) => $.header.govtOfCanadaText)} / ${fr(($) => $.header.govtOfCanadaText)}`} property="logo" width="300" height="28" decoding="async" />
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
        <ZodConfig nonce={nonce} />
      </body>
    </html>
  );
}
