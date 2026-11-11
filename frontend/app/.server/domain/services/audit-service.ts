import { ATTR_ERROR_TYPE, ATTR_OTEL_EVENT_NAME } from '@opentelemetry/semantic-conventions';
import { injectable } from 'inversify';
import { isProxy } from 'node:util/types';

import type { AuditDetails } from '~/.server/domain/dtos';
import { createLogger } from '~/.server/logging';
import type { Logger } from '~/.server/logging';
import { ATTR_CDCP_AUDIT_EVENT_ID, ATTR_CDCP_LETTER_ID, ATTR_CDCP_USER_ID } from '~/.server/logging/log-attributes';
import { Traced } from '~/.server/observability/decorator';

export interface AuditService {
  /**
   * Creates an audit log entry for a given event.
   *
   * @param eventId A code-defined audit action identifier
   * @param auditDetails Only opaque `userId` and, for `pdf.get`, `letterId` are admitted
   */
  createAudit(eventId: string, auditDetails?: AuditDetails): void;
}

@injectable()
export class DefaultAuditService implements AuditService {
  private readonly log: Logger;

  constructor() {
    this.log = createLogger('DefaultAuditService');
    this.init();
  }

  private init(): void {
    this.log.debug('DefaultAuditService initiated.');
  }

  @Traced()
  createAudit(eventId: string, auditDetails?: AuditDetails): void {
    if (typeof eventId !== 'string' || !/^[a-z][a-z0-9.-]{0,127}$/.test(eventId)) {
      this.log.error('Audit record rejected because its action identifier is invalid', { [ATTR_ERROR_TYPE]: 'audit_event_invalid' });
      return;
    }

    this.log.audit('Audit event recorded', {
      [ATTR_OTEL_EVENT_NAME]: 'cdcp.audit.recorded',
      [ATTR_CDCP_AUDIT_EVENT_ID]: eventId,
      ...this.projectAuditDetails(eventId, auditDetails),
    });
  }

  private projectAuditDetails(eventId: string, auditDetails: unknown): Record<string, string> {
    if (auditDetails === undefined) {
      return {};
    }

    if (typeof auditDetails !== 'object' || auditDetails === null || isProxy(auditDetails)) {
      this.log.warn('Unapproved audit metadata omitted', { [ATTR_ERROR_TYPE]: 'audit_metadata_rejected' });
      return {};
    }

    const attributes: Record<string, string> = {};
    let rejected = false;

    for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(auditDetails))) {
      const attribute = key === 'userId' ? ATTR_CDCP_USER_ID : key === 'letterId' && eventId === 'pdf.get' ? ATTR_CDCP_LETTER_ID : undefined;
      const value: unknown = descriptor.value;

      if (attribute === undefined || !('value' in descriptor)) {
        rejected = true;
      } else if (value !== undefined) {
        if (typeof value === 'string' && /^[a-zA-Z0-9._:-]{1,255}$/.test(value) && !/^\d{3}[-.]?\d{3}[-.]?\d{3}$/.test(value)) {
          attributes[attribute] = value;
        } else {
          rejected = true;
        }
      }
    }

    if (rejected) {
      this.log.warn('Unapproved audit metadata omitted', { [ATTR_ERROR_TYPE]: 'audit_metadata_rejected' });
    }

    return attributes;
  }
}
