import { ATTR_ERROR_TYPE } from '@opentelemetry/semantic-conventions';
// Session attributes are currently incubating OpenTelemetry conventions.
import { ATTR_SESSION_ID } from '@opentelemetry/semantic-conventions/incubating';
import * as z from 'zod';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import { createLogger } from '~/.server/logging';
/**
 * An API route that can be used to perform actions with user's public application state.
 */
import { ATTR_CDCP_APPLICATION_ID } from '~/.server/logging/log-attributes';
import { savePublicApplicationState } from '~/.server/routes/helpers/public-application-route-helpers';
import type { ApplicationStateParams } from '~/.server/routes/helpers/public-application-route-helpers';

import type { Route } from './+types/application-state';

const API_APPLICATION_STATE_ACTIONS = ['extend'] as const;
export type ApiApplicationStateAction = (typeof API_APPLICATION_STATE_ACTIONS)[number];

export async function action({ context, request, url }: Route.ActionArgs) {
  const { appContainer, session } = context.get(appContext);
  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  securityHandler.validateRequestMethod({ request, allowedMethods: ['POST'] });

  const log = createLogger('routes/api/application-state');
  const sessionId = session.id;
  log.debug('Handling public application state action', { [ATTR_SESSION_ID]: sessionId });

  const bodySchema = z.object({
    action: z.enum(API_APPLICATION_STATE_ACTIONS),
    id: z.string(),
  });

  const requestBody = await request.json();
  const parsedBody = bodySchema.safeParse(requestBody);

  if (!parsedBody.success) {
    log.debug('Invalid public application state request', { [ATTR_SESSION_ID]: sessionId, [ATTR_ERROR_TYPE]: 'invalid_application_state_request' });
    return Response.json({ errors: z.flattenError(parsedBody.error).fieldErrors }, { status: 400 });
  }

  const params = {
    id: parsedBody.data.id,
    lang: 'en',
  } as const satisfies ApplicationStateParams;

  switch (parsedBody.data.action) {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    case 'extend': {
      log.debug('Extending public application state', { [ATTR_CDCP_APPLICATION_ID]: params.id, [ATTR_SESSION_ID]: sessionId });
      savePublicApplicationState({ params, session, state: {} });
      return Response.json({
        status: 'success',
        message: 'Application state extended successfully.',
      });
    }

    default: {
      throw new Error(`Action '${parsedBody.data.action}' not implemented; sessionId: [${sessionId}]`);
    }
  }
}
