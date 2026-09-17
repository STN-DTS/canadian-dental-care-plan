import { Outlet } from 'react-router';

import type { JSX } from 'react/jsx-runtime';

import type { Route } from './+types/layout';

import { clientApplicationMiddleware } from '~/middlewares/client-application.server';

export const middleware: Route.MiddlewareFunction[] = [clientApplicationMiddleware];

export function ProfileLayout(): JSX.Element {
  return <Outlet />;
}
