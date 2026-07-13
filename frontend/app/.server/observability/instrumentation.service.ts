/**
 * This file provides useful OpenTelemetry utility functions.
 *
 * References:
 *
 *   - https://www.npmjs.com/package/@opentelemetry/sdk-node
 *   - https://www.dynatrace.com/support/help/extend-dynatrace/opentelemetry
 */
import { invariant } from '@dts-stn/invariant';
import type { Attributes, Counter, Histogram, MetricOptions, Span, SpanOptions } from '@opentelemetry/api';
import { metrics, trace } from '@opentelemetry/api';
import { inject, injectable } from 'inversify';

import type { ServerConfig } from '~/.server/configs';
import { TYPES } from '~/.server/constants';
import type { BuildInfo, BuildInfoService } from '~/.server/core';
import { createLogger } from '~/.server/logging';
import type { Logger } from '~/.server/logging';

export interface InstrumentationService {
  /**
   * A helper function that will count the number of successful or
   * failed requests by examining the http status.
   *
   * @param prefix - The prefix to add to the metric name.
   * @param httpStatus - The HTTP status code.
   * @param options - Optional metric options.
   */
  countHttpStatus(prefix: string, httpStatus: number, options?: MetricOptions): void;
  /**
   * Creates a counter metric.
   *
   * @param name - The name of the counter.
   * @param options - Optional metric options.
   * @returns A counter metric.
   */
  createCounter(name: string, options?: MetricOptions): Counter<Attributes>;
  /**
   * Creates a histogram metric.
   *
   * @param name - The name of the histogram.
   * @param options - Optional metric options.
   * @returns A histogram metric.
   */
  createHistogram(name: string, options?: MetricOptions): Histogram<Attributes>;
  /**
   * Starts an active span.
   * @param name - The name of the span.
   * @param options - Span options (attributes, kind, etc.).
   * @param fn - The function to execute within the span.
   * @param scope - Optional instrumentation scope name (`otel.scope.name`); defaults to the service name.
   * @returns The result of the function.
   */
  startActiveSpan<T extends (span: Span) => unknown>(name: string, options: SpanOptions, fn: T, scope?: string): ReturnType<T>;
}

type DefaultInstrumentationServiceServerConfig = Pick<ServerConfig, 'OTEL_SERVICE_NAME'>;

@injectable()
export class DefaultInstrumentationService implements InstrumentationService {
  private readonly log: Logger;
  private readonly serverConfig: DefaultInstrumentationServiceServerConfig;
  private readonly buildInfo: BuildInfo;

  constructor(@inject(TYPES.ServerConfig) serverConfig: DefaultInstrumentationServiceServerConfig, @inject(TYPES.BuildInfoService) buildInfoService: BuildInfoService) {
    this.log = createLogger('DefaultInstrumentationService');
    this.serverConfig = serverConfig;
    this.buildInfo = buildInfoService.getBuildInfo();
  }

  /**
   * @see https://opentelemetry.io/docs/languages/js/instrumentation/#create-counters
   */
  createCounter(name: string, options?: MetricOptions): Counter<Attributes> {
    const sanitizedName = this.sanitizeMetricName(name);
    return metrics.getMeter(this.serverConfig.OTEL_SERVICE_NAME, this.buildInfo.buildVersion).createCounter(sanitizedName, options);
  }

  /**
   * @see https://opentelemetry.io/docs/languages/js/instrumentation/#using-histograms
   */
  createHistogram(name: string, options?: MetricOptions): Histogram<Attributes> {
    const sanitizedName = this.sanitizeMetricName(name);
    return metrics.getMeter(this.serverConfig.OTEL_SERVICE_NAME, this.buildInfo.buildVersion).createHistogram(sanitizedName, options);
  }

  /**
   * @see https://opentelemetry.io/docs/languages/js/instrumentation/#create-spans
   */
  startActiveSpan<T extends (span: Span) => unknown>(name: string, options: SpanOptions, fn: T, scope = this.serverConfig.OTEL_SERVICE_NAME): ReturnType<T> {
    return trace.getTracer(scope, this.buildInfo.buildVersion).startActiveSpan(name, options, fn);
  }

  /**
   * A helper function that will count the number of successful or
   * failed requests by examining the http status.
   */
  countHttpStatus(prefix: string, httpStatus: number, options?: MetricOptions): void {
    invariant(httpStatus > 0, 'httpStatus must be a positive integer');

    const sanitizedPrefix = this.sanitizeMetricName(prefix);
    this.createCounter(`${sanitizedPrefix}.requests.status.${httpStatus}`, options).add(1);
    this.createCounter(`${sanitizedPrefix}.requests.status.${httpStatus >= 400 ? 'failed' : 'success'}`, options).add(1);
  }

  /**
   * Sanitizes a metric name to follow OpenTelemetry's naming rules:
   * See https://opentelemetry.io/docs/specs/otel/metrics/api/#instrument-name-syntax.
   *
   * Invalid characters are removed, leading non-letters are stripped,
   * and the name is trimmed to 255 characters. A warning is logged if sanitization occurs.
   *
   * @param metricName The raw metric name.
   * @returns A sanitized metric name.
   */
  protected sanitizeMetricName(metricName: string): string {
    const METRIC_NAME_REGEX = /^[a-z][a-z0-9_.\-/]{0,254}$/i;

    if (METRIC_NAME_REGEX.test(metricName)) {
      return metricName;
    }

    const sanitized = metricName
      .replaceAll(/[^a-zA-Z0-9_.\-/]/g, '_') // Replace all invalid characters with `_`
      .replace(/^[^a-zA-Z]+/, ''); // Strip leading non-[a-z] chars

    const trimmed = sanitized.slice(0, 255);
    this.log.warn(`Invalid metric name "${metricName}". Sanitized to "${trimmed}"`);
    return trimmed;
  }
}
