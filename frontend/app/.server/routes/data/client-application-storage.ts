import type { Option } from 'effect';

import { createSessionStorage } from '~/.server/data/session-storage';
import type { SessionStorage } from '~/.server/data/session-storage';
import type { ClientApplicationDto } from '~/.server/domain/dtos';
import { getEnv } from '~/.server/utils/env-utils';
import type { Session } from '~/.server/web/session';

const DEFAULT_APPLICATION_YEAR_KEY = 'default';

function getStorage(): SessionStorage<ClientApplicationDto> {
  return createSessionStorage<ClientApplicationDto>('client-application', {
    ttlSeconds: getEnv().SESSION_STORAGE_CLIENT_APPLICATION_TTL_SECONDS,
  });
}

function getCacheKey(applicationYearId?: string): string {
  return applicationYearId ?? DEFAULT_APPLICATION_YEAR_KEY;
}

/**
 * Reads a cached client application from session-scoped storage.
 */
export async function findClientApplicationState(session: Session, applicationYearId?: string): Promise<Option.Option<ClientApplicationDto>> {
  return await getStorage().find(session.id, getCacheKey(applicationYearId));
}

/**
 * Caches a client application in session-scoped storage with the configured
 * `SESSION_STORAGE_CLIENT_APPLICATION_TTL_SECONDS` TTL and ensures the Express session is initialized.
 */
export async function setClientApplicationState(session: Session, clientApplication: ClientApplicationDto, applicationYearId?: string): Promise<void> {
  session.initialize();
  await getStorage().set(session.id, getCacheKey(applicationYearId), clientApplication);
}

/**
 * Removes a cached client application from session-scoped storage.
 * Call after mutating profile data so the next request fetches fresh data.
 */
export async function deleteClientApplicationState(session: Session, applicationYearId?: string): Promise<void> {
  await getStorage().delete(session.id, getCacheKey(applicationYearId));
}
