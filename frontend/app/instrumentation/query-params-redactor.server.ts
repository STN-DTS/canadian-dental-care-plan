import type { AnyValue, Attributes } from '@opentelemetry/api';
import { ATTR_URL_FULL, ATTR_URL_QUERY } from '@opentelemetry/semantic-conventions';

import { fastCaseInsensitiveEqual } from '~/instrumentation/instrumentation-utils.server';
import type { QueryParamsRedactorAttributesOptions, QueryParamsRedactorReplacement, QueryParamsRedactorResult, QueryParamsRedactorRule } from '~/instrumentation/query-params-redactor-types';

const DEFAULT_EMBEDDED_URL_PATTERN = /(?:https?:\/\/|\/)[^\s?#'"<>[\]()]*\?[^\s#'"<>[\]()]*=[^\s#'"<>[\]()]*/g;

export const DEFAULT_REDACT_QUERY_PARAMS_OPTIONS = {
  urlAttributeKeys: [ATTR_URL_FULL, 'http.url', 'http.target'],
  queryAttributeKeys: [ATTR_URL_QUERY],
  embeddedUrlPatterns: [DEFAULT_EMBEDDED_URL_PATTERN],
  scanOtherStringAttributes: true,
  redactRules: [{ type: 'key', match: 'pattern', value: /.*/ }],
  replacement: '[REDACTED]',
} as const satisfies QueryParamsRedactorAttributesOptions;

function matchesAny(candidates: readonly string[], value: string): boolean {
  return candidates.some((candidate) => fastCaseInsensitiveEqual(candidate, value));
}

function globalPattern(pattern: RegExp): RegExp {
  const flags = [...new Set([...pattern.flags.replace(/[gy]/g, ''), 'g'])].sort().join('');
  return new RegExp(pattern.source, flags);
}

export class QueryParamsRedactor {
  private readonly urlAttributeKeys: readonly string[];
  private readonly queryAttributeKeys: readonly string[];
  private readonly redactRules: readonly QueryParamsRedactorRule[];
  private readonly embeddedUrlPatterns: readonly RegExp[];
  private readonly scanOtherStringAttributes: boolean;
  private readonly replacement: QueryParamsRedactorReplacement;

  constructor(options: QueryParamsRedactorAttributesOptions = {}) {
    this.urlAttributeKeys = options.urlAttributeKeys ?? DEFAULT_REDACT_QUERY_PARAMS_OPTIONS.urlAttributeKeys;
    this.queryAttributeKeys = options.queryAttributeKeys ?? DEFAULT_REDACT_QUERY_PARAMS_OPTIONS.queryAttributeKeys;
    const rules: readonly QueryParamsRedactorRule[] = options.redactRules ?? DEFAULT_REDACT_QUERY_PARAMS_OPTIONS.redactRules;
    this.redactRules = rules.map((rule) => {
      if (rule.type === 'value') {
        return { type: 'value', pattern: new RegExp(rule.pattern.source, rule.pattern.flags), replacement: rule.replacement };
      }

      if (rule.match === 'pattern') {
        return { type: 'key', match: 'pattern', value: new RegExp(rule.value.source, rule.value.flags), replacement: rule.replacement };
      }

      return { type: 'key', match: rule.match, value: rule.match === 'substring' ? rule.value.toLowerCase() : rule.value, replacement: rule.replacement };
    });
    this.embeddedUrlPatterns = (options.embeddedUrlPatterns ?? DEFAULT_REDACT_QUERY_PARAMS_OPTIONS.embeddedUrlPatterns).map(globalPattern);
    this.scanOtherStringAttributes = options.scanOtherStringAttributes ?? DEFAULT_REDACT_QUERY_PARAMS_OPTIONS.scanOtherStringAttributes;
    this.replacement = options.replacement ?? DEFAULT_REDACT_QUERY_PARAMS_OPTIONS.replacement;
  }

  redactAttributes(attributes: Attributes): QueryParamsRedactorResult {
    let redactedAttributes: Attributes | undefined;

    for (const [key, value] of Object.entries(attributes)) {
      const queryOnly = matchesAny(this.queryAttributeKeys, key);
      const urlAttribute = queryOnly || matchesAny(this.urlAttributeKeys, key);

      if (!urlAttribute && !this.scanOtherStringAttributes) {
        continue;
      }

      const redactedValue = urlAttribute ? this.redactValue(value, queryOnly) : this.redactTextValue(value);

      if (redactedValue !== value) {
        redactedAttributes ??= { ...attributes };
        redactedAttributes[key] = redactedValue;
      }
    }

    return redactedAttributes === undefined ? { redacted: false } : { redacted: true, attributes: redactedAttributes };
  }

  /** Redacts query parameters of URLs and paths embedded in free text. */
  redactText(text: string): string {
    return this.embeddedUrlPatterns.reduce((redactedText, pattern) => {
      pattern.lastIndex = 0;
      return redactedText.replace(pattern, (url) => this.redactQuery(url, false));
    }, text);
  }

  private redactValue(value: AnyValue, queryOnly: boolean): AnyValue {
    if (typeof value === 'string') {
      return this.redactQuery(value, queryOnly);
    }

    if (Array.isArray(value) && value.every((item) => typeof item === 'string')) {
      const redacted = value.map((item) => this.redactQuery(item, queryOnly));
      return redacted.some((item, index) => item !== value[index]) ? redacted : value;
    }

    return value;
  }

  private redactTextValue(value: AnyValue): AnyValue {
    if (typeof value === 'string') {
      return this.redactText(value);
    }

    if (Array.isArray(value) && value.every((item) => typeof item === 'string')) {
      const redacted = value.map((item) => this.redactText(item));
      return redacted.some((item, index) => item !== value[index]) ? redacted : value;
    }

    return value;
  }

  private redactQuery(value: string, queryOnly: boolean): string {
    const queryStart = queryOnly ? (value.startsWith('?') ? 1 : 0) : value.indexOf('?') + 1;
    const fragmentStart = value.indexOf('#');
    const queryEnd = fragmentStart === -1 ? value.length : fragmentStart;

    if ((!queryOnly && queryStart === 0) || queryStart >= queryEnd) {
      return value;
    }

    const parameters = new URLSearchParams(value.slice(queryStart, queryEnd));
    const redactedParameters = new URLSearchParams();
    let changed = false;

    for (const [name, parameterValue] of parameters) {
      const redactedValue = this.redactParameter(name, parameterValue);
      redactedParameters.append(name, redactedValue);
      changed ||= redactedValue !== parameterValue;
    }

    return changed ? value.slice(0, queryStart) + redactedParameters.toString() + value.slice(queryEnd) : value;
  }

  /** Applies the first matching key rule to the whole value, otherwise every value rule in list order. */
  private redactParameter(name: string, value: string): string {
    const keyRule = this.redactRules.find((rule) => rule.type === 'key' && this.matchesName(rule, name));

    if (keyRule) {
      return this.resolveReplacement(keyRule.replacement, name, value);
    }

    return this.redactRules.reduce((text, rule) => {
      if (rule.type !== 'value') {
        return text;
      }

      rule.pattern.lastIndex = 0;
      return text.replace(rule.pattern, () => this.resolveReplacement(rule.replacement, name, text));
    }, value);
  }

  private matchesName(rule: Extract<QueryParamsRedactorRule, { type: 'key' }>, name: string): boolean {
    if (rule.match === 'pattern') {
      rule.value.lastIndex = 0;
      return rule.value.test(name);
    }

    return rule.match === 'exact' ? fastCaseInsensitiveEqual(rule.value, name) : name.toLowerCase().includes(rule.value);
  }

  private resolveReplacement(ruleReplacement: QueryParamsRedactorReplacement | undefined, name: string, value: string): string {
    const replacement = ruleReplacement ?? this.replacement;
    return typeof replacement === 'function' ? replacement({ key: name, value }) : replacement;
  }
}
