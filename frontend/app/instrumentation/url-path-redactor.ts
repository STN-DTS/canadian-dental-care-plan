import type { AnyValue, Attributes } from '@opentelemetry/api';
import { ATTR_URL_FULL, ATTR_URL_PATH } from '@opentelemetry/semantic-conventions';

import type { AttributeRedactorResult } from '~/instrumentation/attribute-redactor-types';

export const URL_PATH_ATTRIBUTE_KEYS = [ATTR_URL_FULL, ATTR_URL_PATH, 'http.url', 'http.target', 'react_router.url'] as const;

/**
 * Removes the key-bearing suffix of backend client-record paths. Application paths are unchanged.
 */
export class UrlPathRedactor {
  redactAttributes(attributes: Attributes): AttributeRedactorResult {
    let redactedAttributes: Attributes | undefined;

    for (const key of URL_PATH_ATTRIBUTE_KEYS) {
      const value = attributes[key];
      const redacted = this.redactValue(value);

      if (redacted !== value) {
        redactedAttributes ??= { ...attributes };
        redactedAttributes[key] = redacted;
      }
    }

    return redactedAttributes === undefined ? { redacted: false } : { redacted: true, attributes: redactedAttributes };
  }

  redactValue(value: AnyValue): AnyValue {
    if (typeof value === 'string') {
      return this.redactPath(value);
    }

    if (Array.isArray(value) && value.every((item) => typeof item === 'string')) {
      const redacted = value.map((item) => this.redactPath(item));
      return redacted.some((item, index) => item !== value[index]) ? redacted : value;
    }

    return value;
  }

  private redactPath(value: string): string {
    const pathStart = value.startsWith('/') ? 0 : /^[a-z][a-z\d+.-]*:\/\/[^/?#]*/i.exec(value)?.[0].length;

    if (pathStart === undefined) {
      return value;
    }

    const queryOrFragment = value.slice(pathStart).search(/[?#]/);
    const pathEnd = queryOrFragment === -1 ? value.length : pathStart + queryOrFragment;
    const path = value.slice(pathStart, pathEnd);
    // Drop the whole suffix rather than parsing untrusted OData key delimiters.
    const redactedPath = path.replace(/(\/dental-care\/(?:appeal-upload-eligible|doc-metadata)\/pp\/v1\/esdc_clients)(?:\(|%28)[\s\S]*/i, '$1([REDACTED])');

    return redactedPath === path ? value : value.slice(0, pathStart) + redactedPath + value.slice(pathEnd);
  }
}
