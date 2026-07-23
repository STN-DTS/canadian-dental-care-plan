import { getEnv } from '~/.server/utils/env-utils';

type ContextualAlertType = 'info' | 'success' | 'danger' | 'warning';

/**
 * @param statusId - the statusId of the application to check
 * @param nullStatusMapping- the type to return if a null statusId is supplied; defaults to 'info'
 * @returns the "info" | "success" | "danger" | "warning" which is consumed by the ContextualAlert component
 */
export function getContextualAlertType(statusId: string | null, nullStatusMapping: ContextualAlertType = 'info'): ContextualAlertType {
  const { CLIENT_STATUS_SUCCESS_ID, INVALID_CLIENT_FRIENDLY_STATUS } = getEnv();

  if (statusId === null) {
    return nullStatusMapping;
  }

  switch (statusId) {
    case INVALID_CLIENT_FRIENDLY_STATUS: {
      return 'danger';
    }
    case CLIENT_STATUS_SUCCESS_ID: {
      return 'success';
    }
    default: {
      return 'info';
    }
  }
}
