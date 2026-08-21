import { isEmpty, omit } from 'moderndash';
import { inspect } from 'node:util';
import { LEVEL, MESSAGE, SPLAT } from 'triple-beam';
import { format } from 'winston';
import type { Logform } from 'winston';

import { maxLogLevelNameLength } from '~/.server/logging/log-levels';
import { isValidSin } from '~/utils/sin-utils';

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
    const level = info.level.toUpperCase().padStart(padMaxLength);
    // Assign formatted level
    info.level = level;
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
    // prettier-ignore
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
 *   "timestamp LEVEL [trace_id,span_id] [label] : message --- {metadata}"
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
        msg += ` --- ${inspect(stripped, false, 4, true)}`;
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

/**
 * Matches Canadian SIN patterns in any formatting:
 *   - 9 consecutive digits: 123456789
 *   - space-separated:      123 456 789
 *   - hyphen-separated:     123-456-789
 *
 * Negative digit lookahead/lookbehind ensures sequences longer than 9 digits
 * (e.g. 123456789009890) are never matched.
 *
 * Only the last 3 digits are preserved: ***-***-789
 */
const SIN_PATTERN = /(?<!["\d])("?)(\d{3}[\s-]?\d{3}[\s-]?(\d{3}))\1(?!["\d])/g;

/**
 * Recursively sanitizes values before Winston sends them to transports.
 *
 * Strings are scanned for valid SINs and replaced with their masked form.
 * Safe-integer values are checked as unformatted SINs, while arrays and plain
 * objects are copied and sanitized recursively. Other values, including class
 * instances and Winston's symbol-keyed fields, are returned unchanged.
 *
 * @param value - The log message or metadata value to sanitize.
 * @param seen - Previously sanitized containers, used to preserve shared and circular references.
 * @returns A sanitized value, or the original value when no supported masking applies.
 */
function sanitizeSensitiveValue(value: unknown, seen: WeakMap<object, unknown>): unknown {
  if (typeof value === 'string') {
    // Regex consumes optional surrounding quotes so JSON strings are not double-quoted.
    return value.replaceAll(SIN_PATTERN, (_match, _quote, sin, last3: string) => {
      return isValidSin(sin) ? `"***-***-${last3}"` : _match;
    });
  }

  if (typeof value === 'number' && Number.isSafeInteger(value)) {
    // Unsafe integers may have lost digits during coercion, so never classify them as SINs.
    const sin = String(value);

    if (isValidSin(sin)) {
      return `"***-***-${sin.slice(-3)}"`;
    }
  }

  if (Array.isArray(value)) {
    // Register container before descending so self-references resolve without recursion overflow.
    const existing = seen.get(value);
    if (existing) {
      return existing;
    }

    const sanitized: unknown[] = [];
    seen.set(value, sanitized);

    for (const [index, item] of value.entries()) {
      sanitized[index] = sanitizeSensitiveValue(item, seen);
    }

    return sanitized;
  }

  if (value !== null && typeof value === 'object') {
    const prototype = Object.getPrototypeOf(value);

    if (prototype === Object.prototype || prototype === null) {
      // Preserve null-prototype records and register output before traversing circular properties.
      const existing = seen.get(value);
      if (existing) {
        return existing;
      }

      const sanitized = Object.create(prototype) as Record<string, unknown>;
      seen.set(value, sanitized);

      for (const [key, nestedValue] of Object.entries(value)) {
        // defineProperty avoids treating a user-provided "__proto__" key as a prototype mutation.
        Object.defineProperty(sanitized, key, {
          configurable: true,
          enumerable: true,
          value: sanitizeSensitiveValue(nestedValue, seen),
          writable: true,
        });
      }

      return sanitized;
    }
  }

  return value;
}

/**
 * Winston format transform that sanitizes every enumerable string-keyed field
 * on an `info` object before transports receive it. It should run after
 * `format.splat()` so interpolated `%s`/`%j` values are included in `message`.
 *
 * Strings and safe-integer SINs are masked directly. Arrays and plain objects
 * are copied and sanitized recursively. Non-plain objects and symbol-keyed
 * fields are left unchanged.
 *
 * Candidate matches are verified with `isValidSin` (Luhn checksum + format rules)
 * to avoid masking legitimate 9-digit reference codes and option-set IDs.
 *
 * Masked values are emitted as quoted strings (for example, `"***-***-782"`)
 * because a masked SIN is no longer a valid number. Existing quotes around
 * string SINs are consumed so values are not double-quoted.
 *
 * @returns A Winston format that returns the sanitized `info` object.
 */
export const formatSensitiveData = format((info) => {
  const seen = new WeakMap<object, unknown>();

  // Object.keys intentionally excludes Winston's symbol-keyed internal fields.
  for (const key of Object.keys(info)) {
    info[key] = sanitizeSensitiveValue(info[key], seen);
  }

  // SPLAT retains original interpolation and metadata arguments after format.splat().
  if (SPLAT in info) {
    info[SPLAT] = sanitizeSensitiveValue(info[SPLAT], seen);
  }

  return info;
});
