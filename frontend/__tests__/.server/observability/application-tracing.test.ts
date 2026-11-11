import { SpanStatusCode, context, propagation, trace } from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace';
import { Redacted } from 'effect';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Response } from 'undici';
import { Visitor, parseSync } from 'vite';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { DefaultCountryDtoMapper } from '~/.server/domain/mappers/country-dto-mapper';
import { DefaultCountryRepository, MockCountryRepository } from '~/.server/domain/repositories/country-repository';
import { DefaultCountryService } from '~/.server/domain/services/country-service';
import type { HttpClient } from '~/.server/http';

vi.unmock(import('~/.server/observability/decorator'));

function createCountryService() {
  const httpClient = mock<HttpClient>();
  httpClient.instrumentedFetch.mockResolvedValue(
    Response.json({
      value: [{ esdc_countryid: '1', esdc_nameenglish: 'Canada EN', esdc_namefrench: 'Canada FR', esdc_countrycodealpha3: 'CAN' }],
    }),
  );

  const repository = new DefaultCountryRepository(
    {
      INTEROP_API_BASE_URI: 'https://api.example.test',
      INTEROP_API_SUBSCRIPTION_KEY: Redacted.make('synthetic-key'),
      INTEROP_API_MAX_RETRIES: 0,
      INTEROP_API_BACKOFF_MS: 0,
    },
    httpClient,
  );

  const service = new DefaultCountryService(new DefaultCountryDtoMapper(), repository, {
    CANADA_COUNTRY_ID: '1',
    LOOKUP_SVC_ALL_COUNTRIES_CACHE_TTL_SECONDS: 60,
    LOOKUP_SVC_COUNTRY_CACHE_TTL_SECONDS: 60,
  });

  return { service, httpClient };
}

it('decorates every public application instance method outside logging and tracing internals', () => {
  const serverDirectory = fileURLToPath(new URL('../../../app/.server/', import.meta.url));
  const violations: string[] = [];
  let methodCount = 0;

  for (const file of readdirSync(serverDirectory, { recursive: true, encoding: 'utf8' }).toSorted()) {
    if (!file.endsWith('.ts') || /^(logging|observability)\//.test(file)) {
      continue;
    }

    const source = readFileSync(path.join(serverDirectory, file), 'utf8');
    const { program, errors } = parseSync(file, source);
    expect({ file, errors }).toEqual({ file, errors: [] });

    const hasTracedImport = program.body.some(
      (statement) =>
        statement.type === 'ImportDeclaration' &&
        statement.source.value === '~/.server/observability/decorator' &&
        statement.importKind !== 'type' &&
        statement.specifiers.some((specifier) => specifier.type === 'ImportSpecifier' && specifier.imported.type === 'Identifier' && specifier.imported.name === 'Traced' && specifier.local.name === 'Traced' && specifier.importKind !== 'type'),
    );

    new Visitor({
      MethodDefinition(member) {
        if (member.kind !== 'method' || !member.value.body || member.key.type === 'PrivateIdentifier' || member.static || member.accessibility === 'private' || member.accessibility === 'protected') {
          return;
        }

        methodCount++;
        const decorators = member.decorators.filter((decorator) => decorator.expression.type === 'CallExpression' && decorator.expression.callee.type === 'Identifier' && decorator.expression.callee.name === 'Traced');

        if (!hasTracedImport || decorators.length !== 1) {
          violations.push(`${file}:${source.slice(0, member.start).split('\n').length}`);
        }
      },
    }).visit(program);
  }

  expect(methodCount).toBeGreaterThan(0);
  expect({ count: violations.length, examples: violations.slice(0, 10) }).toEqual({ count: 0, examples: [] });
});

describe('application method spans', () => {
  const exporter = new InMemorySpanExporter();
  const processor = new SimpleSpanProcessor({ exporter });
  const sdk = new NodeSDK({
    autoDetectResources: false,
    spanProcessors: [processor],
    logRecordProcessors: [],
    metricReaders: [],
  });

  beforeAll(() => {
    sdk.start();
  });

  afterEach(async () => {
    await processor.forceFlush();
    exporter.reset();
  });

  afterAll(async () => {
    await sdk.shutdown();
    trace.disable();
    context.disable();
    propagation.disable();
  });

  it('exports nested service, repository, and mapper spans without changing the result', async () => {
    const { service } = createCountryService();

    await expect(service.getLocalizedCountryById('1', 'fr')).resolves.toEqual({ id: '1', name: 'Canada FR' });
    await processor.forceFlush();

    const spans = exporter.getFinishedSpans();
    expect(spans.map((span) => span.name).toSorted()).toEqual(
      [
        'DefaultCountryService.getLocalizedCountryById',
        'DefaultCountryService.getCountryById',
        'DefaultCountryRepository.findCountryById',
        'DefaultCountryRepository.listAllCountries',
        'DefaultCountryDtoMapper.mapCountryEntityToCountryDto',
        'DefaultCountryDtoMapper.mapCountryDtoToCountryLocalizedDto',
      ].toSorted(),
    );
    expect(new Set(spans.map((span) => span.spanContext().traceId)).size).toBe(1);

    const outerSpan = spans.find((span) => span.name === 'DefaultCountryService.getLocalizedCountryById');
    const innerSpan = spans.find((span) => span.name === 'DefaultCountryService.getCountryById');
    expect(outerSpan).toBeDefined();
    expect(innerSpan?.parentSpanContext?.spanId).toBe(outerSpan?.spanContext().spanId);

    for (const span of spans) {
      const [className, methodName] = span.name.split('.');
      expect(span.attributes).toEqual({ 'code.function.name': `${className}.${methodName}` });
      expect(span.status.code).toBe(SpanStatusCode.UNSET);
    }
  });

  it('preserves memoization and emits method spans only on cache misses', async () => {
    const { service, httpClient } = createCountryService();

    const first = await service.getCountryById('1');
    expect(await service.getCountryById('1')).toBe(first);
    expect(httpClient.instrumentedFetch).toHaveBeenCalledOnce();
    await processor.forceFlush();

    expect(exporter.getFinishedSpans().filter((span) => span.name === 'DefaultCountryService.getCountryById')).toHaveLength(1);
  });

  it('preserves rejected errors and records failures on each application method span', async () => {
    const { service, httpClient } = createCountryService();
    const error = new Error('Synthetic upstream failure');
    httpClient.instrumentedFetch.mockRejectedValueOnce(error);

    await expect(service.getCountryById('1')).rejects.toBe(error);
    await processor.forceFlush();

    const spans = exporter.getFinishedSpans();
    expect(spans.map((span) => span.name).toSorted()).toEqual(['DefaultCountryRepository.listAllCountries', 'DefaultCountryRepository.findCountryById', 'DefaultCountryService.getCountryById'].toSorted());

    for (const span of spans) {
      expect(span.status).toEqual({ code: SpanStatusCode.ERROR, message: error.message });
      expect(span.events.map((event) => event.name)).toEqual(['exception']);
    }
  });

  it('traces synchronous mock implementations without changing their result', async () => {
    expect(new MockCountryRepository().getMetadata()).toEqual({ mockEnabled: 'true' });
    await processor.forceFlush();

    expect(exporter.getFinishedSpans().map((span) => span.name)).toEqual(['MockCountryRepository.getMetadata']);
  });
});
