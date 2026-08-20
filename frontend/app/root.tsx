import { use, useEffect } from 'react';

import { Links, Meta, Outlet, Scripts, ScrollRestoration, isRouteErrorResponse, useLocation, useRouteLoaderData } from 'react-router';

import { invariant } from '@dts-stn/invariant';
import { config as fontAwesomeConfig } from '@fortawesome/fontawesome-svg-core';
import { useTranslation } from 'react-i18next';
import { useAuthenticityToken } from 'remix-utils/csrf/react';

import type { Route } from './+types/root';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import { getFixedT, getLocale } from '~/.server/utils/locale-utils';
import { ClientEnv } from '~/components/client-env';
import { BilingualNotFoundError, BilingualServerError, NotFoundError, ServerError } from '~/components/layouts/public-layout';
import { NonceContext } from '~/components/nonce-context';
import { RouteChangeAnnouncer } from '~/components/route-change-announcer';
import { TooltipProvider } from '~/components/tooltip';
import { ZodConfig } from '~/components/zod-config';
import { useNProgress } from '~/hooks/use-nprogress';
import indexStyleSheet from '~/index.css?url';
import tailwindStyleSheet from '~/tailwind.css?url';
import * as adobeAnalytics from '~/utils/adobe-analytics.client';
import { ClientHintCheck, getHints } from '~/utils/client-hints';
import type { FeatureName } from '~/utils/env-utils';
import { isAppLocale } from '~/utils/locale-utils';
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

export async function loader({ context, request, url }: Route.LoaderArgs) {
  const { appContainer } = context.get(appContext);
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

  return {
    buildInfo,
    dynatraceRumScript,
    env,
    hints: getHints(request),
    meta,
    origin,
  };
}

export default function App({ loaderData }: Route.ComponentProps) {
  const { dynatraceRumScript, env, origin } = loaderData;

  useNProgress();

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
        <ClientHintCheck nonce={nonce} />
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
        <TooltipProvider>
          <Outlet />
        </TooltipProvider>
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
 * Retrieves client hints from the root route loader data.
 *
 * @returns The client hints detected for the current request.
 */
export function useHints() {
  const rootLoaderData = useRootLoaderData();
  return rootLoaderData.hints;
}

/**
 * Returns the current CSRF authenticity token from the `remix-utils` CSRF context.
 * Use the token when submitting form data that requires CSRF validation.
 *
 * @returns The current CSRF authenticity token.
 */
export function useCsrfToken() {
  return useAuthenticityToken();
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

export function ErrorBoundary({ error, params }: Route.ErrorBoundaryProps) {
  const { nonce } = use(NonceContext);

  const hasAppLocale = isAppLocale(params.lang);
  const locale = hasAppLocale ? params.lang : 'en';

  // Default to ServerError or BilingualServerError based on the presence of a valid app locale
  let errorComponent = hasAppLocale ? <ServerError error={error} /> : <BilingualServerError error={error} />;

  // If the error is a 404 Not Found, use the appropriate NotFoundError component based on the presence of a valid app locale
  if (isRouteErrorResponse(error) && error.status === 404) {
    errorComponent = hasAppLocale ? <NotFoundError error={error} /> : <BilingualNotFoundError error={error} />;
  }

  return (
    <html lang={locale}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links nonce={nonce} />
      </head>
      <body vocab="https://schema.org/" typeof="WebPage">
        {errorComponent}
        <ZodConfig nonce={nonce} />
      </body>
    </html>
  );
}
