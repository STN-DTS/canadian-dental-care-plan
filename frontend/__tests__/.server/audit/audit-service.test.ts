import { RouterContextProvider } from 'react-router';

import { ATTR_ERROR_TYPE, ATTR_OTEL_EVENT_NAME } from '@opentelemetry/semantic-conventions';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { DefaultAuditService } from '~/.server/audit/audit-service';
import { userContext } from '~/.server/context/user-context';
import { createLogger } from '~/.server/logging';
import type { Logger } from '~/.server/logging';
import { contextStorageMiddleware } from '~/middlewares/context-storage.server';

function createRequestContext(userId?: string): RouterContextProvider {
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

  it('records the request user as the actor without mutating caller metadata', async () => {
    const details = Object.freeze({ letterId: 'letter-001' });

    await runInRequestScope(createRequestContext('actor-001'), () => new DefaultAuditService().createAudit('pdf.get', details));

    expect(logger.audit).toHaveBeenCalledExactlyOnceWith('Audit event recorded', {
      [ATTR_OTEL_EVENT_NAME]: 'cdcp.audit.recorded',
      'cdcp.audit.event_id': 'pdf.get',
      'cdcp.letter.id': 'letter-001',
      'cdcp.user.id': 'actor-001',
    });
    expect(details).toEqual({ letterId: 'letter-001' });
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('records an anonymous actor when there is no request user or request scope', async () => {
    const service = new DefaultAuditService();

    await runInRequestScope(createRequestContext(), () => service.createAudit('client-eligibility.number.get'));
    service.createAudit('client-eligibility.number.get');

    expect(logger.audit).toHaveBeenNthCalledWith(1, 'Audit event recorded', {
      [ATTR_OTEL_EVENT_NAME]: 'cdcp.audit.recorded',
      'cdcp.audit.event_id': 'client-eligibility.number.get',
      'cdcp.user.id': 'anonymous',
    });
    expect(auditedUserIds(logger)).toEqual(['anonymous', 'anonymous']);
  });

  it('ignores a caller-supplied actor for a non-authentication event', async () => {
    await runInRequestScope(createRequestContext('context-user'), () => {
      new DefaultAuditService().createAudit('letters.get', { userId: 'spoofed-user' });
    });

    expect(auditedUserIds(logger)).toEqual(['context-user']);
    expect(JSON.stringify(logger.audit.mock.calls)).not.toContain('spoofed-user');
    expect(logger.warn).toHaveBeenCalledExactlyOnceWith('Unapproved audit metadata omitted', {
      [ATTR_ERROR_TYPE]: 'audit_metadata_rejected',
    });
  });

  it.each(['auth.session-created', 'auth.session-destroyed'] as const)('uses the supplied token subject for %s without a request user', (eventId) => {
    new DefaultAuditService().createAudit(eventId, { userId: 'token-user' });

    expect(logger.audit).toHaveBeenCalledExactlyOnceWith('Audit event recorded', {
      [ATTR_OTEL_EVENT_NAME]: 'cdcp.audit.recorded',
      'cdcp.audit.event_id': eventId,
      'cdcp.user.id': 'token-user',
    });
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('uses the supplied token subject for authentication even when a request user exists', async () => {
    await runInRequestScope(createRequestContext('context-user'), () => {
      new DefaultAuditService().createAudit('auth.session-created', { userId: 'token-user' });
    });

    expect(auditedUserIds(logger)).toEqual(['token-user']);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it.each(['999999998', '999-999-999', 'actor@example.invalid', 'Bearer synthetic-token', '', 'a'.repeat(256)])('omits an inadmissible authentication subject: %s', (userId) => {
    new DefaultAuditService().createAudit('auth.session-created', { userId });

    expect(logger.audit).toHaveBeenCalledExactlyOnceWith('Audit event recorded', {
      [ATTR_OTEL_EVENT_NAME]: 'cdcp.audit.recorded',
      'cdcp.audit.event_id': 'auth.session-created',
    });
    expect(logger.warn).toHaveBeenCalledExactlyOnceWith('Unapproved audit metadata omitted', {
      [ATTR_ERROR_TYPE]: 'audit_metadata_rejected',
    });
  });

  it('uses the request user when an authentication event has no supplied subject', async () => {
    await runInRequestScope(createRequestContext('context-user'), () => {
      new DefaultAuditService().createAudit('auth.session-created', { userId: undefined });
    });

    expect(auditedUserIds(logger)).toEqual(['context-user']);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('omits arbitrary metadata and the letter identifier outside PDF audit records', () => {
    const details = {
      letterId: 'letter-001',
      sin: '999999998',
      email: 'audit-canary@example.invalid',
      token: 'audit-token-canary',
      error: new Error('audit-exception-canary'),
    };

    new DefaultAuditService().createAudit('auth.session-created', details);

    expect(logger.audit).toHaveBeenCalledExactlyOnceWith('Audit event recorded', {
      [ATTR_OTEL_EVENT_NAME]: 'cdcp.audit.recorded',
      'cdcp.audit.event_id': 'auth.session-created',
      'cdcp.user.id': 'anonymous',
    });
    expect(logger.warn).toHaveBeenCalledExactlyOnceWith('Unapproved audit metadata omitted', {
      [ATTR_ERROR_TYPE]: 'audit_metadata_rejected',
    });
  });

  it.each(['999999998', '999-999-999', 'actor@example.invalid', 'Bearer synthetic-token', '', 'a'.repeat(256)])('omits an inadmissible request user identifier: %s', async (userId) => {
    await runInRequestScope(createRequestContext(userId), () => new DefaultAuditService().createAudit('letters.get'));

    expect(logger.audit).toHaveBeenCalledExactlyOnceWith('Audit event recorded', {
      [ATTR_OTEL_EVENT_NAME]: 'cdcp.audit.recorded',
      'cdcp.audit.event_id': 'letters.get',
    });
    expect(logger.warn).toHaveBeenCalledExactlyOnceWith('Unapproved audit actor omitted', {
      [ATTR_ERROR_TYPE]: 'audit_metadata_rejected',
    });
  });

  it('does not invoke metadata getters or proxy traps', () => {
    const getter = vi.fn(() => 'private-getter-canary');
    const details = Object.defineProperty({}, 'letterId', { enumerable: true, get: getter });
    const actorDetails = Object.defineProperty({}, 'userId', { enumerable: true, get: getter });
    const ownKeys = vi.fn(() => ['letterId']);
    const proxy = new Proxy({}, { ownKeys });
    const service = new DefaultAuditService();

    service.createAudit('pdf.get', details);
    service.createAudit('auth.session-created', actorDetails);
    service.createAudit('pdf.get', proxy);

    expect(getter).not.toHaveBeenCalled();
    expect(ownKeys).not.toHaveBeenCalled();
    expect(logger.audit).toHaveBeenCalledTimes(3);
    expect(JSON.stringify(logger.audit.mock.calls)).not.toContain('private-getter-canary');
  });

  it('records a syntactically valid unregistered action that reaches runtime', () => {
    // @ts-expect-error -- callers must use a registered audit action
    new DefaultAuditService().createAudit('test.unregistered');

    expect(logger.audit).toHaveBeenCalledExactlyOnceWith('Audit event recorded', {
      [ATTR_OTEL_EVENT_NAME]: 'cdcp.audit.recorded',
      'cdcp.audit.event_id': 'test.unregistered',
      'cdcp.user.id': 'anonymous',
    });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it.each(['actor@example.invalid', '999999998', 'Bearer synthetic-token', 'event\nforgery', 'a'.repeat(129)])('rejects an invalid audit action without logging its value: %s', (eventId) => {
    // @ts-expect-error -- exercise runtime validation of untyped input
    new DefaultAuditService().createAudit(eventId);

    expect(logger.audit).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ message: 'Audit record rejected because its action identifier is invalid' }), {
      [ATTR_ERROR_TYPE]: 'audit_event_invalid',
    });
    expect(logger.error.mock.calls[0]?.[0]).toBeInstanceOf(Error);
  });

  it('resolves the request user at call time and isolates concurrent requests sharing one service', async () => {
    const service = new DefaultAuditService();
    const firstContext = createRequestContext();
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
      runInRequestScope(createRequestContext('second-user'), () => {
        service.createAudit('letters.get');
        releaseFirst();
      }),
    ]);

    expect(auditedUserIds(logger)).toEqual(['anonymous', 'second-user', 'first-user']);
  });
});
