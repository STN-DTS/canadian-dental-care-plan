import type { AnyValue, Attributes } from '@opentelemetry/api';

import type { NameMatch } from '~/instrumentation/instrumentation-utils';

export type AttributeRedactorReplacementFunctionArgs = {
  /**
   * The attribute key being evaluated for redaction.
   */
  key: string;

  /**
   * The attribute value being evaluated for redaction.
   */
  value: AnyValue;
};

/**
 * A function that determines the replacement string for a redacted attribute.
 */
export type AttributeRedactorReplacementFunction = ({ key, value }: AttributeRedactorReplacementFunctionArgs) => string;

/**
 * Replacement for a redacted attribute, either a string or a function that returns a string.
 */
export type AttributeRedactorReplacement = string | AttributeRedactorReplacementFunction;

/**
 * Options for configuring attribute redaction.
 */
export interface AttributeRedactorAttributesOptions {
  /**
   * The attribute keys whose values are replaced. Strings match ignoring case and accents; regexes
   * are tested as given, without the `g` and `y` flags; predicates receive the key and must be
   * pure, because their results are cached. An empty list disables redaction.
   */
  attributeKeys?: readonly NameMatch[];

  /**
   * The replacement for redacted attribute values.
   */
  replacement?: AttributeRedactorReplacement;
}

/**
 * The result of an attribute redaction operation, indicating whether any attributes were redacted.
 */
export type AttributeRedactorResultRedacted = { redacted: true; attributes: Attributes };

/**
 * The result of an attribute redaction operation when no attributes were redacted.
 */
export type AttributeRedactorResultUnredacted = { redacted: false; attributes?: never };

/**
 * The result of an attribute redaction operation, which can be either redacted or unredacted.
 */
export type AttributeRedactorResult = AttributeRedactorResultRedacted | AttributeRedactorResultUnredacted;
