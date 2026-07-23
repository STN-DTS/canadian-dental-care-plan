import { data } from 'react-router';

import type { Namespace } from 'i18next';

import type { Route } from './+types/locales';

import { initI18n } from '~/.server/utils/locale-utils';

export async function loader({ context, params, url }: Route.LoaderArgs) {
  const language = params.lng;
  const namespace = params.ns;

  if (!language || !namespace) {
    return Response.json(
      { message: 'You must provide a language (lng) and namespace (ns)' }, //
      { status: 400 },
    );
  }

  const i18next = await initI18n(language, namespace as Namespace);

  if (!i18next.hasResourceBundle(language, namespace)) {
    return Response.json(
      { message: 'No resource bundle found for this language and namespace' }, //
      { status: 404 },
    );
  }

  const resourceBundle = i18next.getResourceBundle(language, namespace);
  const headers = new Headers();

  // On production, we want to add cache headers to the response
  if (process.env.NODE_ENV === 'production') {
    // Cache the requested resource bundle for 1 week to limit potential staleness
    const CACHE_DURATION_SECS = 7 * 24 * 60 * 60;
    headers.set('Cache-Control', `max-age=${CACHE_DURATION_SECS}, immutable`);
  }

  return data(resourceBundle, { headers });
}
