import { ATTR_ERROR_TYPE } from '@opentelemetry/semantic-conventions';
// Session attributes are currently incubating OpenTelemetry conventions.
import { ATTR_SESSION_ID } from '@opentelemetry/semantic-conventions/incubating';
import * as z from 'zod';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import { createLogger } from '~/.server/logging';
/**
 * An API route that can be used to perform actions with user's protected application state.
 */
import { ATTR_CDCP_APPLICATION_ID } from '~/.server/logging/log-attributes';
import { saveProtectedApplicationState } from '~/.server/routes/helpers/protected-application-route-helpers';
import type { ApplicationStateParams } from '~/.server/routes/helpers/protected-application-route-helpers';
import { authMiddleware } from '~/middlewares/auth.server';

import type { Route } from './+types/protected-application-state';

const API_PROTECTED_APPLICATION_STATE_ACTIONS = ['extend'] as const;
export type ApiProtectedApplicationStateAction = (typeof API_PROTECTED_APPLICATION_STATE_ACTIONS)[number];

export const middleware: Route.MiddlewareFunction[] = [authMiddleware];

export async function action({ context, request, url }: Route.ActionArgs) {
  const { appContainer, session } = context.get(appContext);
  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  securityHandler.validateRequestMethod({ request, allowedMethods: ['POST'] });

  const log = createLogger('routes/api/protected-application-state');
  const sessionId = session.id;
  log.debug('Handling protected application state action', { [ATTR_SESSION_ID]: sessionId });

  const bodySchema = z.object({
    action: z.enum(API_PROTECTED_APPLICATION_STATE_ACTIONS),
    id: z.string(),
  });

  const requestBody = await request.json();
  const parsedBody = bodySchema.safeParse(requestBody);

  if (!parsedBody.success) {
    log.debug('Invalid protected application state request', { [ATTR_SESSION_ID]: sessionId, [ATTR_ERROR_TYPE]: 'invalid_application_state_request' });
    return Response.json({ errors: z.flattenError(parsedBody.error).fieldErrors }, { status: 400 });
  }

  const params = {
    id: parsedBody.data.id,
    lang: 'en',
  } as const satisfies ApplicationStateParams;

  switch (parsedBody.data.action) {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    case 'extend': {
      log.debug('Extending protected application state', { [ATTR_CDCP_APPLICATION_ID]: params.id, [ATTR_SESSION_ID]: sessionId });
      saveProtectedApplicationState({ params, session, state: {} });
      return Response.json({
        status: 'success',
        message: 'Protected application state extended successfully.',
      });
    }

    default: {
      throw new Error(`Action '${parsedBody.data.action}' not implemented; sessionId: [${sessionId}]`);
    }
  }
}
