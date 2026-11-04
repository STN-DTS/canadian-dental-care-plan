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
import type { SpanExporter } from '@opentelemetry/sdk-trace';
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { ATTR_DEPLOYMENT_ENVIRONMENT_NAME } from '@opentelemetry/semantic-conventions/incubating';

function getEnvValue(defaultValue: string, envVar?: string): string {
  return envVar && envVar !== '' ? envVar : defaultValue;
}

function getMetricExporter(): PushMetricExporter {
  if (process.env.OTEL_USE_CONSOLE_EXPORTERS === 'true') {
    return new ConsoleMetricExporter();
  }

  if (process.env.OTEL_METRICS_ENDPOINT) {
    if (!process.env.OTEL_API_KEY) {
      throw new Error('OTEL_API_KEY must be configured when OTEL_METRICS_ENDPOINT is set');
    }

    return new OTLPMetricExporter({
      compression: CompressionAlgorithm.GZIP,
      headers: { Authorization: `Api-Token ${process.env.OTEL_API_KEY}` },
      temporalityPreference: AggregationTemporality.DELTA,
      url: process.env.OTEL_METRICS_ENDPOINT,
    });
  }

  return {
    export: (metrics, resultCallback) => resultCallback({ code: ExportResultCode.SUCCESS }),
    forceFlush: async () => {},
    shutdown: async () => {},
  };
}

function getTraceExporter(): SpanExporter {
  if (process.env.OTEL_USE_CONSOLE_EXPORTERS === 'true') {
    return new ConsoleSpanExporter();
  }

  if (process.env.OTEL_TRACES_ENDPOINT) {
    if (!process.env.OTEL_API_KEY) {
      throw new Error('OTEL_API_KEY must be configured when OTEL_TRACES_ENDPOINT is set');
    }

    return new OTLPTraceExporter({
      compression: CompressionAlgorithm.GZIP,
      headers: { Authorization: `Api-Token ${process.env.OTEL_API_KEY}` },
      url: process.env.OTEL_TRACES_ENDPOINT,
    });
  }

  return {
    export: (spans, resultCallback) => resultCallback({ code: ExportResultCode.SUCCESS }),
    shutdown: async () => {},
  };
}

function toNumber(str?: string): number | undefined {
  const num = Number.parseInt(str ?? '');
  return Number.isNaN(num) ? undefined : num;
}

function getLogRecordProcessor(): {
  enabled: boolean;
  processor: LogRecordProcessor;
} {
  const otelLogsEndpoint = process.env.OTEL_LOGS_ENDPOINT;

  if (!otelLogsEndpoint) {
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

try {
  sdk.start();
  console.log('OpenTelemetry instrumentation initialized.');
} catch (error) {
  console.error('Failed to initialize OpenTelemetry instrumentation:', error);
}

process.once('beforeExit', async () => {
  console.log('Shutting down OpenTelemetry instrumentation...');
  await sdk.shutdown().catch((error) => {
    console.error('Failed to shut down OpenTelemetry instrumentation:', error);
  });
});
