import { Outlet } from 'react-router';

/**
 * Public layout for routes that do not require an authenticated session.
 *
 * Keep authentication and session-timeout behavior out of this layout. Add
 * shared public-route UI or behavior here when a future public route needs it;
 * use a child layout when behavior applies only to one public route group.
 */
export default function Layout() {
  return <Outlet />;
}
