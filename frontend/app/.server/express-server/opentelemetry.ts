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
 * Creates a BatchLogRecordProcessor that exports logs to an OTLP collector when
 * OTEL_LOGS_ENDPOINT is configured. Returns an empty array when the endpoint is
 * absent so the existing stdout/file transports continue operating unchanged.
 *
 * The initialisation is wrapped in a try/catch so that any misconfiguration or
 * exporter setup error is logged and does NOT prevent the application from starting.
 *
 * Authentication is provided via OTEL_LOGS_AUTHORIZATION as a full header value
 * (e.g. "******" or "Api-Token <token>") to remain collector-agnostic.
 * It is intentionally separate from OTEL_API_KEY to avoid sending Dynatrace
 * credentials to a different backend.
 */
function getLogRecordProcessors(): LogRecordProcessor[] {
  const endpoint = process.env.OTEL_LOGS_ENDPOINT;

  if (!endpoint) {
    log.debug('Log exporting is disabled; set OTEL_LOGS_ENDPOINT to enable.');
    return [];
  }

  try {
    const headers: Record<string, string> = {};

    if (process.env.OTEL_LOGS_AUTHORIZATION) {
      headers.Authorization = process.env.OTEL_LOGS_AUTHORIZATION;
    }

    log.info('Exporting logs to %s', endpoint);

    const exporter = new OTLPLogExporter({
      compression: CompressionAlgorithm.GZIP,
      headers,
      url: endpoint,
    });

    return [
      new BatchLogRecordProcessor({
        exporter,
        exportTimeoutMillis: toNumber(process.env.OTEL_LOGS_EXPORT_TIMEOUT_MILLIS) ?? 5000,
        maxExportBatchSize: toNumber(process.env.OTEL_LOGS_MAX_EXPORT_BATCH_SIZE) ?? 512,
        maxQueueSize: toNumber(process.env.OTEL_LOGS_MAX_QUEUE_SIZE) ?? 2048,
        scheduledDelayMillis: toNumber(process.env.OTEL_LOGS_EXPORT_INTERVAL_MILLIS) ?? 5000,
      }),
    ];
  } catch (error) {
    log.error('Failed to initialize log exporter; log exporting will be disabled. Error: %s', error);
    return [];
  }
}

log.info('Initializing instrumentation');

const logRecordProcessors = getLogRecordProcessors();

const sdk = new NodeSDK({
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-winston': { disableLogSending: logRecordProcessors.length === 0 },
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
  logRecordProcessors,
  traceExporter: getTraceExporter(),
});

sdk.start();
process.once('beforeExit', async () => {
  log.info('Shutting down instrumentation');
  await sdk.shutdown().catch((error) => {
    log.error('Error during instrumentation shutdown: %s', error);
  });
});
