import { Outlet } from 'react-router';

import type { JSX } from 'react/jsx-runtime';

import type { Route } from './+types/layout';

import { applicantMiddleware } from '~/middlewares/applicant.server';
import { createFeatureMiddleware } from '~/middlewares/feature.server';

/**
 * Protects document routes with the document-upload feature flag and applicant resolution.
 * Middleware runs in declaration order, so feature validation precedes applicant resolution.
 */
export const middleware: Route.MiddlewareFunction[] = [createFeatureMiddleware('doc-upload'), applicantMiddleware];

export function DocumentsLayout(): JSX.Element {
  return <Outlet />;
}
