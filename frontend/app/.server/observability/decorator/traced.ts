/**
 * OpenTelemetry method tracing adapted from fullstackhouse/opentelemetry-js-decorator.
 *
 * @see https://github.com/fullstackhouse/opentelemetry-js-decorator/blob/main/src/traced.ts
 */
import type { Span, SpanOptions } from '@opentelemetry/api';
import { SpanStatusCode, trace } from '@opentelemetry/api';

/**
 * Records an exception and sets the span's error status without ending the span.
 *
 * @param span - The span that receives the exception event and error status.
 * @param error - The thrown or rejected value to record.
 */
function recordException(span: Span, error: unknown): void {
  span.recordException(error as Error);
  span.setStatus({
    code: SpanStatusCode.ERROR,
    message: error instanceof Error ? error.message : String(error),
  });
}

type AnyFunction = (...args: any[]) => any;

/**
 * Preserves each method's concrete descriptor type, including methods returning `never`.
 * The `never[]` constraint accepts any method parameter list without widening that type.
 */
type TracedMethodDecorator = <Method extends (...args: never[]) => unknown>(target: object, propertyKey: string | symbol, propertyDescriptor: TypedPropertyDescriptor<Method>) => void;

/**
 * Copies function-level Reflect metadata when the metadata API is available.
 *
 * @param originalFunction - The decorated method whose metadata is copied.
 * @param newFunction - The replacement function that receives the metadata.
 */
function copyMetadataFromFunctionToFunction(originalFunction: AnyFunction, newFunction: AnyFunction): void {
  const r = Reflect;

  if (typeof r.getMetadataKeys === 'function') {
    r.getMetadataKeys(originalFunction).forEach((metadataKey: string) => {
      r.defineMetadata(metadataKey, r.getMetadata(metadataKey, originalFunction), newFunction);
    });
  }
}

/**
 * Checks the runtime tag used to select generator result handling.
 */
function isGenerator(value: unknown): value is Iterable<unknown> {
  return /\[object Generator|GeneratorFunction\]/.test(Object.prototype.toString.call(value));
}

/**
 * Recognizes non-null objects with a callable `then` property.
 */
function isPromise(value: unknown): value is Promise<unknown> {
  return typeof value === 'object' && value !== null && 'then' in value && typeof value.then === 'function';
}

/**
 * Checks for the async-iterator symbol on an object result.
 */
function isAsyncIterable(value: unknown): value is AsyncIterable<unknown> {
  return typeof value === 'object' && value !== null && Symbol.asyncIterator in value;
}

/**
 * Forwards synchronous values and reports exhaustion or iteration errors.
 * Early iterator closure does not invoke the completion callback.
 *
 * @param iterable - The method's synchronous iterable result.
 * @param onDone - Receives an iteration error before that error is rethrown, or no argument after exhaustion.
 * @returns A lazy iterable that forwards the original values.
 */
function* wrapIterable<T>(iterable: Iterable<T>, onDone: (error?: unknown) => void): Iterable<T> {
  try {
    yield* iterable;
    onDone();
  } catch (error) {
    onDone(error);
    throw error;
  }
}

/**
 * Forwards asynchronous values and reports exhaustion or iteration errors.
 * Early iterator closure does not invoke the completion callback.
 *
 * @param iterable - The method's asynchronous iterable result.
 * @param onDone - Receives an iteration error before that error is rethrown, or no argument after exhaustion.
 * @returns A lazy async iterable that forwards the original values.
 */
async function* wrapAsyncIterable<T>(iterable: AsyncIterable<T>, onDone: (error?: unknown) => void): AsyncIterable<T> {
  try {
    yield* iterable;
    onDone();
  } catch (error) {
    onDone(error);
    throw error;
  }
}

/**
 * Reports promise settlement before forwarding the fulfillment value or rejection reason.
 *
 * @param promise - The method's promise result.
 * @param onDone - Receives the rejection reason, or no argument after fulfillment.
 * @returns A promise that forwards the original result after the callback runs.
 */
async function wrapPromise<T>(promise: Promise<T>, onDone: (error?: unknown) => void): Promise<T> {
  return await promise
    .then((value) => {
      onDone();
      return value;
    })
    .catch((error: unknown) => {
      onDone(error);
      throw error;
    });
}

/**
 * Invokes a method and defers completion for promise or iterable results.
 *
 * @param fn - The original decorated method.
 * @param thisObj - The receiver preserved for the invocation.
 * @param args - The arguments forwarded to the method.
 * @param onDone - Receives errors before they propagate, or no argument after successful completion.
 * @returns The method result, wrapped when completion occurs after the initial call.
 */
function invoke<T>(fn: AnyFunction, thisObj: unknown, args: unknown[], onDone: (error?: unknown) => void): T {
  try {
    const result = fn.call(thisObj, ...args);

    if (isGenerator(result)) {
      return wrapIterable(result, onDone) as T;
    }

    if (isAsyncIterable(result)) {
      return wrapAsyncIterable(result, onDone) as T;
    }

    if (isPromise(result)) {
      return wrapPromise(result, onDone) as T;
    }

    onDone();
    return result as T;
  } catch (error) {
    onDone(error);
    throw error;
  }
}

export interface TracedOptions extends SpanOptions {
  name?: string;
  op?: string;
}

/**
 * Creates a method decorator that starts an active span for each invocation.
 *
 * Instance-method span names default to `ClassName.methodName` unless `options.name` overrides them.
 * Synchronous values finish the span immediately. Promises finish it on settlement.
 * Iterable results finish it on exhaustion or an iteration error.
 * The `op` option becomes the `code.op` span attribute.
 *
 * @param options - OpenTelemetry span settings plus optional `name` and `op` values.
 * @returns A legacy method decorator that preserves the method's name and Reflect metadata.
 * @throws If the returned decorator is applied to a descriptor without a function value.
 */
export function Traced(options?: TracedOptions): TracedMethodDecorator;
/**
 * Creates a tracing decorator with an explicit span name.
 *
 * @param name - The span name. Omit to use the default instance-method name.
 * @param options - Span settings applied when an explicit name is supplied.
 * @returns A legacy method decorator that traces each invocation.
 */
export function Traced(name?: string, options?: TracedOptions): TracedMethodDecorator;

/**
 * Resolves the factory arguments and proxies calls to the decorated method.
 * Preserves the receiver, function name, and function-level Reflect metadata.
 *
 * @param nameOrOptions - An explicit span name or combined span and decorator settings.
 * @param maybeOptions - Additional span settings when `nameOrOptions` is a string.
 */
export function Traced(nameOrOptions?: string | TracedOptions, maybeOptions?: TracedOptions): TracedMethodDecorator {
  return (target, propertyKey, propertyDescriptor) => {
    let spanName: string;
    let spanOptions: TracedOptions;

    const className = (target.constructor as { name: string }).name;
    const methodName = String(propertyKey);

    if (typeof nameOrOptions === 'string') {
      spanName = nameOrOptions;
      spanOptions = maybeOptions ?? {};
    } else {
      spanName = nameOrOptions?.name ?? `${className}.${methodName}`;
      spanOptions = nameOrOptions ?? {};
    }

    const originalFunction = propertyDescriptor.value;

    if (typeof originalFunction !== 'function') {
      throw new Error(`The @Traced decorator can only be used on methods, but ${String(propertyKey)} is not a method.`);
    }

    const wrappedFunction = function (this: unknown, ...args: unknown[]) {
      const tracer = trace.getTracer('default');

      const { name: _name, op, ...otelSpanOptions } = spanOptions;
      void _name;

      return tracer.startActiveSpan(
        spanName,
        {
          ...otelSpanOptions,
          attributes: {
            'code.function': methodName,
            'code.namespace': className,
            ...otelSpanOptions.attributes,
            ...(op ? { 'code.op': op } : {}),
          },
        },
        (span) => {
          const onDone = (error?: unknown) => {
            if (error) {
              recordException(span, error);
            }

            span.end();
          };

          return invoke(originalFunction, this, args, onDone);
        },
      );
    };

    propertyDescriptor.value = new Proxy(originalFunction, {
      apply: (_, thisArg, args: unknown[]) => {
        return wrappedFunction.apply(thisArg, args);
      },
    });

    copyMetadataFromFunctionToFunction(originalFunction, propertyDescriptor.value);
  };
}
