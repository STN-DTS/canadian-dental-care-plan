import type { Option } from 'effect';

import { createSessionStorage } from '~/.server/data/session-storage';
import type { SessionStorage } from '~/.server/data/session-storage';
import type { Session } from '~/.server/web/session';

export type ProfileEmailAddressFlowState = {
  emailAddress: string;
  verificationCode: string;
  verificationAttempts: number;
} & (
  | {
      context?: 'contact';
      preferredLanguage?: undefined;
      preferredMethodSunLife?: undefined;
      preferredMethodGovernmentOfCanada?: undefined;
    }
  | {
      context: 'communication-preferences';
      preferredLanguage: string;
      preferredMethodSunLife: string;
      preferredMethodGovernmentOfCanada: string;
    }
);

const STATE_KEY = 'current';

let storage: SessionStorage<ProfileEmailAddressFlowState> | undefined;

function getStorage(): SessionStorage<ProfileEmailAddressFlowState> {
  storage ??= createSessionStorage<ProfileEmailAddressFlowState>('profile-email-address');
  return storage;
}

/**
 * Reads profile email verification flow state from session-scoped storage.
 */
export async function findProfileEmailAddressFlowState(session: Session): Promise<Option.Option<ProfileEmailAddressFlowState>> {
  return await getStorage().find(session.id, STATE_KEY);
}

/**
 * Writes profile email verification flow state to session-scoped storage and ensures
 * the underlying Express session is initialized so a session cookie is issued.
 */
export async function setProfileEmailAddressFlowState(session: Session, state: ProfileEmailAddressFlowState): Promise<void> {
  session.initialize();
  await getStorage().set(session.id, STATE_KEY, state);
}

/**
 * Removes profile email verification flow state from session-scoped storage.
 */
export async function deleteProfileEmailAddressFlowState(session: Session): Promise<void> {
  await getStorage().delete(session.id, STATE_KEY);
}
