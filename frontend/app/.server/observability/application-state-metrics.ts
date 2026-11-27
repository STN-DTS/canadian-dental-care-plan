import type { Attributes } from '@opentelemetry/api';
import { ATTR_ERROR_TYPE } from '@opentelemetry/semantic-conventions';
import { Option } from 'effect';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context/app-context';
import { createLogger } from '~/.server/logging';
import { ATTR_CDCP_APPLICATION_CHANNEL, ATTR_CDCP_APPLICATION_STATE_OUTCOME, ATTR_CDCP_ROUTE_ID } from '~/.server/logging/log-attributes';
import type { InstrumentationService } from '~/.server/observability/instrumentation-service';
import { matchRouteId } from '~/.server/utils/server-build-utils';
import { findContext, getUrl } from '~/middlewares/context-storage.server';

export type ApplicationStateChannel = 'public' | 'protected';
export type ApplicationStateOutcome = 'missing' | 'expired';

const log = createLogger('observability/application-state-metrics');

/** Counts expected application-state unavailability by bounded request attributes. */
export function countApplicationStateOutcome(channel: ApplicationStateChannel, outcome: ApplicationStateOutcome): void {
  const requestContext = findContext();

  if (Option.isNone(requestContext)) {
    return;
  }

  try {
    const { appContainer } = requestContext.value.get(appContext);
    const routeId = matchRouteId(getUrl().pathname);
    const attributes: Attributes = {
      [ATTR_CDCP_ROUTE_ID]: routeId ?? 'unknown',
      [ATTR_CDCP_APPLICATION_CHANNEL]: channel,
      [ATTR_CDCP_APPLICATION_STATE_OUTCOME]: outcome,
    };
    const instrumentationService: InstrumentationService = appContainer.get(TYPES.InstrumentationService);
    instrumentationService.createCounter('cdcp.application.state.unavailable').add(1, attributes);
  } catch (error: unknown) {
    log.error(error, { [ATTR_ERROR_TYPE]: 'application_state_metric_failed' });
  }
}
