import type { Attributes } from '@opentelemetry/api';
import type { ReadableSpan } from '@opentelemetry/sdk-trace';

// Only type imports so the telemetry preload loads no packages before instrumentation is enabled.

const baseSensitivityCollator = new Intl.Collator(undefined, { sensitivity: 'base' });

/**
 * Checks whether two strings are equal, ignoring case and accents.
 * Uses a shared `Intl.Collator` with `sensitivity: 'base'` for hot paths.
 *
 * @param a - First string to compare.
 * @param b - Second string to compare.
 * @returns `true` when the strings differ only by case or accents.
 */
export function fastCaseInsensitiveEqual(a: string, b: string): boolean {
  if (a === b) {
    return true;
  }

  // No length shortcut: collator-equal strings can differ in length, such as "a" and "a\u0301".
  return baseSensitivityCollator.compare(a, b) === 0;
}

export function withSpanAttributes(span: ReadableSpan, attributes: Attributes): ReadableSpan {
  // SDK spans keep methods and some readable properties on their prototype, which object spread skips.
  return {
    name: span.name,
    kind: span.kind,
    spanContext: () => span.spanContext(),
    parentSpanContext: span.parentSpanContext,
    startTime: span.startTime,
    endTime: span.endTime,
    status: span.status,
    attributes,
    links: span.links,
    events: span.events,
    duration: span.duration,
    ended: span.ended,
    resource: span.resource,
    instrumentationScope: span.instrumentationScope,
    droppedAttributesCount: span.droppedAttributesCount,
    droppedEventsCount: span.droppedEventsCount,
    droppedLinksCount: span.droppedLinksCount,
  };
}
