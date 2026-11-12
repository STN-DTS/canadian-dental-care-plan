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
import { ConsoleSpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace';
import { ATTR_ERROR_TYPE, ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { ATTR_DEPLOYMENT_ENVIRONMENT_NAME } from '@opentelemetry/semantic-conventions/incubating';

import { AttributeRedactor } from '~/instrumentation/attribute-redactor';
import { ATTR_CDCP_ERROR_CODE } from '~/instrumentation/log-attributes';
import { operationalErrorCode, operationalErrorType } from '~/instrumentation/operational-error-type';
import { QueryParamsRedactor } from '~/instrumentation/query-params-redactor';
import { RedactAttributesLogRecordProcessor } from '~/instrumentation/redact-attributes-log-record-processor';
import { RedactAttributesSpanProcessor } from '~/instrumentation/redact-attributes-span-processor';
import { RedactQueryParamsLogRecordProcessor } from '~/instrumentation/redact-query-params-log-record-processor';
import { RedactQueryParamsSpanProcessor } from '~/instrumentation/redact-query-params-span-processor';
import { UrlPathRedactor } from '~/instrumentation/url-path-redactor';

/**
 * Maps Winston level names to OpenTelemetry severity numbers for log export.
 */
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

function getLogRecordProcessor(): LogRecordProcessor | undefined {
  const otelLogsEndpoint = process.env.OTEL_LOGS_ENDPOINT;

  if (!otelLogsEndpoint) {
    return;
  }

  if (!process.env.OTEL_API_KEY) {
    throw new Error('OTEL_API_KEY must be configured when OTEL_LOGS_ENDPOINT is set');
  }

  const exporter = new OTLPLogExporter({
    compression: CompressionAlgorithm.GZIP,
    headers: { Authorization: `Api-Token ${process.env.OTEL_API_KEY}` },
    url: otelLogsEndpoint,
  });

  return new BatchLogRecordProcessor({
    exporter,
    exportTimeoutMillis: toNumber(process.env.OTEL_LOGS_EXPORT_TIMEOUT_MILLIS) ?? 5000,
    maxExportBatchSize: toNumber(process.env.OTEL_LOGS_MAX_EXPORT_BATCH_SIZE) ?? 512,
    maxQueueSize: toNumber(process.env.OTEL_LOGS_MAX_QUEUE_SIZE) ?? 2048,
    scheduledDelayMillis: toNumber(process.env.OTEL_LOGS_EXPORT_INTERVAL_MILLIS) ?? 5000,
  });
}

const attributeRedactor = new AttributeRedactor();
const queryParamsRedactor = new QueryParamsRedactor();
const urlPathRedactor = new UrlPathRedactor();
const logRecordProcessor = getLogRecordProcessor();
const disableLogSending = logRecordProcessor === undefined;

const sdk = new NodeSDK({
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-winston': { disableLogSending: disableLogSending },
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
  logRecordProcessors: logRecordProcessor ? [new RedactQueryParamsLogRecordProcessor(queryParamsRedactor), new RedactAttributesLogRecordProcessor(urlPathRedactor), new RedactAttributesLogRecordProcessor(attributeRedactor), logRecordProcessor] : undefined,
  spanProcessors: [
    new RedactQueryParamsSpanProcessor(
      new RedactAttributesSpanProcessor(
        new RedactAttributesSpanProcessor(
          new SimpleSpanProcessor({
            exporter: getTraceExporter(),
          }),
          attributeRedactor,
        ),
        urlPathRedactor,
      ),
      queryParamsRedactor,
    ),
  ],
});

try {
  sdk.start();
  console.log('OpenTelemetry instrumentation initialized.');
} catch (error) {
  const code = operationalErrorCode(error);
  console.error('Failed to initialize OpenTelemetry instrumentation.', { [ATTR_ERROR_TYPE]: operationalErrorType(error), ...(code && { [ATTR_CDCP_ERROR_CODE]: code }) });
}

process.once('beforeExit', async () => {
  console.log('Shutting down OpenTelemetry instrumentation...');
  await sdk.shutdown().catch((error: unknown) => {
    const code = operationalErrorCode(error);
    console.error('Failed to shut down OpenTelemetry instrumentation.', { [ATTR_ERROR_TYPE]: operationalErrorType(error), ...(code && { [ATTR_CDCP_ERROR_CODE]: code }) });
  });
});
