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

/**
 * Decides whether a name matches. It must return the same result for the same name, because
 * attribute-key decisions are cached.
 */
export type NamePredicate = (name: string) => boolean;

/**
 * A name to match: a string compared ignoring case and accents, a regular expression, or a predicate.
 */
export type NameMatch = string | RegExp | NamePredicate;

/**
 * Compiles names into a single matcher. An exact `Set` lookup runs first, then the collator
 * comparison against each string, then each regex, then each predicate. Regexes are copied without
 * the `g` and `y` flags so `test` keeps no `lastIndex` state between calls.
 */
export function createNameMatcher(names: readonly NameMatch[]): NamePredicate {
  const strings: string[] = [];
  const tests: NamePredicate[] = [];
  const predicates: NamePredicate[] = [];

  for (const name of names) {
    if (typeof name === 'string') {
      strings.push(name);
    } else if (name instanceof RegExp) {
      const pattern = new RegExp(name.source, name.flags.replace(/[gy]/g, ''));
      tests.push((value) => pattern.test(value));
    } else {
      predicates.push(name);
    }
  }

  // Regexes run before predicates so cheap built-in checks short-circuit caller code.
  tests.push(...predicates);
  const exact = new Set(strings);

  return (name) => exact.has(name) || strings.some((value) => fastCaseInsensitiveEqual(value, name)) || tests.some((test) => test(name));
}

/**
 * Returns `value` when it is a non-negative integer, otherwise throws.
 */
export function toNonNegativeInteger(name: string, value: number): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative integer, received ${value}`);
  }

  return value;
}

/**
 * A map that holds at most `maxSize` entries. When full, adding a new entry clears it first,
 * which keeps memory bounded when keys come from untrusted input. A `maxSize` of 0 disables caching.
 */
export class BoundedCache<K, V extends NonNullable<unknown> | null> {
  private readonly entries = new Map<K, V>();
  private readonly maxSize: number;

  constructor(maxSize: number) {
    this.maxSize = toNonNegativeInteger('maxSize', maxSize);
  }

  get size(): number {
    return this.entries.size;
  }

  /**
   * Returns the cached value for `key`, computing and storing it on a miss.
   */
  getOrSet(key: K, compute: () => V): V {
    const cached = this.entries.get(key);

    if (cached !== undefined) {
      return cached;
    }

    const value = compute();

    if (this.maxSize > 0) {
      if (this.entries.size >= this.maxSize) {
        this.entries.clear();
      }

      this.entries.set(key, value);
    }

    return value;
  }
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
