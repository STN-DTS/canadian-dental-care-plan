import { ATTR_ERROR_TYPE, ATTR_OTEL_EVENT_NAME } from '@opentelemetry/semantic-conventions';
import { injectable } from 'inversify';
import { isProxy } from 'node:util/types';

import { findUser } from '~/.server/context/user-context';
import type { AuditDetails } from '~/.server/domain/dtos';
import { createLogger } from '~/.server/logging';
import type { Logger } from '~/.server/logging';
import { ATTR_CDCP_AUDIT_EVENT_ID, ATTR_CDCP_LETTER_ID, ATTR_CDCP_USER_ID } from '~/.server/logging/log-attributes';

export interface AuditService {
  /**
   * Creates an audit log entry for a given event.
   *
   * When `userId` is omitted or `undefined`, the authenticated user of the current
   * request (if any) is recorded as the actor. An explicitly supplied `userId` wins.
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

  createAudit(eventId: string, auditDetails?: AuditDetails): void {
    if (typeof eventId !== 'string' || !/^[a-z][a-z0-9.-]{0,127}$/.test(eventId)) {
      this.log.error(new Error('Audit record rejected because its action identifier is invalid'), { [ATTR_ERROR_TYPE]: 'audit_event_invalid' });
      return;
    }

    const { attributes, actorSupplied } = this.projectAuditDetails(eventId, auditDetails);

    if (!actorSupplied) {
      const contextUserId = findUser().valueOrUndefined?.id;

      if (isAdmissibleIdentifier(contextUserId)) {
        attributes[ATTR_CDCP_USER_ID] = contextUserId;
      }
    }

    this.log.audit('Audit event recorded', {
      [ATTR_OTEL_EVENT_NAME]: 'cdcp.audit.recorded',
      [ATTR_CDCP_AUDIT_EVENT_ID]: eventId,
      ...attributes,
    });
  }

  /**
   * Projects caller metadata onto approved audit attributes. `actorSupplied` is `true` when the
   * caller provided a non-`undefined` actor (admitted or rejected), or metadata that cannot be
   * inspected safely; in both cases no contextual actor is substituted.
   */
  private projectAuditDetails(eventId: string, auditDetails: unknown): { attributes: Record<string, string>; actorSupplied: boolean } {
    if (auditDetails === undefined) {
      return { attributes: {}, actorSupplied: false };
    }

    if (typeof auditDetails !== 'object' || auditDetails === null || isProxy(auditDetails)) {
      this.log.warn('Unapproved audit metadata omitted', { [ATTR_ERROR_TYPE]: 'audit_metadata_rejected' });
      return { attributes: {}, actorSupplied: true };
    }

    const attributes: Record<string, string> = {};
    let actorSupplied = false;
    let rejected = false;

    for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(auditDetails))) {
      const attribute = key === 'userId' ? ATTR_CDCP_USER_ID : key === 'letterId' && eventId === 'pdf.get' ? ATTR_CDCP_LETTER_ID : undefined;
      const value: unknown = descriptor.value;

      if (attribute === ATTR_CDCP_USER_ID && (!('value' in descriptor) || value !== undefined)) {
        actorSupplied = true;
      }

      if (attribute === undefined || !('value' in descriptor)) {
        rejected = true;
      } else if (value !== undefined) {
        if (isAdmissibleIdentifier(value)) {
          attributes[attribute] = value;
        } else {
          rejected = true;
        }
      }
    }

    if (rejected) {
      this.log.warn('Unapproved audit metadata omitted', { [ATTR_ERROR_TYPE]: 'audit_metadata_rejected' });
    }

    return { attributes, actorSupplied };
  }
}

function isAdmissibleIdentifier(value: unknown): value is string {
  return typeof value === 'string' && /^[a-zA-Z0-9._:-]{1,255}$/.test(value) && !/^\d{3}[-.]?\d{3}[-.]?\d{3}$/.test(value);
}
