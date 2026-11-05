import type { AnyValue, Attributes } from '@opentelemetry/api';

import type { NameMatch } from '~/instrumentation/instrumentation-utils';

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
 * Options for configuring query parameter redaction.
 */
export interface QueryParamsRedactorAttributesOptions {
  /**
   * Attribute keys whose values are URLs, slash-prefixed paths, or query strings. Strings match
   * ignoring case and accents; regular expressions follow their own flags; predicates receive the
   * key and must be pure, because their results are cached. Other attributes are left unchanged.
   */
  attributeKeys?: readonly NameMatch[];

  /**
   * Decoded query parameter names whose values are redacted. Strings match ignoring case and
   * accents; regular expressions follow their own flags; predicates receive the name and run for
   * every parameter. Defaults to every name not in `SAFE_QUERY_PARAMETER_NAMES`; an empty list
   * redacts nothing.
   */
  parameterNames?: readonly NameMatch[];

  /**
   * The replacement for redacted query parameter values.
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
