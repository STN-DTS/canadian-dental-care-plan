import { Option } from 'effect';

import { findUser } from '~/.server/context/user-context';
import { ATTR_CDCP_USER_ID } from '~/.server/logging/log-attributes';

/**
 * Returns the `cdcp.user.id` log attribute for the authenticated request user.
 *
 * Returns no attributes outside an authenticated request scope (for example, public routes,
 * health checks or background work). Spread the result into the log attributes:
 * `this.log.trace('Message', { ...userLogAttributes(), [ATTR_OTHER]: value })`.
 */
export function userLogAttributes(): { [ATTR_CDCP_USER_ID]?: string } {
  return Option.match(findUser(), {
    onNone: () => ({}),
    onSome: (user) => ({ [ATTR_CDCP_USER_ID]: user.id }),
  });
}
