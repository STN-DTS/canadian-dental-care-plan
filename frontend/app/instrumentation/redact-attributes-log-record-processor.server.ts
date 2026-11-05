import type { Attributes } from '@opentelemetry/api';
import type { LogRecordProcessor, ReadWriteLogRecord } from '@opentelemetry/sdk-logs';

import type { AttributeRedactor } from '~/instrumentation/attribute-redactor.server';

/**
 * Redacts log record attributes and bodies in place. The logs SDK calls every processor with the
 * same mutable record before it becomes read-only, so list this processor before exporting ones.
 */
export class RedactAttributesLogRecordProcessor implements LogRecordProcessor {
  private readonly redactor: AttributeRedactor;

  constructor(redactor: AttributeRedactor) {
    this.redactor = redactor;
  }

  onEmit(logRecord: ReadWriteLogRecord): void {
    const attributes = this.redactor.redactAttributes(logRecord.attributes);

    if (attributes.redacted) {
      logRecord.setAttributes(attributes.attributes);
    }

    const { body } = logRecord;

    if (isAttributes(body)) {
      const result = this.redactor.redactAttributes(body);

      if (result.redacted) {
        logRecord.setBody(result.attributes);
      }

      return;
    }

    const redactedBody = this.redactor.redactValue(body);

    if (redactedBody !== body) {
      logRecord.setBody(redactedBody);
    }
  }

  async forceFlush(): Promise<void> {}

  async shutdown(): Promise<void> {}
}

function isAttributes(value: unknown): value is Attributes {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Uint8Array);
}
