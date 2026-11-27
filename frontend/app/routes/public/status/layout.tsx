import { Outlet } from 'react-router';

import { PublicLayout } from '~/components/layouts/public-layout';
import type { RouteHandleData } from '~/utils/route-utils';

export const handle = {
  // Declare all i18n namespaces required by this route and its descendants.
  // Preloading them upfront ensures translations are available on initial render.
  i18nPreloadNamespace: ['gcweb', 'status'],
} as const satisfies RouteHandleData;

export default function Route() {
  return (
    <PublicLayout>
      <Outlet />
    </PublicLayout>
  );
}
