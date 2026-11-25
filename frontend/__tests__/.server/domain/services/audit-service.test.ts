import { RouterContextProvider } from 'react-router';

import { ATTR_ERROR_TYPE, ATTR_OTEL_EVENT_NAME } from '@opentelemetry/semantic-conventions';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { userContext } from '~/.server/context/user-context';
import { DefaultAuditService } from '~/.server/domain/services/audit-service';
import { createLogger } from '~/.server/logging';
import type { Logger } from '~/.server/logging';
import { contextStorageMiddleware } from '~/middlewares/context-storage.server';

function createUserContext(userId?: string): RouterContextProvider {
  const context = new RouterContextProvider();

  if (userId !== undefined) {
    context.set(userContext, { id: userId, mocked: false, sin: '999999998' });
  }

  return context;
}

async function runInRequestScope(context: RouterContextProvider, fn: () => Promise<void> | void): Promise<void> {
  const url = new URL('https://localhost:3000/en/protected/profile');
  await contextStorageMiddleware({ context, params: {}, request: new Request(url), url, pattern: '' }, async () => {
    await fn();
    return new Response();
  });
}

function auditedUserIds(logger: Logger): unknown[] {
  return vi.mocked(logger.audit).mock.calls.map((args: unknown[]) => (args[1] as Record<string, unknown> | undefined)?.['cdcp.user.id']);
}

describe('DefaultAuditService', () => {
  const logger = mock<Logger>();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createLogger).mockReturnValue(logger);
  });

  it('emits a structured audit event without interpolation or mutating caller metadata', () => {
    const details = Object.freeze({ userId: 'actor-001' });

    new DefaultAuditService().createAudit('auth.session-created', details);

    expect(logger.audit).toHaveBeenCalledExactlyOnceWith('Audit event recorded', {
      [ATTR_OTEL_EVENT_NAME]: 'cdcp.audit.recorded',
      'cdcp.audit.event_id': 'auth.session-created',
      'cdcp.user.id': 'actor-001',
    });
    expect(details).toEqual({ userId: 'actor-001' });
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('retains the approved letter identifier only for PDF audit records', () => {
    new DefaultAuditService().createAudit('pdf.get', { userId: 'actor-001', letterId: 'letter-001' });

    expect(logger.audit).toHaveBeenCalledWith('Audit event recorded', {
      [ATTR_OTEL_EVENT_NAME]: 'cdcp.audit.recorded',
      'cdcp.audit.event_id': 'pdf.get',
      'cdcp.user.id': 'actor-001',
      'cdcp.letter.id': 'letter-001',
    });
  });

  it('omits arbitrary metadata and preserves the audit fact', () => {
    new DefaultAuditService().createAudit('auth.session-created', {
      userId: 'actor-001',
      letterId: 'letter-001',
      sin: '999999998',
      email: 'audit-canary@example.invalid',
      token: 'audit-token-canary',
      error: new Error('audit-exception-canary'),
    });

    expect(logger.audit).toHaveBeenCalledExactlyOnceWith('Audit event recorded', {
      [ATTR_OTEL_EVENT_NAME]: 'cdcp.audit.recorded',
      'cdcp.audit.event_id': 'auth.session-created',
      'cdcp.user.id': 'actor-001',
    });
    expect(logger.warn).toHaveBeenCalledExactlyOnceWith('Unapproved audit metadata omitted', {
      [ATTR_ERROR_TYPE]: 'audit_metadata_rejected',
    });
  });

  it('emits an audit event without optional metadata', () => {
    new DefaultAuditService().createAudit('client-eligibility.number.get');

    expect(logger.audit).toHaveBeenCalledExactlyOnceWith('Audit event recorded', {
      [ATTR_OTEL_EVENT_NAME]: 'cdcp.audit.recorded',
      'cdcp.audit.event_id': 'client-eligibility.number.get',
    });
  });

  it.each(['999999998', '999-999-999', 'actor@example.invalid', 'Bearer synthetic-token', '', 'a'.repeat(256)])('omits an inadmissible actor identifier: %s', (userId) => {
    new DefaultAuditService().createAudit('auth.session-created', { userId });

    expect(logger.audit).toHaveBeenCalledExactlyOnceWith('Audit event recorded', {
      [ATTR_OTEL_EVENT_NAME]: 'cdcp.audit.recorded',
      'cdcp.audit.event_id': 'auth.session-created',
    });
    expect(logger.warn).toHaveBeenCalled();
  });

  it('does not invoke metadata getters or proxy traps', () => {
    const getter = vi.fn(() => 'private-getter-canary');
    const details = Object.defineProperty({}, 'userId', { enumerable: true, get: getter });
    const ownKeys = vi.fn(() => ['userId']);
    const proxy = new Proxy({}, { ownKeys });
    const service = new DefaultAuditService();

    service.createAudit('auth.session-created', details);
    service.createAudit('auth.session-created', proxy);

    expect(getter).not.toHaveBeenCalled();
    expect(ownKeys).not.toHaveBeenCalled();
    expect(logger.audit).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(logger.audit.mock.calls)).not.toContain('private-getter-canary');
  });

  it.each(['actor@example.invalid', '999999998', 'Bearer synthetic-token', 'event\nforgery', 'a'.repeat(129)])('rejects an invalid audit action without logging its value: %s', (eventId) => {
    new DefaultAuditService().createAudit(eventId);

    expect(logger.audit).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ message: 'Audit record rejected because its action identifier is invalid' }), {
      [ATTR_ERROR_TYPE]: 'audit_event_invalid',
    });
    expect(logger.error.mock.calls[0]?.[0]).toBeInstanceOf(Error);
  });

  describe('request user fallback', () => {
    it.each([
      ['omitted details', undefined],
      ['omitted userId', {}],
      ['undefined userId', { userId: undefined }],
    ])('records the request user when the actor is absent (%s)', async (_, details) => {
      await runInRequestScope(createUserContext('context-user'), () => new DefaultAuditService().createAudit('client-eligibility.number.get', details));

      expect(logger.audit).toHaveBeenCalledExactlyOnceWith('Audit event recorded', {
        [ATTR_OTEL_EVENT_NAME]: 'cdcp.audit.recorded',
        'cdcp.audit.event_id': 'client-eligibility.number.get',
        'cdcp.user.id': 'context-user',
      });
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('keeps the letter identifier alongside the request user for PDF audit records', async () => {
      await runInRequestScope(createUserContext('context-user'), () => new DefaultAuditService().createAudit('pdf.get', { letterId: 'letter-001' }));

      expect(logger.audit).toHaveBeenCalledExactlyOnceWith('Audit event recorded', {
        [ATTR_OTEL_EVENT_NAME]: 'cdcp.audit.recorded',
        'cdcp.audit.event_id': 'pdf.get',
        'cdcp.letter.id': 'letter-001',
        'cdcp.user.id': 'context-user',
      });
    });

    it.each(['explicit-user', 'anonymous'])('prefers an explicit actor over the request user: %s', async (userId) => {
      await runInRequestScope(createUserContext('context-user'), () => new DefaultAuditService().createAudit('auth.session-created', { userId }));

      expect(auditedUserIds(logger)).toEqual([userId]);
    });

    it('does not substitute the request user for a rejected explicit actor', async () => {
      await runInRequestScope(createUserContext('context-user'), () => new DefaultAuditService().createAudit('auth.session-created', { userId: '999999998' }));

      expect(auditedUserIds(logger)).toEqual([undefined]);
      expect(logger.warn).toHaveBeenCalledOnce();
    });

    it('omits the actor when there is no request user or request scope', async () => {
      const service = new DefaultAuditService();

      await runInRequestScope(createUserContext(), () => service.createAudit('letters.get'));
      service.createAudit('letters.get');

      expect(auditedUserIds(logger)).toEqual([undefined, undefined]);
    });

    it('omits an inadmissible request user identifier', async () => {
      await runInRequestScope(createUserContext('999-999-998'), () => new DefaultAuditService().createAudit('letters.get'));

      expect(auditedUserIds(logger)).toEqual([undefined]);
    });

    it('resolves the request user at call time and isolates concurrent requests sharing one service', async () => {
      const service = new DefaultAuditService();
      const firstContext = createUserContext();
      let releaseFirst!: () => void;
      const secondDone = new Promise<void>((resolve) => {
        releaseFirst = resolve;
      });

      await Promise.all([
        runInRequestScope(firstContext, async () => {
          service.createAudit('letters.get');
          firstContext.set(userContext, { id: 'first-user', mocked: false, sin: '999999998' });
          await secondDone;
          service.createAudit('letters.get');
        }),
        runInRequestScope(createUserContext('second-user'), () => {
          service.createAudit('letters.get');
          releaseFirst();
        }),
      ]);

      expect(auditedUserIds(logger)).toEqual([undefined, 'second-user', 'first-user']);
    });
  });
});
