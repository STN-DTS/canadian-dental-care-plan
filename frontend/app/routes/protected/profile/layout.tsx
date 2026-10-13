import { Outlet } from 'react-router';

import type { JSX } from 'react/jsx-runtime';

import { clientApplicationMiddleware } from '~/middlewares/client-application.server';

import type { Route } from './+types/layout';

export const middleware: Route.MiddlewareFunction[] = [clientApplicationMiddleware];

export function ProfileLayout(): JSX.Element {
  return <Outlet />;
}
