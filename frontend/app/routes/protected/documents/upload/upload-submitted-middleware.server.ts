import { replace } from 'react-router';

import type { Route } from './+types/upload-submitted';

import { appContext } from '~/.server/context';
import { loadDocumentUploadState } from '~/.server/routes/helpers/document-upload-route-helpers';
import { getPathById } from '~/utils/route-utils';

/**
 * Prevents open upload flows from reaching the confirmation loader.
 * @param args - The route context and localized flow parameters.
 * @param next - Runs downstream middleware and the confirmation loader for a finished flow.
 * @returns The downstream result for a finished flow.
 * @throws A replacement redirect to the localized documents listing for an open or unavailable flow.
 */
const unfinishedUploadMiddleware: Route.MiddlewareFunction = async ({ context, params }, next) => {
  const { session } = context.get(appContext);
  const uploadState = loadDocumentUploadState({ id: params.id, params, session });

  if (uploadState.status !== 'finished') {
    throw replace(getPathById('protected/documents/index', params));
  }

  return await next();
};

/** Confirmation guards applied before the submitted route loader. */
export const middleware: Route.MiddlewareFunction[] = [unfinishedUploadMiddleware];
