import { data, redirect } from 'react-router';

import { SpanStatusCode, context as otelContext, propagation, trace } from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace';
import { ATTR_ERROR_TYPE, ATTR_HTTP_RESPONSE_STATUS_CODE } from '@opentelemetry/semantic-conventions';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { createLogger } from '~/.server/logging';
import type { Logger } from '~/.server/logging';
import { ATTR_CDCP_CORRELATION_ID, ATTR_CDCP_ERROR_CODE } from '~/.server/logging/log-attributes';
import { withActionAppError } from '~/.server/utils/action-app-error';
import { HttpStatusCodes } from '~/constants/http-status-codes';
import { AppError } from '~/errors/app-error';
import { ErrorCodes } from '~/errors/error-codes';

vi.mock(import('~/.server/logging'));

describe('withActionAppError', () => {
  const exporter = new InMemorySpanExporter();
  const processor = new SimpleSpanProcessor({ exporter });
  const sdk = new NodeSDK({ autoDetectResources: false, spanProcessors: [processor], logRecordProcessors: [], metricReaders: [] });

  beforeAll(() => sdk.start());

  afterEach(async () => {
    await processor.forceFlush();
    exporter.reset();
    vi.clearAllMocks();
  });

  afterAll(async () => {
    await sdk.shutdown();
    trace.disable();
    otelContext.disable();
    propagation.disable();
  });

  it('passes normal action return values through untouched', async () => {
    const action = withActionAppError((value: string) => ({ ok: true, value }));

    await expect(action('saved')).resolves.toEqual({ ok: true, value: 'saved' });
  });

  it('catches a 5xx AppError, returns only public payload fields with its HTTP status, records on the active span, and logs at error level', async () => {
    const logger = mock<Logger>();
    vi.mocked(createLogger).mockReturnValue(logger);

    const appError = new AppError('synthetic-private-message', ErrorCodes.API_BENEFIT_APPLICATION_CREATE_FAILED, {
      correlationId: 'AB-123456',
      httpStatusCode: HttpStatusCodes.BAD_GATEWAY,
      cause: new Error('synthetic-private-cause'),
      meta: { secret: 'synthetic-private-meta' },
    });
    const action = withActionAppError(() => {
      throw appError;
    });

    const tracer = trace.getTracer('action-app-error-test');
    const result = await tracer.startActiveSpan('action /submit', async (span) => {
      try {
        return await action();
      } finally {
        span.end();
      }
    });

    expect(result).toEqual(
      data(
        {
          appError: {
            name: 'AppError',
            errorCode: ErrorCodes.API_BENEFIT_APPLICATION_CREATE_FAILED,
            correlationId: 'AB-123456',
          },
        },
        { status: HttpStatusCodes.BAD_GATEWAY },
      ),
    );

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('synthetic-private-message');
    expect(serialized).not.toContain('synthetic-private-cause');
    expect(serialized).not.toContain('synthetic-private-meta');

    await processor.forceFlush();
    const [recordedSpan] = exporter.getFinishedSpans();
    expect(recordedSpan?.status.code).toBe(SpanStatusCode.ERROR);
    expect(recordedSpan?.attributes[ATTR_ERROR_TYPE]).toBe('AppError');
    expect(recordedSpan?.attributes[ATTR_CDCP_CORRELATION_ID]).toBe('AB-123456');
    expect(recordedSpan?.events.some((event) => event.name === 'exception')).toBe(true);

    expect(logger.error).toHaveBeenCalledExactlyOnceWith(appError, {
      [ATTR_ERROR_TYPE]: 'AppError',
      [ATTR_CDCP_ERROR_CODE]: ErrorCodes.API_BENEFIT_APPLICATION_CREATE_FAILED,
      [ATTR_HTTP_RESPONSE_STATUS_CODE]: HttpStatusCodes.BAD_GATEWAY,
      [ATTR_CDCP_CORRELATION_ID]: 'AB-123456',
    });
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('catches a 4xx AppError, logs at warn level, and omits correlation ID attribute when empty', async () => {
    const logger = mock<Logger>();
    vi.mocked(createLogger).mockReturnValue(logger);

    const appError = new AppError('Rate limited', ErrorCodes.API_BENEFIT_APPLICATION_CREATE_RATE_LIMITED, {
      httpStatusCode: HttpStatusCodes.TOO_MANY_REQUESTS,
    });
    const action = withActionAppError(() => {
      throw appError;
    });

    const result = await action();

    expect(result).toEqual(
      data(
        {
          appError: {
            name: 'AppError',
            errorCode: ErrorCodes.API_BENEFIT_APPLICATION_CREATE_RATE_LIMITED,
            correlationId: '',
          },
        },
        { status: HttpStatusCodes.TOO_MANY_REQUESTS },
      ),
    );

    expect(logger.warn).toHaveBeenCalledExactlyOnceWith(appError, {
      [ATTR_ERROR_TYPE]: 'AppError',
      [ATTR_CDCP_ERROR_CODE]: ErrorCodes.API_BENEFIT_APPLICATION_CREATE_RATE_LIMITED,
      [ATTR_HTTP_RESPONSE_STATUS_CODE]: HttpStatusCodes.TOO_MANY_REQUESTS,
    });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('re-throws redirect Responses untouched', async () => {
    const redirectResponse = redirect('/en/unable-to-process-request');
    const action = withActionAppError(() => {
      throw redirectResponse;
    });

    await expect(action()).rejects.toBe(redirectResponse);
  });

  it('re-throws thrown data() responses untouched', async () => {
    const thrownData = data({ reason: 'not-found' }, { status: HttpStatusCodes.NOT_FOUND });
    const action = withActionAppError(() => {
      throw thrownData;
    });

    await expect(action()).rejects.toBe(thrownData);
  });

  it('re-throws unexpected non-AppError exceptions untouched', async () => {
    const unexpected = new Error('Unexpected runtime failure');
    const action = withActionAppError(() => {
      throw unexpected;
    });

    await expect(action()).rejects.toBe(unexpected);
  });
});
