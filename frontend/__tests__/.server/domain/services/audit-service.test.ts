import { ATTR_ERROR_TYPE, ATTR_OTEL_EVENT_NAME } from '@opentelemetry/semantic-conventions';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { DefaultAuditService } from '~/.server/domain/services/audit-service';
import { createLogger } from '~/.server/logging';
import type { Logger } from '~/.server/logging';

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
});
