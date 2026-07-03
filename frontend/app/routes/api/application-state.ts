/**
 * An API route that can be used to perform actions with user's public application state.
 */
import * as z from 'zod';

import type { Route } from './+types/application-state';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import { createLogger } from '~/.server/logging';
import { savePublicApplicationState } from '~/.server/routes/helpers/public-application-route-helpers';
import type { ApplicationStateParams } from '~/.server/routes/helpers/public-application-route-helpers';

const API_APPLICATION_STATE_ACTIONS = ['extend'] as const;
export type ApiApplicationStateAction = (typeof API_APPLICATION_STATE_ACTIONS)[number];

export async function action({ context, request, url }: Route.ActionArgs) {
  const { appContainer, session } = context.get(appContext);
  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  securityHandler.validateRequestMethod({ request, allowedMethods: ['POST'] });

  const log = createLogger('routes/api/application-state');
  const sessionId = session.id;
  log.debug("Action with with user's application state; sessionId: [%s]", sessionId);

  const bodySchema = z.object({
    action: z.enum(API_APPLICATION_STATE_ACTIONS),
    id: z.string(),
  });

  const requestBody = await request.json();
  const parsedBody = bodySchema.safeParse(requestBody);

  if (!parsedBody.success) {
    log.debug('Invalid request body [%j]; sessionId: [%s]', requestBody, sessionId);
    return Response.json({ errors: z.flattenError(parsedBody.error).fieldErrors }, { status: 400 });
  }

  const params = {
    id: parsedBody.data.id,
    lang: 'en',
  } as const satisfies ApplicationStateParams;

  switch (parsedBody.data.action) {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    case 'extend': {
      log.debug("Extending user's application state; id: [%s], sessionId: [%s]", params.id, sessionId);
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
