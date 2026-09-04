/**
 * By default, Remix will handle hydrating your app on the client for you.
 * You are free to delete this file if you'd like to, but if you ever want it revealed again, you can run `npx remix reveal` ✨
 * For more information, see https://remix.run/file-conventions/entry.client
 */
import { StrictMode, startTransition } from 'react';
import { hydrateRoot } from 'react-dom/client';

import { HydratedRouter } from 'react-router/dom';

import type { i18n } from 'i18next';
import { I18nextProvider } from 'react-i18next';

import { ClientEnvProvider } from '~/components/client-env-context';
import { getClientEnv } from '~/utils/env-utils';
import { getNamespaces, initI18n } from '~/utils/locale-utils';

function hydrateDocument(i18n: i18n): void {
  const env = getClientEnv();

  hydrateRoot(
    document,
    <StrictMode>
      <I18nextProvider i18n={i18n}>
        <ClientEnvProvider env={env}>
          <HydratedRouter />
        </ClientEnvProvider>
      </I18nextProvider>
    </StrictMode>,
  );
}

startTransition(() => {
  const routeModules = Object.values(globalThis.__reactRouterRouteModules);
  const routes = routeModules.filter((routeModule) => routeModule !== undefined);
  void initI18n(getNamespaces(routes)).then(hydrateDocument);
});
