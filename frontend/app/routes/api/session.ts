/**
 * An API route that can be used to perform actions with user's server-side session.
 */
import { redirectDocument } from 'react-router';

import * as z from 'zod';

import type { Route } from './+types/session';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import { createLogger } from '~/.server/logging';
import { getApiSessionRedirectToUrl } from '~/.server/utils/api-session.utils';
import { APP_LOCALES } from '~/utils/locale-utils';

const API_SESSION_ACTIONS = ['end', 'extend'] as const;
export type ApiSessionAction = (typeof API_SESSION_ACTIONS)[number];

const API_SESSION_REDIRECT_TO_OPTIONS = ['cdcp-website', 'cdcp-website-apply', 'cdcp-website-renew', 'cdcp-website-status'] as const;
export type ApiSessionRedirectTo = (typeof API_SESSION_REDIRECT_TO_OPTIONS)[number];

export async function action({ context, request }: Route.ActionArgs) {
  const { appContainer, session } = context.get(appContext);
  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  securityHandler.validateRequestMethod({ request, allowedMethods: ['POST'] });

  const log = createLogger('routes/api/session');
  const sessionId = session.id;
  log.debug("Action with user's server-side session; sessionId: [%s]", sessionId);

  const bodySchema = z.object({
    action: z.enum(API_SESSION_ACTIONS),
    locale: z.enum(APP_LOCALES).optional() satisfies z.ZodType<AppLocale | null | undefined>,
    redirectTo: z.enum(API_SESSION_REDIRECT_TO_OPTIONS).optional(),
  });

  const requestBody = await request.json();
  const parsedBody = bodySchema.safeParse(requestBody);

  if (!parsedBody.success) {
    log.debug('Invalid request body [%j]; sessionId: [%s]', requestBody, sessionId);
    return Response.json({ errors: z.flattenError(parsedBody.error).fieldErrors }, { status: 400 });
  }

  const { action, locale = 'en', redirectTo } = parsedBody.data;

  switch (action) {
    case 'end': {
      log.debug("Ending user's server-side session; sessionId: [%s], locale: [%s], redirectTo: [%s]", sessionId, locale, redirectTo);

      await session.destroy();

      if (redirectTo) {
        const redirectToUrl = getApiSessionRedirectToUrl(redirectTo, locale);
        return redirectDocument(redirectToUrl);
      }

      return Response.json({
        status: 'success',
        message: 'Session has been terminated.',
      });
    }

    case 'extend': {
      log.debug("Extending user's server-side session lifetime; sessionId: [%s]", sessionId);
      return Response.json({
        status: 'success',
        message: 'Session extended successfully.',
      });
    }

    default: {
      throw new Error(`Action '${parsedBody.data.action}' not implemented; sessionId: [${sessionId}]`);
    }
  }
}
