import { redirect } from 'react-router';

import type { Route } from './+types/upload-form';

import { appContext } from '~/.server/context';
import { getDocumentUploadSubmittedUrl, loadDocumentUploadState } from '~/.server/routes/helpers/document-upload-route-helpers';

/**
 * Prevents finished upload flows from reaching the form loader or action.
 * @param args - The route context and localized flow parameters.
 * @param next - Runs downstream middleware and the route handler for an open flow.
 * @returns The downstream result for an open flow.
 * @throws A confirmation redirect for a finished flow, or HTTP 404 for a missing or invalid flow.
 */
const finishedUploadMiddleware: Route.MiddlewareFunction = async ({ context, params }, next) => {
  const { session } = context.get(appContext);
  const uploadState = loadDocumentUploadState({ id: params.id, params, session });

  if (uploadState.status === 'finished') {
    throw redirect(getDocumentUploadSubmittedUrl(uploadState.id, params));
  }

  return await next();
};

/** Upload form guards applied before the route loader and action. */
export const middleware: Route.MiddlewareFunction[] = [finishedUploadMiddleware];
