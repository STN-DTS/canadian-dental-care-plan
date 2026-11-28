import { Option } from 'effect';
import express from 'express';
import expressSession, { MemoryStore } from 'express-session';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { deleteSessionStorage } from '~/.server/data/session-storage';
import { deletePublicApplicationState, findPublicApplicationState, setPublicApplicationState } from '~/.server/routes/data/public-application-storage';
import type { PublicApplicationState } from '~/.server/routes/helpers/public-application-route-helpers';
import { getEnv } from '~/.server/utils/env-utils';
import type { ServerEnv } from '~/.server/utils/env-utils';
import { deleteSingleton } from '~/.server/utils/instance-registry';
import { ExpressSession } from '~/.server/web/session';
import type { Session } from '~/.server/web/session';

vi.mock(import('~/.server/utils/env-utils'), () => ({ getEnv: vi.fn() }));

describe('public-application-storage', () => {
  beforeEach(() => {
    deleteSingleton('stores');
    vi.mocked(getEnv).mockReturnValue(
      mock<ServerEnv>({
        SESSION_STORAGE_TYPE: 'memory',
        SESSION_KEY_PREFIX: 'SESSION:',
        SESSION_EXPIRES_SECONDS: 60,
        SESSION_STORAGE_TTL_OFFSET_SECONDS: 10,
        SESSION_STORAGE_MEMORY_MAX_SIZE: 1000,
      }),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    deleteSingleton('stores');
  });

  it('extends state TTL on repeated reads without saving', async () => {
    vi.useFakeTimers({ now: Temporal.Instant.from('2026-07-01T00:00:00Z').epochMilliseconds });
    const session = mock<Session>({ id: 'session-a' });
    const state = {
      id: 'flow-1',
      channelCode: 'public',
      context: 'intake',
      lastUpdatedOn: '2026-07-01T12:00:00Z',
      applicationYear: { applicationYearId: '1', taxYear: '2025', dependentEligibilityEndDate: '2026-06-30' },
      children: [],
    } as PublicApplicationState;

    // Default TTL is 60s + 10s = 70s.
    await setPublicApplicationState(session, 'flow-1', state);

    vi.advanceTimersByTime(50_000);
    await expect(findPublicApplicationState(session, 'flow-1')).resolves.toEqual(Option.some(state));

    // At t=100s (past the original 70s TTL), the read at t=50s kept the state alive.
    vi.advanceTimersByTime(50_000);
    await expect(findPublicApplicationState(session, 'flow-1')).resolves.toEqual(Option.some(state));
  });

  it('stores, reads, and deletes state scoped to the session', async () => {
    const session = mock<Session>({ id: 'session-a' });
    const state = {
      id: 'flow-1',
      channelCode: 'public',
      context: 'intake',
      lastUpdatedOn: '2026-07-01T12:00:00Z',
      applicationYear: { applicationYearId: '1', taxYear: '2025', dependentEligibilityEndDate: '2026-06-30' },
      children: [],
    } as PublicApplicationState;

    await setPublicApplicationState(session, 'flow-1', state);
    expect(session.initialize).toHaveBeenCalledOnce();
    await expect(findPublicApplicationState(session, 'flow-1')).resolves.toEqual(Option.some(state));

    await deletePublicApplicationState(session, 'flow-1');
    await expect(findPublicApplicationState(session, 'flow-1')).resolves.toEqual(Option.none());
  });

  it('cleans up stored entries when session storage is deleted', async () => {
    const session = mock<Session>({ id: 'session-a' });
    const state = {
      id: 'flow-1',
      channelCode: 'public',
      context: 'intake',
      lastUpdatedOn: '2026-07-01T12:00:00Z',
      applicationYear: { applicationYearId: '1', taxYear: '2025', dependentEligibilityEndDate: '2026-06-30' },
      children: [],
    } as PublicApplicationState;

    await setPublicApplicationState(session, 'flow-1', state);
    await deleteSessionStorage('session-a');

    await expect(findPublicApplicationState(session, 'flow-1')).resolves.toEqual(Option.none());
  });

  it('issues a session cookie on first write without rewriting Express session on subsequent requests', async () => {
    const store = new MemoryStore();
    const storeSetSpy = vi.spyOn(store, 'set');
    const state = {
      id: 'flow-1',
      channelCode: 'public',
      context: 'intake',
      lastUpdatedOn: '2026-07-01T12:00:00Z',
      applicationYear: { applicationYearId: '1', taxYear: '2025', dependentEligibilityEndDate: '2026-06-30' },
      children: [],
    } as PublicApplicationState;

    const app = express();
    app.use(
      expressSession({
        store,
        secret: 'test-session-secret-with-sufficient-entropy',
        resave: false,
        rolling: true,
        saveUninitialized: false,
      }),
    );

    app.get('/untouched', (_req, res) => {
      res.json({ ok: true });
    });

    app.post('/start', async (req, res) => {
      const session = new ExpressSession(req);
      await setPublicApplicationState(session, 'flow-1', state);
      res.json({ started: true });
    });

    app.post('/update', async (req, res) => {
      const session = new ExpressSession(req);
      await setPublicApplicationState(session, 'flow-1', { ...state, email: 'test@example.com' });
      res.json({ updated: true });
    });

    app.get('/read', async (req, res) => {
      const session = new ExpressSession(req);
      const found = await findPublicApplicationState(session, 'flow-1');
      res.json({ state: Option.getOrNull(found) });
    });

    const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
      const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
    });

    try {
      const { port } = server.address() as AddressInfo;
      const baseUrl = `http://127.0.0.1:${port}`;

      // Untouched routes must not create a session or send Set-Cookie (saveUninitialized: false).
      const untouchedResponse = await fetch(`${baseUrl}/untouched`);
      expect(untouchedResponse.headers.get('set-cookie')).toBeNull();
      expect(storeSetSpy).not.toHaveBeenCalled();

      // Starting a public application initializes the Express session once and emits Set-Cookie.
      const startResponse = await fetch(`${baseUrl}/start`, { method: 'POST' });
      const setCookie = startResponse.headers.get('set-cookie');
      expect(setCookie).toBeTruthy();
      expect(storeSetSpy).toHaveBeenCalledOnce();
      const cookie = setCookie!.split(';')[0]!;

      // Subsequent reads and updates find the state via the same session cookie without re-saving Express session.
      const readResponse = await fetch(`${baseUrl}/read`, { headers: { cookie } });
      await expect(readResponse.json()).resolves.toEqual({ state });

      await fetch(`${baseUrl}/update`, { method: 'POST', headers: { cookie } });
      const updatedReadResponse = await fetch(`${baseUrl}/read`, { headers: { cookie } });
      await expect(updatedReadResponse.json()).resolves.toEqual({ state: { ...state, email: 'test@example.com' } });
      expect(storeSetSpy).toHaveBeenCalledOnce();
    } finally {
      await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
    }
  });
});
