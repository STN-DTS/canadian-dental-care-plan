import type { AnyValue, Attributes } from '@opentelemetry/api';

export type QueryParamsRedactorReplacementFunctionArgs = {
  /**
   * The decoded query parameter name being evaluated for redaction.
   */
  key: string;

  /**
   * The decoded query parameter value being evaluated for redaction.
   */
  value: AnyValue;
};

/**
 * A function that determines the replacement string for a redacted query parameter value.
 */
export type QueryParamsRedactorReplacementFunction = ({ key, value }: QueryParamsRedactorReplacementFunctionArgs) => string;

/**
 * Replacement for a redacted query parameter value, either a string or a function that returns a string.
 */
export type QueryParamsRedactorReplacement = string | QueryParamsRedactorReplacementFunction;

/**
 * A rule that defines how a query parameter should be redacted based on its decoded name or value.
 */
export type QueryParamsRedactorRule =
  | { type: 'key'; match: 'exact' | 'substring'; value: string; replacement?: QueryParamsRedactorReplacement }
  | { type: 'key'; match: 'pattern'; value: RegExp; replacement?: QueryParamsRedactorReplacement }
  | { type: 'value'; pattern: RegExp; replacement?: QueryParamsRedactorReplacement };

/**
 * Options for configuring query parameter redaction.
 */
export interface QueryParamsRedactorAttributesOptions {
  /**
   * Attribute keys whose values are URLs or paths that may contain a query string.
   */
  urlAttributeKeys?: readonly string[];

  /**
   * Attribute keys whose values are standalone query strings.
   */
  queryAttributeKeys?: readonly string[];

  /**
   * Patterns that find complete URLs or paths, including their query strings, in free text.
   */
  embeddedUrlPatterns?: readonly RegExp[];

  /**
   * Whether to scan string attributes outside the URL and query attribute keys for embedded URLs.
   */
  scanOtherStringAttributes?: boolean;

  /**
   * The rules that define which query parameters should be redacted.
   * Replaces the default rule, which redacts every parameter value. An empty list disables parameter redaction.
   */
  redactRules?: readonly QueryParamsRedactorRule[];

  /**
   * The default replacement for redacted query parameter values if not specified in individual rules.
   */
  replacement?: QueryParamsRedactorReplacement;
}

/**
 * The result of an attribute redaction operation, indicating whether any attributes were redacted.
 */
export type QueryParamsRedactorResultRedacted = { redacted: true; attributes: Attributes };

/**
 * The result of an attribute redaction operation when no attributes were redacted.
 */
export type QueryParamsRedactorResultUnredacted = { redacted: false; attributes?: never };

/**
 * The result of an attribute redaction operation, which can be either redacted or unredacted.
 */
export type QueryParamsRedactorResult = QueryParamsRedactorResultRedacted | QueryParamsRedactorResultUnredacted;
