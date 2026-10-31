import { RouterContextProvider } from 'react-router';

import { SpanStatusCode } from '@opentelemetry/api';
import type { Span } from '@opentelemetry/api';
import { describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import type { AppContainerProvider } from '~/.server/app-container-provider';
import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import type { InstrumentationService } from '~/.server/observability/instrumentation-service';
import { otelSpan } from '~/.server/utils/otel-instrumentation-utils';
import type { Session } from '~/.server/web/session';

function createSpanContext() {
  const span = mock<Span>();
  const instrumentationService = mock<InstrumentationService>();
  instrumentationService.startActiveSpan.mockImplementation((name, options, callback) => callback(span));
  const appContainer = mock<AppContainerProvider>();
  appContainer.get.calledWith(TYPES.InstrumentationService).mockReturnValue(instrumentationService);
  const context = new RouterContextProvider();
  context.set(appContext, { appContainer, session: mock<Session>() });

  return { context, span };
}

describe('otelSpan', () => {
  it('ends the span and preserves an enrichment failure', async () => {
    const { context, span } = createSpanContext();
    const error = new Error('enrichment failed');
    const handler = vi.fn().mockResolvedValue({ status: 'success', error: undefined });
    const onResult = vi.fn(() => {
      throw error;
    });

    await expect(otelSpan(context, 'request', {}, handler, onResult)).rejects.toBe(error);

    expect(span.end).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledOnce();
    expect(onResult).toHaveBeenCalledOnce();
  });

  it('ends the span and preserves a rejected handler error', async () => {
    const { context, span } = createSpanContext();
    const error = new Error('handler failed');
    const onResult = vi.fn();

    await expect(otelSpan(context, 'loader', {}, vi.fn().mockRejectedValue(error), onResult)).rejects.toBe(error);

    expect(span.end).toHaveBeenCalledOnce();
    expect(onResult).not.toHaveBeenCalled();
  });

  it('records an error result and ends the span', async () => {
    const { context, span } = createSpanContext();
    const error = new Error('loader failed');

    await otelSpan(context, 'loader', {}, vi.fn().mockResolvedValue({ status: 'error', error }));

    expect(span.recordException).toHaveBeenCalledWith(error);
    expect(span.setStatus).toHaveBeenCalledWith({ code: SpanStatusCode.ERROR, message: 'internal_error' });
    expect(span.end).toHaveBeenCalledOnce();
    expect(span.recordException).toHaveBeenCalledBefore(span.end);
  });

  it('enriches a successful result before ending the span', async () => {
    const { context, span } = createSpanContext();
    const result = { status: 'success' as const, error: undefined };
    const onResult = vi.fn();

    await otelSpan(context, 'request', {}, vi.fn().mockResolvedValue(result), onResult);

    expect(onResult).toHaveBeenCalledWith(span, result);
    expect(onResult).toHaveBeenCalledBefore(span.end);
    expect(span.end).toHaveBeenCalledOnce();
    expect(span.recordException).not.toHaveBeenCalled();
  });
});
