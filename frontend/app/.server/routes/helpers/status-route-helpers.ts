import { redirectDocument } from 'react-router';

// session.id is currently an incubating OpenTelemetry convention.
import { ATTR_SESSION_ID } from '@opentelemetry/semantic-conventions/incubating';
import * as z from 'zod';

import { createLogger } from '~/.server/logging';
import { ATTR_CDCP_REDIRECT_TARGET, ATTR_CDCP_SESSION_KEY } from '~/.server/logging/log-attributes';
import type { Session } from '~/.server/web/session';
import { getPathById } from '~/utils/route-utils';

export type StatusStateSessionKey = `status-flow-${string}`;

export interface StatusState {
  readonly id: string;
  readonly statusCheckResult: {
    statusId?: string;
  };
}

/**
 * Schema for validating UUID.
 */
const idSchema = z.uuid();

/**
 * Gets the status flow session key.
 * @param id - The status flow ID.
 * @returns The status flow session key.
 */
function getSessionKey(id: string): StatusStateSessionKey {
  return `status-flow-${idSchema.parse(id)}`;
}

type StatusStateParams = {
  lang: string;
};

export function getStatusStateIdFromUrl(url: string | URL) {
  const { searchParams } = new URL(url);
  return searchParams.get('id');
}

interface LoadStateArgs {
  id: string | null;
  params: StatusStateParams;
  session: Session;
}

/**
 * Loads state.
 * @param args - The arguments.
 * @returns The loaded state.
 */
export function loadStatusState({ id, params, session }: LoadStateArgs): StatusState {
  const log = createLogger('status-route-helpers/loadStatusState');
  const statusIndexUrl = getPathById('public/status/index', params);

  const parsedId = idSchema.safeParse(id);

  if (!parsedId.success) {
    log.debug('Invalid status flow ID; redirecting to status index', { [ATTR_CDCP_REDIRECT_TARGET]: statusIndexUrl, [ATTR_SESSION_ID]: session.id });
    throw redirectDocument(statusIndexUrl);
  }

  const sessionKey = getSessionKey(parsedId.data);

  if (!session.has(sessionKey)) {
    log.debug('Status session state not found; redirecting to status index', {
      [ATTR_CDCP_REDIRECT_TARGET]: statusIndexUrl,
      [ATTR_CDCP_SESSION_KEY]: sessionKey,
      [ATTR_SESSION_ID]: session.id,
    });
    throw redirectDocument(statusIndexUrl);
  }

  return session.get(sessionKey);
}

interface SaveStateArgs {
  id: string;
  params: StatusStateParams;
  session: Session;
  state: Partial<OmitStrict<StatusState, 'id'>>;
  remove?: keyof OmitStrict<StatusState, 'id'>;
}

/**
 * Saves status state.
 * @param args - The arguments.
 * @returns The new status state.
 */
export function saveStatusState({ id, params, session, state }: SaveStateArgs) {
  const log = createLogger('status-route-helpers/saveStatusState');
  const currentState = loadStatusState({ id, params, session });

  const newState = {
    ...currentState,
    ...state,
  } satisfies StatusState;

  const sessionKey = getSessionKey(currentState.id);
  session.set(sessionKey, newState);
  log.debug('Status session state saved', { [ATTR_CDCP_SESSION_KEY]: sessionKey, [ATTR_SESSION_ID]: session.id });
  return newState;
}

interface ClearStateArgs {
  id: string;
  params: StatusStateParams;
  session: Session;
}

/**
 * Clears status state.
 * @param args - The arguments.
 */
export function clearStatusState({ id, params, session }: ClearStateArgs) {
  const log = createLogger('status-route-helpers/clearStatusState');
  const state = loadStatusState({ id, params, session });
  const sessionKey = getSessionKey(state.id);
  session.unset(sessionKey);
  log.debug('Status session state cleared', { [ATTR_CDCP_SESSION_KEY]: sessionKey, [ATTR_SESSION_ID]: session.id });
}

interface StartArgs {
  id: string;
  session: Session;
}

/**
 * Starts status state.
 * @param args - The arguments.
 * @returns The initial status state.
 */
export function startStatusState({ id, session }: StartArgs) {
  const log = createLogger('status-route-helpers/startStatusState');
  const parsedId = idSchema.parse(id);

  const initialState: StatusState = {
    id: parsedId,
    statusCheckResult: {},
  };

  const sessionKey = getSessionKey(parsedId);
  session.set(sessionKey, initialState);
  log.debug('Status session state started', { [ATTR_CDCP_SESSION_KEY]: sessionKey, [ATTR_SESSION_ID]: session.id });
  return initialState;
}

interface GetStatusResultUrlArgs {
  id: string;
  params: StatusStateParams;
}

export function getStatusResultUrl({ id, params }: GetStatusResultUrlArgs) {
  return getPathById('public/status/result', params) + `?id=${id}`;
}
