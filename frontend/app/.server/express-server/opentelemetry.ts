import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { ExportResultCode } from '@opentelemetry/core';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-proto';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-proto';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { CompressionAlgorithm } from '@opentelemetry/otlp-exporter-base';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import type { LogRecordProcessor } from '@opentelemetry/sdk-logs';
import type { PushMetricExporter } from '@opentelemetry/sdk-metrics';
import { AggregationTemporality, ConsoleMetricExporter, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { NodeSDK } from '@opentelemetry/sdk-node';
import type { SpanExporter } from '@opentelemetry/sdk-trace-base';
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-base';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { ATTR_DEPLOYMENT_ENVIRONMENT_NAME } from '@opentelemetry/semantic-conventions/incubating';

import { createOpenTelemetryLogger } from '~/.server/express-server/opentelemetry-logger';

const log = createOpenTelemetryLogger('OpenTelemetry');

/**
 * Gets the environment variable value, falling back to a default value if the environment variable is not set or is empty.
 */
function getEnvValue(defaultValue: string, envVar?: string): string {
  return envVar && envVar !== '' ? envVar : defaultValue;
}

function getMetricExporter(): PushMetricExporter {
  if (process.env.OTEL_USE_CONSOLE_EXPORTERS === 'true') {
    log.info('Exporting metrics to console');
    return new ConsoleMetricExporter();
  }

  if (process.env.OTEL_METRICS_ENDPOINT) {
    if (!process.env.OTEL_API_KEY) {
      throw new Error('OTEL_API_KEY must be configured when OTEL_METRICS_ENDPOINT is set');
    }

    log.info(`Exporting metrics to %s`, process.env.OTEL_METRICS_ENDPOINT);

    return new OTLPMetricExporter({
      compression: CompressionAlgorithm.GZIP,
      headers: { Authorization: `Api-Token ${process.env.OTEL_API_KEY}` },
      temporalityPreference: AggregationTemporality.DELTA,
      url: process.env.OTEL_METRICS_ENDPOINT,
    });
  }

  log.info('Metrics exporting is disabled; set OTEL_METRICS_ENDPOINT or OTEL_USE_CONSOLE_EXPORTERS to enable.');

  return {
    // a no-op PushMetricExporter implementation
    export: (metrics, resultCallback) => resultCallback({ code: ExportResultCode.SUCCESS }),
    forceFlush: async () => {},
    shutdown: async () => {},
  };
}

function getTraceExporter(): SpanExporter {
  if (process.env.OTEL_USE_CONSOLE_EXPORTERS === 'true') {
    log.info('Exporting traces to console');
    return new ConsoleSpanExporter();
  }

  if (process.env.OTEL_TRACES_ENDPOINT) {
    if (!process.env.OTEL_API_KEY) {
      throw new Error('OTEL_API_KEY must be configured when OTEL_TRACES_ENDPOINT is set');
    }

    log.info('Exporting traces to %s', process.env.OTEL_TRACES_ENDPOINT);

    return new OTLPTraceExporter({
      compression: CompressionAlgorithm.GZIP,
      headers: { Authorization: `Api-Token ${process.env.OTEL_API_KEY}` },
      url: process.env.OTEL_TRACES_ENDPOINT,
    });
  }

  log.info('Traces exporting is disabled; set OTEL_TRACES_ENDPOINT or OTEL_USE_CONSOLE_EXPORTERS to enable.');

  return {
    // a no-op SpanExporter implementation
    export: (spans, resultCallback) => resultCallback({ code: ExportResultCode.SUCCESS }),
    shutdown: async () => {},
  };
}

/**
 * Transforms a string into an integer.
 * Will return undefined if the string can't be transformed.
 */
function toNumber(str?: string): number | undefined {
  const num = Number.parseInt(str ?? '');
  return Number.isNaN(num) ? undefined : num;
}

/**
 * Creates a log record processor that exports logs to an OTLP collector when
 * OTEL_LOGS_ENDPOINT is configured. Returns a no-op processor with `enabled: false`
 * when the endpoint is absent, so existing stdout/file transports continue operating.
 *
 * OTEL_API_KEY is required when OTEL_LOGS_ENDPOINT is configured and is sent as
 * an `Authorization: Api-Token ...` header to the collector.
 */
function getLogRecordProcessor(): {
  /** Whether the log record processor is enabled (i.e. OTEL_LOGS_ENDPOINT is configured). */
  enabled: boolean;
  /** The log record processor instance. */
  processor: LogRecordProcessor;
} {
  const otelLogsEndpoint = process.env.OTEL_LOGS_ENDPOINT;

  if (!otelLogsEndpoint) {
    log.debug('Log exporting is disabled; set OTEL_LOGS_ENDPOINT to enable.');
    // Return no-op LogRecordProcessor implementation
    return {
      enabled: false,
      processor: {
        forceFlush: async () => {},
        onEmit: () => {},
        shutdown: async () => {},
      },
    };
  }

  if (!process.env.OTEL_API_KEY) {
    throw new Error('OTEL_API_KEY must be configured when OTEL_LOGS_ENDPOINT is set');
  }

  log.info('Exporting logs to %s', otelLogsEndpoint);

  const exporter = new OTLPLogExporter({
    compression: CompressionAlgorithm.GZIP,
    headers: { Authorization: `Api-Token ${process.env.OTEL_API_KEY}` },
    url: otelLogsEndpoint,
  });

  return {
    enabled: true,
    processor: new BatchLogRecordProcessor({
      exporter,
      exportTimeoutMillis: toNumber(process.env.OTEL_LOGS_EXPORT_TIMEOUT_MILLIS) ?? 5000,
      maxExportBatchSize: toNumber(process.env.OTEL_LOGS_MAX_EXPORT_BATCH_SIZE) ?? 512,
      maxQueueSize: toNumber(process.env.OTEL_LOGS_MAX_QUEUE_SIZE) ?? 2048,
      scheduledDelayMillis: toNumber(process.env.OTEL_LOGS_EXPORT_INTERVAL_MILLIS) ?? 5000,
    }),
  };
}

log.info('Initializing instrumentation');

const logRecordProcessor = getLogRecordProcessor();

const sdk = new NodeSDK({
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-winston': { disableLogSending: !logRecordProcessor.enabled },
    }),
  ],

  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: getEnvValue('canadian-dental-care-plan', process.env.OTEL_SERVICE_NAME),
    [ATTR_SERVICE_VERSION]: getEnvValue('0.0.0', process.env.OTEL_SERVICE_VERSION),
    [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: getEnvValue('localhost', process.env.OTEL_ENVIRONMENT),
  }),

  metricReaders: [
    new PeriodicExportingMetricReader({
      exporter: getMetricExporter(),
      exportIntervalMillis: toNumber(process.env.OTEL_METRICS_EXPORT_INTERVAL_MILLIS),
      exportTimeoutMillis: toNumber(process.env.OTEL_METRICS_EXPORT_TIMEOUT_MILLIS),
    }),
  ],
  logRecordProcessors: [logRecordProcessor.processor],
  traceExporter: getTraceExporter(),
});

sdk.start();
process.once('beforeExit', async () => {
  log.info('Shutting down instrumentation');
  await sdk.shutdown().catch((error) => {
    log.error('Error during instrumentation shutdown: %s', error);
  });
});
