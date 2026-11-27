import { Option } from 'effect';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { deleteSessionStorage } from '~/.server/data/session-storage';
import { deleteDocumentUploadState, findDocumentUploadState, setDocumentUploadState } from '~/.server/routes/data/document-upload-state-storage';
import type { DocumentUploadState } from '~/.server/routes/helpers/document-upload-route-helpers';
import { getEnv } from '~/.server/utils/env-utils';
import type { ServerEnv } from '~/.server/utils/env-utils';
import { deleteSingleton } from '~/.server/utils/instance-registry';
import type { Session } from '~/.server/web/session';

vi.mock(import('~/.server/utils/env-utils'), () => ({ getEnv: vi.fn() }));

describe('document-upload-state-storage', () => {
  beforeEach(() => {
    deleteSingleton('stores');
    vi.mocked(getEnv).mockReturnValue(
      mock<ServerEnv>({
        SESSION_STORAGE_TYPE: 'memory',
        SESSION_KEY_PREFIX: 'SESSION:',
        SESSION_EXPIRES_SECONDS: 60,
        SESSION_STATE_TTL_OFFSET_SECONDS: 10,
      }),
    );
  });

  afterEach(() => {
    deleteSingleton('stores');
  });

  it('stores, reads, and deletes state scoped to the session', async () => {
    const session = mock<Session>({ id: 'session-a' });
    const state: DocumentUploadState = { id: 'flow-1', status: 'initialized', documents: [] };

    await setDocumentUploadState(session, 'flow-1', state);
    expect(session.initialize).toHaveBeenCalledOnce();
    await expect(findDocumentUploadState(session, 'flow-1')).resolves.toEqual(Option.some(state));

    await deleteDocumentUploadState(session, 'flow-1');
    await expect(findDocumentUploadState(session, 'flow-1')).resolves.toEqual(Option.none());
  });

  it('cleans up stored entries when session storage is deleted', async () => {
    const session = mock<Session>({ id: 'session-a' });
    const state: DocumentUploadState = { id: 'flow-1', status: 'initialized', documents: [] };

    await setDocumentUploadState(session, 'flow-1', state);
    await deleteSessionStorage('session-a');

    await expect(findDocumentUploadState(session, 'flow-1')).resolves.toEqual(Option.none());
  });
});
