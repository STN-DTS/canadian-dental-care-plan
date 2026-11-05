import type { Attributes } from '@opentelemetry/api';

import type { AttributeRedactorAttributesOptions, AttributeRedactorReplacement, AttributeRedactorResult } from '~/instrumentation/attribute-redactor-types';
import { BoundedCache, createNameMatcher } from '~/instrumentation/instrumentation-utils';

/**
 * The default options match common credential and sensitive-data names, plus database statement,
 * request-body, and email attributes. Client IP addresses are kept for monitoring.
 */
export const DEFAULT_REDACT_ATTRIBUTES_OPTIONS = {
  attributeKeys: [/password|secret|token|api[-_]?key|authorization|credential|ssn|(?:^|[._-])sin(?:[._-]|$)|credit[-_]?card|cookie|db\.statement|db\.query\.text|http\.request\.body|user\.email/i],
  replacement: '[REDACTED]',
} as const satisfies AttributeRedactorAttributesOptions;

/**
 * Span and log attribute keys come from instrumentation code, so they form a small set worth caching.
 */
const ATTRIBUTE_KEY_CACHE_SIZE = 1000;

/**
 * Replaces the whole value of listed attributes. Attribute values are never inspected.
 */
export class AttributeRedactor {
  private readonly matchesAttributeKey: (key: string) => boolean;
  private readonly attributeKeyCache = new BoundedCache<string, boolean>(ATTRIBUTE_KEY_CACHE_SIZE);
  private readonly enabled: boolean;
  private readonly replacement: AttributeRedactorReplacement;

  constructor(options: AttributeRedactorAttributesOptions = {}) {
    const attributeKeys = options.attributeKeys ?? DEFAULT_REDACT_ATTRIBUTES_OPTIONS.attributeKeys;
    this.matchesAttributeKey = createNameMatcher(attributeKeys);
    this.enabled = attributeKeys.length > 0;
    this.replacement = options.replacement ?? DEFAULT_REDACT_ATTRIBUTES_OPTIONS.replacement;
  }

  /**
   * Replaces the values of attributes whose keys are listed.
   *
   * @param attributes The attributes to be redacted.
   * @returns The result of the redaction operation, indicating whether any attributes were redacted.
   */
  redactAttributes(attributes: Attributes): AttributeRedactorResult {
    if (!this.enabled) {
      return { redacted: false };
    }

    let redactedAttributes: Attributes | undefined;

    for (const [key, value] of Object.entries(attributes)) {
      if (!this.isAttributeKey(key)) {
        continue;
      }

      const redactedValue = typeof this.replacement === 'function' ? this.replacement({ key, value }) : this.replacement;

      if (redactedValue !== value) {
        redactedAttributes ??= { ...attributes };
        redactedAttributes[key] = redactedValue;
      }
    }

    return redactedAttributes === undefined ? { redacted: false } : { redacted: true, attributes: redactedAttributes };
  }

  private isAttributeKey(key: string): boolean {
    return this.attributeKeyCache.getOrSet(key, () => this.matchesAttributeKey(key));
  }
}
