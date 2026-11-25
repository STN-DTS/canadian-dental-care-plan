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
   * The actor is always the authenticated user of the current request, or `anonymous` when
   * there is none (for example, public routes and background work). Callers cannot supply it.
   *
   * @param eventId A code-defined audit action identifier
   * @param auditDetails Only an opaque `letterId` for `pdf.get` is admitted
   */
  createAudit(eventId: string, auditDetails?: AuditDetails): void;
}

const ANONYMOUS_ACTOR = 'anonymous';

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

    const attributes = this.projectAuditDetails(eventId, auditDetails);
    const actor = this.resolveActor();

    if (actor !== undefined) {
      attributes[ATTR_CDCP_USER_ID] = actor;
    }

    this.log.audit('Audit event recorded', {
      [ATTR_OTEL_EVENT_NAME]: 'cdcp.audit.recorded',
      [ATTR_CDCP_AUDIT_EVENT_ID]: eventId,
      ...attributes,
    });
  }

  /**
   * Resolves the audit actor from the current request user, or `anonymous` when there is none.
   * Returns `undefined`, and warns, when the user identifier is not admissible.
   */
  private resolveActor(): string | undefined {
    const user = findUser().valueOrUndefined;

    if (user === undefined) {
      return ANONYMOUS_ACTOR;
    }

    if (isAdmissibleIdentifier(user.id)) {
      return user.id;
    }

    this.log.warn('Unapproved audit actor omitted', { [ATTR_ERROR_TYPE]: 'audit_metadata_rejected' });
    return undefined;
  }

  /**
   * Projects caller metadata onto approved audit attributes, omitting anything else.
   */
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
      const value: unknown = descriptor.value;

      if (key !== 'letterId' || eventId !== 'pdf.get' || !('value' in descriptor)) {
        rejected = true;
      } else if (value !== undefined) {
        if (isAdmissibleIdentifier(value)) {
          attributes[ATTR_CDCP_LETTER_ID] = value;
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

function isAdmissibleIdentifier(value: unknown): value is string {
  return typeof value === 'string' && /^[a-zA-Z0-9._:-]{1,255}$/.test(value) && !/^\d{3}[-.]?\d{3}[-.]?\d{3}$/.test(value);
}
