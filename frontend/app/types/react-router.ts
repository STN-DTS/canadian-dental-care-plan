import type { UNSAFE_RouteModules } from 'react-router';

import type { Namespace } from 'i18next';

declare module 'react-router' {
  /**
   * Route handles should export an i18n namespace, if necessary.
   */
  interface RouteHandle {
    i18nNamespace?: Namespace;
  }

  /**
   * React Router's client route module, with `handle` typed as the app's RouteHandle. React Router keeps its own
   * `RouteModule` internal (with `handle: unknown`), so derive it from the exported `UNSAFE_RouteModules`.
   */
  interface RouteModule extends Omit<NonNullable<UNSAFE_RouteModules[string]>, 'handle'> {
    handle?: RouteHandle;
  }
}
