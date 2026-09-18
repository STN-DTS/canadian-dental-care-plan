import { Outlet } from 'react-router';

import type { JSX } from 'react/jsx-runtime';

import type { Route } from './+types/layout';

import { applicantMiddleware } from '~/middlewares/applicant.server';
import { createFeatureMiddleware } from '~/middlewares/feature.server';

/**
 * Protects letter routes with the view-letters feature flag and program applicant resolution.
 * Middleware runs in declaration order, so feature validation precedes applicant resolution.
 */
export const middleware: Route.MiddlewareFunction[] = [createFeatureMiddleware('view-letters'), applicantMiddleware];

export function LettersLayout(): JSX.Element {
  return <Outlet />;
}
