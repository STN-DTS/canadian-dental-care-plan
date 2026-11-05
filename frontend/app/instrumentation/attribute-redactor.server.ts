import type { AnyValue, Attributes } from '@opentelemetry/api';

import type { AttributeRedactorAttributesOptions, AttributeRedactorReplacement, AttributeRedactorResult, AttributeRedactorRule } from '~/instrumentation/attribute-redactor-types';
import { fastCaseInsensitiveEqual } from '~/instrumentation/instrumentation-utils.server';

/**
 * The default options for attribute redaction, including common sensitive keys and patterns.
 */
export const DEFAULT_REDACT_ATTRIBUTES_OPTIONS = {
  redactRules: [
    { type: 'key', match: 'exact', value: 'db.statement' },
    { type: 'key', match: 'exact', value: 'http.request.body' },
    { type: 'key', match: 'exact', value: 'user.email' },
    { type: 'key', match: 'substring', value: 'password' },
    { type: 'key', match: 'substring', value: 'secret' },
    { type: 'key', match: 'substring', value: 'token' },
    { type: 'key', match: 'substring', value: 'apikey' },
    { type: 'key', match: 'substring', value: 'api_key' },
    { type: 'key', match: 'substring', value: 'authorization' },
    { type: 'key', match: 'substring', value: 'credential' },
    { type: 'key', match: 'substring', value: 'ssn' },
    { type: 'key', match: 'substring', value: 'credit_card' },
    { type: 'key', match: 'substring', value: 'cookie' },
    { type: 'value', pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replacement: '[EMAIL]' },
    { type: 'value', pattern: /\b(?:\d{4}[ -]?){3}\d{4}\b/g, replacement: '[CARD]' },
    { type: 'value', pattern: /Bearer\s+[a-zA-Z0-9._~+/-]+=*/gi, replacement: '[BEARER_TOKEN]' },
    { type: 'value', pattern: /\bAKIA[0-9A-Z]{16}\b/g, replacement: '[AWS_KEY]' },
  ],
  replacement: '[REDACTED]',
} as const satisfies AttributeRedactorAttributesOptions;

/**
 * A class responsible for redacting attribute values based on configured redaction rules.
 */
export class AttributeRedactor {
  private readonly redactRules: readonly AttributeRedactorRule[];
  private readonly replacement: AttributeRedactorReplacement;

  constructor(options: AttributeRedactorAttributesOptions = {}) {
    const rules: readonly AttributeRedactorRule[] = options.redactRules ?? DEFAULT_REDACT_ATTRIBUTES_OPTIONS.redactRules;
    this.redactRules = rules.map((rule) => {
      if (rule.type === 'value') {
        return {
          type: 'value',
          pattern: new RegExp(rule.pattern.source, rule.pattern.flags),
          replacement: rule.replacement,
        };
      }

      if (rule.match === 'pattern') {
        return {
          type: 'key',
          match: 'pattern',
          value: new RegExp(rule.value.source, rule.value.flags),
          replacement: rule.replacement,
        };
      }

      return {
        type: 'key',
        match: rule.match,
        value: rule.match === 'substring' ? rule.value.toLowerCase() : rule.value,
        replacement: rule.replacement,
      };
    });
    this.replacement = options.replacement ?? DEFAULT_REDACT_ATTRIBUTES_OPTIONS.replacement;
  }

  /**
   * Redacts the attributes of an object based on the configured redaction rules.
   *
   * @param attributes The attributes to be redacted.
   * @returns The result of the redaction operation, indicating whether any attributes were redacted.
   */
  redactAttributes(attributes: Attributes): AttributeRedactorResult {
    let redactedAttributes: Attributes | undefined;

    for (const [key, value] of Object.entries(attributes)) {
      const keyRule = this.redactRules.find((rule) => rule.type === 'key' && this.matchesKey(rule, key));
      const redactedValue = keyRule ? this.replaceValue(keyRule.replacement, key, value) : this.redactValue(value, key);

      if (redactedValue !== value) {
        redactedAttributes ??= { ...attributes };
        redactedAttributes[key] = redactedValue;
      }
    }

    return redactedAttributes === undefined ? { redacted: false } : { redacted: true, attributes: redactedAttributes };
  }

  /**
   * Redacts an attribute value based on its type.
   *
   * @param value The attribute value to be redacted.
   * @param key The attribute key associated with the value, if available.
   * @returns The redacted attribute value.
   */
  redactValue(value: AnyValue, key?: string): AnyValue {
    if (typeof value === 'string') {
      return this.redactString(value, key);
    }

    if (Array.isArray(value) && value.every((item) => typeof item === 'string')) {
      const redacted = value.map((item) => this.redactString(item, key));
      return redacted.some((item, index) => item !== value[index]) ? redacted : value;
    }

    return value;
  }

  /**
   * Determines if a given attribute key matches the specified redaction rule.
   *
   * @param rule The redaction rule to evaluate.
   * @param key The attribute key to check against the rule.
   * @returns True if the key matches the rule, false otherwise.
   */
  private matchesKey(rule: Extract<AttributeRedactorRule, { type: 'key' }>, key: string): boolean {
    if (rule.match === 'pattern') {
      rule.value.lastIndex = 0;
      return rule.value.test(key);
    }

    return rule.match === 'exact' ? fastCaseInsensitiveEqual(rule.value, key) : key.toLowerCase().includes(rule.value);
  }

  /**
   * Replaces the value of an attribute based on the provided replacement rule.
   *
   * @param ruleReplacement The replacement value or function for the redacted attribute.
   * @param key The attribute key associated with the value.
   * @param value The attribute value to be redacted.
   * @returns The redacted string value.
   */
  private replaceValue(ruleReplacement: AttributeRedactorReplacement | undefined, key: string, value: AnyValue): string {
    const replacement = ruleReplacement ?? this.replacement;
    return typeof replacement === 'function' ? replacement({ key, value }) : replacement;
  }

  /**
   * Redacts a string value based on the configured value redaction rules.
   *
   * @param value The string value to be redacted.
   * @param key The attribute key associated with the value, if available.
   * @returns The redacted string value.
   */
  private redactString(value: string, key?: string): string {
    return this.redactRules.reduce((text, rule) => {
      if (rule.type !== 'value') {
        return text;
      }

      rule.pattern.lastIndex = 0;
      const replacement = rule.replacement ?? this.replacement;
      return typeof replacement === 'function' ? text.replace(rule.pattern, () => replacement({ key: key ?? '', value: text })) : text.replace(rule.pattern, replacement);
    }, value);
  }
}
