import { ATTR_ERROR_TYPE, ATTR_OTEL_EVENT_NAME } from '@opentelemetry/semantic-conventions';
import { injectable } from 'inversify';
import { isProxy } from 'node:util/types';

import type { AuditDetails, AuthenticationAuditDetails } from '~/.server/audit/audit-dto';
import { findUser } from '~/.server/context/user-context';
import { createLogger } from '~/.server/logging';
import type { Logger } from '~/.server/logging';
import { ATTR_CDCP_AUDIT_EVENT_ID, ATTR_CDCP_LETTER_ID, ATTR_CDCP_USER_ID } from '~/.server/logging/log-attributes';

export interface AuditService {
  /**
   * Creates an audit log entry for a given event.
   *
   * Authentication events may provide the ID token subject as the actor. Otherwise, the actor
   * is the authenticated request user, or `anonymous` when there is none.
   *
   * @param eventId A code-defined audit action identifier
   * @param auditDetails An opaque `userId` for authentication events or `letterId` for `pdf.get`
   */
  createAudit(eventId: AuthenticationAuditEvent, auditDetails?: AuthenticationAuditDetails): void;
  createAudit(eventId: string, auditDetails?: AuditDetails): void;
}

type AuthenticationAuditEvent = 'auth.session-created' | 'auth.session-destroyed';

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

  createAudit(eventId: AuthenticationAuditEvent, auditDetails?: AuthenticationAuditDetails): void;
  createAudit(eventId: string, auditDetails?: AuditDetails): void;
  createAudit(eventId: string, auditDetails?: AuditDetails | AuthenticationAuditDetails): void {
    if (typeof eventId !== 'string' || !/^[a-z][a-z0-9.-]{0,127}$/.test(eventId)) {
      this.log.error(new Error('Audit record rejected because its action identifier is invalid'), { [ATTR_ERROR_TYPE]: 'audit_event_invalid' });
      return;
    }

    const { attributes, actor: suppliedActor } = this.projectAuditDetails(eventId, auditDetails);
    const actor = suppliedActor === undefined ? this.resolveActor() : suppliedActor;

    if (actor !== undefined && actor !== null) {
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
   * An absent actor falls back to request context; a rejected actor is null.
   */
  private projectAuditDetails(eventId: string, auditDetails: unknown): { attributes: Record<string, string>; actor: string | null | undefined } {
    const attributes: Record<string, string> = {};
    let actor: string | null | undefined;

    if (auditDetails === undefined) {
      return { attributes, actor };
    }

    if (typeof auditDetails !== 'object' || auditDetails === null || isProxy(auditDetails)) {
      this.log.warn('Unapproved audit metadata omitted', { [ATTR_ERROR_TYPE]: 'audit_metadata_rejected' });
      return { attributes, actor };
    }

    let rejected = false;

    for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(auditDetails))) {
      const value: unknown = descriptor.value;
      const isAuthActor = key === 'userId' && (eventId === 'auth.session-created' || eventId === 'auth.session-destroyed');
      const isLetterId = key === 'letterId' && eventId === 'pdf.get';

      if ((!isAuthActor && !isLetterId) || !('value' in descriptor)) {
        rejected = true;
      } else if (value !== undefined) {
        if (isAdmissibleIdentifier(value)) {
          if (isAuthActor) {
            actor = value;
          } else {
            attributes[ATTR_CDCP_LETTER_ID] = value;
          }
        } else {
          if (isAuthActor) {
            actor = null;
          }

          rejected = true;
        }
      }
    }

    if (rejected) {
      this.log.warn('Unapproved audit metadata omitted', { [ATTR_ERROR_TYPE]: 'audit_metadata_rejected' });
    }

    return { attributes, actor };
  }
}

function isAdmissibleIdentifier(value: unknown): value is string {
  return typeof value === 'string' && /^[a-zA-Z0-9._:-]{1,255}$/.test(value) && !/^\d{3}[-.]?\d{3}[-.]?\d{3}$/.test(value);
}
