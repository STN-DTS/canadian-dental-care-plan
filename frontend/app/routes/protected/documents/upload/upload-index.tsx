import { replace } from 'react-router';

import type { Route } from './+types/upload-index';

import { appContext } from '~/.server/context';
import { getDocumentUploadFormUrl, startDocumentUploadState } from '~/.server/routes/helpers/document-upload-route-helpers';
import { generateId } from '~/utils/id-utils';

/**
 * Loader function for initiating a new document upload and redirecting to
 * the upload form page that will perform a `history.replaceState`.
 */
export function loader({ context, params }: Route.LoaderArgs) {
  const { session } = context.get(appContext);
  const newUploadState = startDocumentUploadState({ id: generateId(), session });
  return replace(getDocumentUploadFormUrl(newUploadState.id, params));
}
