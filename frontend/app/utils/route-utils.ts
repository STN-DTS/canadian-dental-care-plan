import type { ReactNode } from 'react';

import type { Params } from 'react-router';
import { generatePath, useMatches } from 'react-router';

import { invariant } from '@dts-stn/invariant';
import type { Namespace } from 'i18next';
import * as z from 'zod';

import type { I18nPageRoute, I18nRoute, Language } from '~/routes/routes';
import { i18nRoutes, isI18nLayoutRoute, isI18nPageRoute } from '~/routes/routes';

/**
 * A reducer function that coalesces two values, returning the non-null (or non-undefined) value.
 */
export const coalesce = <T>(previousValue?: T, currentValue?: T) => currentValue ?? previousValue;

const buildInfoSchema = z
  .object({
    buildDate: z.string(),
    buildId: z.string(),
    buildRevision: z.string(),
    buildVersion: z.string(),
  })
  .readonly();

const pageIdentifierSchema = z.string().readonly();

export type BuildInfo = z.infer<typeof buildInfoSchema>;

export type TransformAdobeAnalyticsUrl = (url: string | URL) => URL;

export type PageIdentifier = z.infer<typeof pageIdentifierSchema>;

/**
 * Options that control how layout components render their structure.
 * These options are merged from parent to leaf routes, allowing child routes to override parent values.
 */
export interface LayoutOptions {
  /**
   * Breadcrumbs to render in the layout. Route handles provide a `<Breadcrumbs>` ReactNode here,
   * which the layout renders directly — replacing the previous array-based breadcrumb approach.
   * @default undefined
   */
  breadcrumbs?: ReactNode;
}

/**
 * Common data returned from a route's handle object.
 */
export interface RouteHandleData extends Record<string, unknown | undefined> {
  /**
   * Namespaces to preload into i18next during server-side initialization.
   *
   * React Router collects `i18nPreloadNamespace` from all matched route handles
   * before the first render, building the complete set of namespaces needed for
   * the current page. This ensures all translation keys are available before
   * hydration without additional round-trips.
   *
   * - Layout routes declare all namespaces their subtree may need.
   * - Leaf routes that fall outside a layout's coverage declare their own.
   * - Routes fully covered by a parent layout may omit this property.
   */
  i18nPreloadNamespace?: Namespace;

  pageIdentifier?: PageIdentifier;

  /**
   * Layout options merged from parent to leaf routes.
   * Child route values override parent values; unset properties are inherited from parents.
   */
  layoutOptions?: Partial<LayoutOptions>;

  /**
   * Optional function to transform Adobe Analytics URLs. If provided, this function will be used by the
   * `useTransformAdobeAnalyticsUrl` hook to transform URLs for Adobe Analytics tracking.
   */
  transformAdobeAnalyticsUrl?: TransformAdobeAnalyticsUrl;
}

export function useBuildInfo() {
  return useMatches()
    .map(({ loaderData }) => loaderData as { buildInfo?: BuildInfo } | undefined)
    .map((data) => buildInfoSchema.safeParse(data?.buildInfo))
    .map((result) => (result.success ? result.data : undefined))
    .reduce(coalesce);
}

export function useTransformAdobeAnalyticsUrl() {
  return useMatches()
    .map(({ handle }) => handle as RouteHandleData | undefined)
    .map((handle) => handle?.transformAdobeAnalyticsUrl)
    .reduce(coalesce);
}

export function useI18nPreloadNamespaces() {
  const namespaces = useMatches()
    .map(({ handle }) => handle as RouteHandleData | undefined)
    .flatMap((handle) => handle?.i18nPreloadNamespace)
    .filter((ns) => ns !== undefined);
  return [...new Set(namespaces)];
}

export function usePageIdentifier() {
  return useMatches()
    .map(({ handle }) => handle as RouteHandleData | undefined)
    .map((handle) => pageIdentifierSchema.safeParse(handle?.pageIdentifier))
    .map((result) => (result.success ? result.data : undefined))
    .reduce(coalesce);
}

export function useLayoutOptions(): LayoutOptions {
  // Initialize default layout options to be used as the base for
  // merging with route-specific options.
  const defaultOptions: LayoutOptions = {};
  return useMatches()
    .map(({ handle }) => handle as RouteHandleData | undefined)
    .map((handle) => handle?.layoutOptions)
    .filter((options) => options !== undefined)
    .reduce<LayoutOptions>((merged, current) => {
      return Object.assign<LayoutOptions, Partial<LayoutOptions>>(merged, current);
    }, defaultOptions);
}

export function findRouteById(id: string, routes: I18nRoute[] = i18nRoutes): I18nPageRoute | undefined {
  for (const route of routes) {
    if (isI18nPageRoute(route) && route.id === id) {
      return route;
    }

    if (isI18nLayoutRoute(route)) {
      const matchingRoute = findRouteById(id, route.children);
      if (matchingRoute) return matchingRoute;
    }
  }
}

export function getPathById(id: string, params: Params = {}): string {
  const { lang = 'en' } = params as { lang?: Language };

  const route = findRouteById(id);
  const path = route?.paths[lang];
  invariant(path, `path not found for route [${id}] and language [${lang}]`);

  return generatePath(path, params);
}
