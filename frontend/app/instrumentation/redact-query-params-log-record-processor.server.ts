import type { Attributes } from '@opentelemetry/api';
import type { LogRecordProcessor, ReadWriteLogRecord } from '@opentelemetry/sdk-logs';

import type { QueryParamsRedactor } from '~/instrumentation/query-params-redactor.server';

/**
 * Redacts query parameters in log record URL attributes and in URLs embedded in a string body, in place.
 * The logs SDK calls every processor with the same mutable record before it becomes read-only, so list
 * this processor before exporting ones.
 */
export class RedactQueryParamsLogRecordProcessor implements LogRecordProcessor {
  private readonly redactor: QueryParamsRedactor;

  constructor(redactor: QueryParamsRedactor) {
    this.redactor = redactor;
  }

  onEmit(logRecord: ReadWriteLogRecord): void {
    const attributes = this.redactor.redactAttributes(logRecord.attributes);

    if (attributes.redacted) {
      logRecord.setAttributes(attributes.attributes);
    }

    const { body } = logRecord;

    if (typeof body === 'string') {
      const redactedBody = this.redactor.redactText(body);

      if (redactedBody !== body) {
        logRecord.setBody(redactedBody);
      }

      return;
    }

    if (isAttributes(body)) {
      const result = this.redactor.redactAttributes(body);

      if (result.redacted) {
        logRecord.setBody(result.attributes);
      }
    }
  }

  async forceFlush(): Promise<void> {}

  async shutdown(): Promise<void> {}
}

function isAttributes(value: unknown): value is Attributes {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Uint8Array);
}
