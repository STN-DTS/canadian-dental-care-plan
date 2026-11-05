import type { AnyValue, Attributes } from '@opentelemetry/api';
import { ATTR_URL_FULL, ATTR_URL_QUERY } from '@opentelemetry/semantic-conventions';

import { BoundedCache, createNameMatcher } from '~/instrumentation/instrumentation-utils';
import type { QueryParamsRedactorAttributesOptions, QueryParamsRedactorReplacement, QueryParamsRedactorResult } from '~/instrumentation/query-params-redactor-types';

/**
 * Query parameter names known to carry no personal data or secrets, taken from the parameters this
 * app sends and receives. Every other parameter is redacted, so a new parameter stays hidden until
 * someone adds it here. Names are compared exactly.
 */
export const SAFE_QUERY_PARAMETER_NAMES: ReadonlySet<string> = new Set(['$expand', '$orderby', '$select', 'client_id', 'code_challenge_method', 'engage', 'error', 'lang', 'locale', 'response_type', 'scenario', 'scope', 'sort']);

/**
 * The default options for query parameter redaction. `react_router.url` is the full request URL that
 * the app's React Router spans record; it is a literal because the preload cannot import `app/.server`.
 */
export const DEFAULT_REDACT_QUERY_PARAMS_OPTIONS = {
  attributeKeys: [ATTR_URL_FULL, 'http.url', 'http.target', ATTR_URL_QUERY, 'react_router.url'],
  parameterNames: [(name: string) => !SAFE_QUERY_PARAMETER_NAMES.has(name)],
  replacement: '[REDACTED]',
} as const satisfies QueryParamsRedactorAttributesOptions;

/**
 * Span and log attribute keys come from instrumentation code, so they form a small set worth caching.
 * Query parameter names come from requests and are not cached.
 */
const ATTRIBUTE_KEY_CACHE_SIZE = 1000;

/**
 * Redacts the values of named query parameters in attributes that hold URLs, paths, or query strings.
 */
export class QueryParamsRedactor {
  private readonly matchesAttributeKey: (key: string) => boolean;
  private readonly attributeKeyCache = new BoundedCache<string, boolean>(ATTRIBUTE_KEY_CACHE_SIZE);
  private readonly isParameterName: (name: string) => boolean;
  private readonly enabled: boolean;
  private readonly replacement: QueryParamsRedactorReplacement;

  constructor(options: QueryParamsRedactorAttributesOptions = {}) {
    const attributeKeys = options.attributeKeys ?? DEFAULT_REDACT_QUERY_PARAMS_OPTIONS.attributeKeys;
    const parameterNames = options.parameterNames ?? DEFAULT_REDACT_QUERY_PARAMS_OPTIONS.parameterNames;
    this.matchesAttributeKey = createNameMatcher(attributeKeys);
    this.isParameterName = createNameMatcher(parameterNames);
    this.enabled = attributeKeys.length > 0 && parameterNames.length > 0;
    this.replacement = options.replacement ?? DEFAULT_REDACT_QUERY_PARAMS_OPTIONS.replacement;
  }

  redactAttributes(attributes: Attributes): QueryParamsRedactorResult {
    if (!this.enabled) {
      return { redacted: false };
    }

    let redactedAttributes: Attributes | undefined;

    for (const [key, value] of Object.entries(attributes)) {
      if (!this.isAttributeKey(key)) {
        continue;
      }

      const redactedValue = this.redactValue(value);

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

  private redactValue(value: AnyValue): AnyValue {
    if (typeof value === 'string') {
      return this.redactQuery(value);
    }

    if (Array.isArray(value) && value.every((item) => typeof item === 'string')) {
      const redacted = value.map((item) => this.redactQuery(item));
      return redacted.some((item, index) => item !== value[index]) ? redacted : value;
    }

    return value;
  }

  /**
   * Redacts the query of an absolute URL or slash-prefixed path, or of a query string with an optional
   * leading `?`. Everything outside the query, including the fragment, is preserved.
   */
  private redactQuery(value: string): string {
    const isUrl = value.startsWith('/') || URL.canParse(value);
    const queryStart = isUrl ? value.indexOf('?') + 1 : value.startsWith('?') ? 1 : 0;
    const fragmentStart = value.indexOf('#');
    const queryEnd = fragmentStart === -1 ? value.length : fragmentStart;

    if ((isUrl && queryStart === 0) || queryStart >= queryEnd) {
      return value;
    }

    const parameters = new URLSearchParams(value.slice(queryStart, queryEnd));
    const redactedParameters = new URLSearchParams();
    let changed = false;

    for (const [name, parameterValue] of parameters) {
      const redacts = this.isParameterName(name);
      redactedParameters.append(name, redacts ? this.resolveReplacement(name, parameterValue) : parameterValue);
      changed ||= redacts;
    }

    return changed ? value.slice(0, queryStart) + redactedParameters.toString() + value.slice(queryEnd) : value;
  }

  private resolveReplacement(name: string, value: string): string {
    return typeof this.replacement === 'function' ? this.replacement({ key: name, value }) : this.replacement;
  }
}
