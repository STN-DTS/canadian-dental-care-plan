//
// XXX :: GjB :: the contents of this file should probably live in app/routes.ts,
//               but can't because of https://github.com/remix-run/remix/issues/10227
//
//               to work around that issue the i18n routes are moved to a separate
//               file that doesn't import '@remix-run/route-config'
//
// note: because the routes are processed at build time by vite,
//       we cannot use aliased imports (ie: ~/) here
import type { RouteConfig } from '@react-router/dev/routes';

import { routes as apiRoutes } from './api/routes';
import { routes as authRoutes } from './auth/routes';
import { routes as oidcRoutes } from './oidc/routes';
import { routes as protectedRoutes } from './protected/routes';
import { routes as publicRoutes } from './public/routes';

export type Language = 'en' | 'fr';
export type I18nRoute = I18nLayoutRoute | I18nPageRoute;
export type I18nLayoutRoute = { file: string; children: I18nRoute[] };
export type I18nPageRoute = { file: string; id: string; paths: I18nPaths };
export type I18nPaths = Record<Language, string>;

// Extract the route IDs from the i18nRoutes config to create a union type of valid route IDs for localized routes.
// type I18nRouteId = ExtractI18nRouteIds<(typeof i18nRoutes)[number]>;
// type ExtractI18nRouteId<T> = T extends I18nPageRoute ? T['id'] : never;
// type ExtractI18nRouteIds<T, Filter = void> = T extends I18nLayoutRoute //
//   ? ExtractI18nRouteIds<T['children'][number], Filter>
//   : ExtractI18nRouteId<T>;

/**
 * Type guard to determine if a route is an I18nLayoutRoute.
 */
export function isI18nLayoutRoute(obj: unknown): obj is I18nLayoutRoute {
  return obj !== null && typeof obj === 'object' && 'file' in obj && 'children' in obj;
}

/**
 * Type guard to determine if a route is an I18nPageRoute.
 */
export function isI18nPageRoute(obj: unknown): obj is I18nPageRoute {
  return obj !== null && typeof obj === 'object' && 'file' in obj && 'id' in obj && 'paths' in obj;
}

/**
 * Route config for unlocalized routes.
 */
export const routes = [
  ...apiRoutes, //
  ...authRoutes,
  ...oidcRoutes,
] as const satisfies RouteConfig;

/**
 * Route config for localized routes.
 */
export const i18nRoutes = [
  {
    file: 'routes/localized-layout.tsx',
    children: [
      ...publicRoutes, //
      ...protectedRoutes,
    ],
  },
] as const satisfies I18nRoute[];
