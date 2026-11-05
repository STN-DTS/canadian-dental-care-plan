import type { Context } from '@opentelemetry/api';
import type { ReadableSpan, Span, SpanProcessor } from '@opentelemetry/sdk-trace';

import type { AttributeRedactor } from '~/instrumentation/attribute-redactor.server';
import { withSpanAttributes } from '~/instrumentation/instrumentation-utils.server';

export class RedactAttributesSpanProcessor implements SpanProcessor {
  private readonly redactor: AttributeRedactor;
  private readonly downstream: SpanProcessor;

  constructor(downstream: SpanProcessor, redactor: AttributeRedactor) {
    this.redactor = redactor;
    this.downstream = downstream;
  }

  onStart(span: Span, parentContext: Context): void {
    this.downstream.onStart(span, parentContext);
  }

  onEnding(span: Span): void {
    this.downstream.onEnding?.(span);
  }

  onEnd(span: ReadableSpan): void {
    const result = this.redactor.redactAttributes(span.attributes);

    if (!result.redacted) {
      this.downstream.onEnd(span);
      return;
    }

    this.downstream.onEnd(withSpanAttributes(span, result.attributes));
  }

  async forceFlush(): Promise<void> {
    return await this.downstream.forceFlush();
  }

  async shutdown(): Promise<void> {
    return await this.downstream.shutdown();
  }
}
