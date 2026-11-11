import { SpanKind, trace } from '@opentelemetry/api';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Traced } from '~/.server/observability/decorator';

class TestService {
  private readonly prefix = 'result ';

  @Traced()
  syncMethod(value: string): string {
    return this.prefix + value;
  }

  @Traced('promise-method')
  async asyncMethod(value: string): Promise<string> {
    return await Promise.resolve(value);
  }

  @Traced()
  throwError(error: Error): never {
    throw error;
  }
}

describe('Traced default mock', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses the manual mock from the shared test setup', () => {
    expect(vi.isMockFunction(Traced)).toBe(true);
  });

  it.each([
    { name: 'no arguments', createDecorator: () => Traced() },
    { name: 'a span name', createDecorator: () => Traced('custom-span') },
    { name: 'options', createDecorator: () => Traced({ name: 'custom-span', kind: SpanKind.INTERNAL }) },
    { name: 'a span name and options', createDecorator: () => Traced('custom-span', { kind: SpanKind.INTERNAL }) },
  ])('returns a no-op method decorator with $name', ({ createDecorator }) => {
    const method = () => 'unchanged';
    const target = { method };
    const descriptor = { value: method };
    const decorator = createDecorator();

    expect(decorator).toBeTypeOf('function');
    decorator(target, 'method', descriptor);

    expect(descriptor.value).toBe(method);
    expect(target.method()).toBe('unchanged');
  });

  it('preserves receivers, asynchronous results, and errors without accessing a tracer', async () => {
    const getTracer = vi.spyOn(trace, 'getTracer');
    const service = new TestService();
    const error = new Error('test error');

    expect(service.syncMethod('value')).toBe('result value');
    expect(service.syncMethod.name).toBe('syncMethod');
    await expect(service.asyncMethod('async result')).resolves.toBe('async result');
    expect(() => service.throwError(error)).toThrow(error);
    expect(getTracer).not.toHaveBeenCalled();
  });
});
