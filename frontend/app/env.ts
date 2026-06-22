/* eslint-disable @typescript-eslint/no-empty-object-type */
import type { Namespace } from 'i18next';

import type { AppContainerProvider } from '~/.server/app-container.provider';
import type { Session } from '~/.server/web/session';

declare module 'react-router' {
  interface RouterContextProvider {
    appContainer: AppContainerProvider;
    session: Session;
  }

  /**
   * Route handles should export an i18n namespace, if necessary.
   */
  interface RouteHandle {
    i18nNamespace?: Namespace;
  }

  /**
   * A route module exports an optional RouteHandle.
   */
  interface RouteModule {
    handle?: RouteHandle;
  }

  /**
   * Override the default React Router RouteModules
   * to include the new RouteModule type.
   */
  interface RouteModules extends Record<string, RouteModule | undefined> {}
}

export {}; // necessary for TS to treat this as a module
