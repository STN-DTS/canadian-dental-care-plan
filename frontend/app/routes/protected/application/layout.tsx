import { Outlet } from 'react-router';

import { useApplicationFlowCheck } from '~/hooks/use-application-flow-check';
import { getPathById } from '~/utils/route-utils';

import type { Route } from './+types/layout';

/**
 * This layout component is responsible for enforcing the application flow on all protected application routes except
 * the index page. It uses the `useApplicationFlowCheck` hook to check if the application flow is active and redirects
 * to the index page if it's not. The `Outlet` component renders the matched child route component.
 */
export default function ProtectedApplicationLayout({ params }: Route.ComponentProps) {
  useApplicationFlowCheck({
    id: params.id,
    indexRoutePath: getPathById('protected/application/index', params),
  });
  return <Outlet />;
}
