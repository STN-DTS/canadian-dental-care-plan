import type { AnyValue, Attributes } from '@opentelemetry/api';

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
 * A rule that defines how an attribute should be redacted based on its key or value.
 */
export type AttributeRedactorRule =
  | { type: 'key'; match: 'exact' | 'substring'; value: string; replacement?: AttributeRedactorReplacement }
  | { type: 'key'; match: 'pattern'; value: RegExp; replacement?: AttributeRedactorReplacement }
  | { type: 'value'; pattern: RegExp; replacement?: AttributeRedactorReplacement };

/**
 * Options for configuring attribute redaction.
 */
export interface AttributeRedactorAttributesOptions {
  /**
   * The rules that define which attributes should be redacted.
   */
  redactRules?: readonly AttributeRedactorRule[];

  /**
   * The default replacement for redacted attributes if not specified in individual rules.
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
