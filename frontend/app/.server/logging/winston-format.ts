import { isEmpty, omit } from 'moderndash';
import { inspect } from 'node:util';
import { LEVEL, MESSAGE, SPLAT } from 'triple-beam';
import { format } from 'winston';
import type { Logform } from 'winston';

import { dynatraceLogLevelMapping, maxLogLevelNameLength, otelSeverityNumberMapping } from '~/.server/logging/log-levels';
import type { LogLevel } from '~/.server/logging/log-levels';
import { URL_PATH_ATTRIBUTE_KEYS, UrlPathRedactor } from '~/instrumentation/url-path-redactor';

export function formatUrlPaths(): Logform.Format {
  const redactor = new UrlPathRedactor();

  return format((info) => {
    for (const key of URL_PATH_ATTRIBUTE_KEYS) {
      const value = info[key];

      if (typeof value === 'string' || (Array.isArray(value) && value.every((item) => typeof item === 'string'))) {
        info[key] = redactor.redactValue(value);
      }
    }

    return info;
  })();
}

type FormatLevelsOptions = {
  /**
   * Custom padding length (defaults to maxLogLevelNameLength)
   */
  padMaxLength?: number;
};

/**
 * Winston format that uppercases and pads the log level for alignment.
 *
 * Transforms `info.level` to uppercase and pads it to a fixed width
 * defined by `padMaxLength` (or `maxLogLevelNameLength` fallback).
 * This ensures consistent visual alignment of log output regardless of level name length.
 *
 * @param options - Configuration options
 * @returns A Winston formatter that modifies the log level
 */
export function formatLevels(options?: FormatLevelsOptions): Logform.Format {
  const { padMaxLength = maxLogLevelNameLength } = options ?? {};

  return format((info) => {
    const level = info[LEVEL]?.toUpperCase().padStart(padMaxLength);

    if (!level) {
      return info;
    }

    // Assign formatted level
    info.level = level;
    return info;
  })();
}

/**
 * Sets `info.severityNumber` and `info.severityText` from Winston's canonical
 * `LEVEL` symbol, not the potentially formatted `info.level` display value.
 *
 * Values come from `otelSeverityNumberMapping`, so `http` becomes `8`/`DEBUG4`
 * and `audit` becomes `9`/`INFO`. Every sink, including the OpenTelemetry
 * exporter, receives them as record fields.
 *
 * Mapped levels overwrite both fields. Missing, empty or unsupported canonical
 * levels leave the entire record unchanged; no fallback is assigned.
 *
 * @returns A formatter that updates and returns the original log record.
 */
export function addOtelSeverity(): Logform.Format {
  return format((info) => {
    const level = info[LEVEL];

    if (!level || !Object.hasOwn(otelSeverityNumberMapping, level)) {
      return info;
    }

    const severity = otelSeverityNumberMapping[level as LogLevel];
    info.severityNumber = severity.number;
    info.severityText = severity.text;
    return info;
  })();
}

/**
 * Sets `info.logLevel` to the Dynatrace label for Winston's canonical `LEVEL`
 * symbol. The application `http` level maps to `DEBUG`; `audit` maps to `INFO`.
 *
 * Mapped levels overwrite `info.logLevel`. Missing, empty or unsupported
 * canonical levels leave the entire record unchanged; no fallback is assigned.
 * This formatter does not modify `info.severityNumber`, `info.severityText` or
 * either Winston level field.
 *
 * @returns A formatter that updates and returns the original log record.
 */
export function addDynatraceLogLevel(): Logform.Format {
  return format((info) => {
    const level = info[LEVEL];

    if (!level || !Object.hasOwn(dynatraceLogLevelMapping, level)) {
      return info;
    }

    info.logLevel = dynatraceLogLevelMapping[level as LogLevel];
    return info;
  })();
}

type FormatLabelsOptions = {
  /**
   * The default value used when `info.label` is missing (default: 'unlabeled')
   */
  fallback?: string;

  /**
   * The maximum allowed length for the label before truncation (default: 25)
   */
  maxLength?: number;
};

/**
 * Winston format that standardizes labels for consistent display in log output.
 *
 * Processes the `info.label` field to ensure the following:
 * 1. Uses a default value (`fallback`) if the label is missing.
 * 2. Truncates the label with an ellipsis (`…`) if it exceeds `maxLength`,
 *    preserving the last `maxLength - 1` characters to fit the ellipsis.
 * 3. Applies left-padding to align shorter labels to the specified `maxLength`.
 * 4. Wraps the final label in square brackets for visibility and consistency.
 *
 * @param options - Configuration options for label formatting:
 * @returns A Winston formatter that formats the `info.label` field according to the specified options.
 */
export function formatLabels(options?: FormatLabelsOptions): Logform.Format {
  const { fallback = 'unlabeled', maxLength = 20 } = options ?? {};

  return format((info) => {
    const rawLabel = String(info.label ?? fallback);

    // Format label with truncation and padding
    // oxfmt-ignore
    const paddedOrTruncated = rawLabel.length > maxLength
      ? '…' + rawLabel.slice(rawLabel.length - (maxLength - 1)) // Leave space for ellipsis
      : rawLabel.padStart(maxLength);

    // Apply the formatted label
    info.label = `[${paddedOrTruncated}]`;
    return info;
  })();
}

/**
 * Formats Winston logs into a structured, human-readable console output.
 *
 * Creates a consistent output format with timestamp, level, optional trace context,
 * label, message, and any additional metadata. Trace context uses the compact
 * `[trace_id,span_id]` format and is omitted when neither identifier exists.
 * `trace_flags` is intentionally excluded from the rendered output.
 * Metadata is displayed using Node.js's `util.inspect` when present.
 *
 * Output format:
 *   "timestamp LEVEL [trace_id,span_id] [label] : message {metadata}"
 *
 * The trace context block and metadata suffix are optional.
 *
 * @returns A Winston formatter using printf for log message formatting
 */
export function formatPrintf(): Logform.Format {
  return format.printf((info) => {
    // Exclude trace_flags from generic metadata; it is intentionally not rendered.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { label, level, message, timestamp, trace_id, span_id, trace_flags, ...rest } = info;

    const traceContext = formatTraceContext(trace_id, span_id);

    const formattedTraceContext = traceContext ? ` [${traceContext}]` : '';

    let msg = `${timestamp} ${level}${formattedTraceContext} ${label} : ${message}`;

    // Append metadata if present, excluding Winston's internal properties
    if (!isEmpty(rest)) {
      const stripped = omit(rest, [LEVEL, MESSAGE, SPLAT]);

      // Only append metadata if there are still properties after stripped internals
      if (!isEmpty(stripped)) {
        msg += ` ${inspect(stripped, { breakLength: Infinity, colors: true })}`;
      }
    }

    return msg;
  });
}

/**
 * Formats OpenTelemetry trace context as a compact comma-separated value list.
 *
 * Values are emitted in trace ID, span ID, and trace flags order. Missing values
 * are omitted without leaving extra commas. Fixed conditional concatenation avoids
 * temporary arrays and supports adding future context fields without changing the
 * output contract.
 *
 * @param traceId - OpenTelemetry trace ID.
 * @param spanId - OpenTelemetry span ID.
 * @param traceFlags - Optional OpenTelemetry trace flags.
 * @returns Formatted trace context, or an empty string when all values are missing.
 */
function formatTraceContext(traceId: unknown, spanId: unknown, traceFlags?: unknown): string {
  let traceContext = '';
  let hasValue = false;

  if (traceId) {
    traceContext += String(traceId);
    hasValue = true;
  }

  if (spanId) {
    traceContext += `${hasValue ? ',' : ''}${String(spanId)}`;
    hasValue = true;
  }

  if (traceFlags) {
    traceContext += `${hasValue ? ',' : ''}${String(traceFlags)}`;
  }

  return traceContext;
}
