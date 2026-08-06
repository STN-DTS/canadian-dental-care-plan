/**
 * Installs import-in-the-middle's synchronous ESM hook before any instrumented
 * module is imported. Node.js 26 supports synchronous hooks, so no asynchronous
 * loader fallback or acknowledgement wait is required.
 *
 * Load this file with `--import` before the OpenTelemetry SDK bootstrap:
 *
 * - Development with tsx: `--import ./app/.server/express-server/opentelemetry-register.ts`
 * - Built server with node: `--import ./build/server/opentelemetry-register.js`
 *
 * The companion `opentelemetry.ts` module starts the SDK after this hook is
 * registered.
 *
 * @see https://github.com/open-telemetry/opentelemetry-js/pull/6922
 * @see https://github.com/open-telemetry/opentelemetry-js/issues/6984
 */
import { register } from 'import-in-the-middle/register-hooks.mjs';

import { createOpenTelemetryLogger } from '~/.server/express-server/opentelemetry-logger';

const log = createOpenTelemetryLogger('opentelemetry-register');

log.info('Registering OpenTelemetry hooks for ESM modules');

register();
