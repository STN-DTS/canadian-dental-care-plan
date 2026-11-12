import { SpanStatusCode, context, propagation, trace } from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace';
import { Option, Redacted } from 'effect';
import type { Request } from 'express';
import { Container } from 'inversify';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Response } from 'undici';
import { Visitor, parseSync } from 'vite';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { DefaultAppContainerProvider } from '~/.server/app-container-provider';
import { DefaultCountryDtoMapper } from '~/.server/domain/mappers/country-dto-mapper';
import { DefaultLanguageDtoMapper } from '~/.server/domain/mappers/language-dto-mapper';
import { DefaultCountryRepository, MockCountryRepository } from '~/.server/domain/repositories/country-repository';
import type { FederalGovernmentInsurancePlanService, GCCommunicationMethodService, LanguageService, ProvinceTerritoryStateService, ProvincialGovernmentInsurancePlanService, SunLifeCommunicationMethodService } from '~/.server/domain/services';
import { DefaultCountryService } from '~/.server/domain/services/country-service';
import { DefaultLanguageService } from '~/.server/domain/services/language-service';
import type { HttpClient } from '~/.server/http';
import { DefaultProtectedApplicationStateResolver } from '~/.server/routes/resolvers/protected-application-state-resolver';
import { DefaultPublicApplicationStateResolver } from '~/.server/routes/resolvers/public-application-state-resolver';
import { ExpressSession, NoopSession } from '~/.server/web/session';

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

  return { service, repository, httpClient };
}

function createExpressSession() {
  const sessionData = mock<Request['session']>({ id: 'synthetic-session' });
  return { session: new ExpressSession({ session: sessionData }), sessionData };
}

it('enforces tracing boundaries outside logging and tracing internals', () => {
  const serverDirectory = fileURLToPath(new URL('../../../app/.server/', import.meta.url));
  const untracedFiles = new Set([
    'app-container-provider.ts',
    'auth/bearer-token-resolver.ts',
    'core/build-info-service.ts',
    'data/redis-service.ts',
    'domain/services/application-year-service.ts',
    'domain/services/client-friendly-status-service.ts',
    'domain/services/country-service.ts',
    'domain/services/document-upload-reason-service.ts',
    'domain/services/evidentiary-document-type-service.ts',
    'domain/services/federal-government-insurance-plan-service.ts',
    'domain/services/gc-communication-method-service.ts',
    'domain/services/language-service.ts',
    'domain/services/letter-type-service.ts',
    'domain/services/marital-status-service.ts',
    'domain/services/province-territory-state-service.ts',
    'domain/services/provincial-government-insurance-plan-service.ts',
    'domain/services/record-source-service.ts',
    'domain/services/sun-life-communication-method-service.ts',
  ]);
  const untracedMethods = new Set([
    'DefaultAddressValidationRepository.checkHealth',
    'DefaultApplicantRepository.checkHealth',
    'DefaultApplicationStatusRepository.checkHealth',
    'DefaultClientFriendlyStatusRepository.checkHealth',
    'DefaultClientFriendlyStatusRepository.findClientFriendlyStatusById',
    'DefaultCountryRepository.checkHealth',
    'DefaultCountryRepository.findCountryById',
    'DefaultDocumentUploadReasonRepository.checkHealth',
    'DefaultDocumentUploadReasonRepository.findDocumentUploadReasonById',
    'DefaultDocumentUploadRepository.checkHealth',
    'DefaultEvidentiaryDocumentRepository.checkHealth',
    'DefaultEvidentiaryDocumentTypeRepository.checkHealth',
    'DefaultEvidentiaryDocumentTypeRepository.findEvidentiaryDocumentTypeById',
    'DefaultGovernmentInsurancePlanRepository.checkHealth',
    'DefaultGovernmentInsurancePlanRepository.findGovernmentInsurancePlanById',
    'DefaultHCaptchaRepository.checkHealth',
    'DefaultLetterRepository.checkHealth',
    'DefaultLetterTypeRepository.checkHealth',
    'DefaultLetterTypeRepository.findLetterTypeById',
    'DefaultProfileRepository.checkHealth',
    'DefaultProtectedApplicationStateResolver.resolveEmailValue',
    'DefaultProtectedApplicationStateResolver.resolvePhoneNumberValue',
    'DefaultProvinceTerritoryStateRepository.checkHealth',
    'DefaultProvinceTerritoryStateRepository.findProvinceTerritoryStateById',
    'DefaultProvinceTerritoryStateRepository.findProvinceTerritoryStateByCode',
    'DefaultPublicApplicationStateResolver.resolveEmailValue',
    'DefaultPublicApplicationStateResolver.resolvePhoneNumberValue',
    'ExpressSession.has',
    'ExpressSession.find',
    'ExpressSession.get',
    'ExpressSession.set',
    'ExpressSession.unset',
    'NoopSession.has',
    'NoopSession.find',
    'NoopSession.get',
    'NoopSession.set',
    'NoopSession.unset',
  ]);
  const violations: string[] = [];
  let methodCount = 0;

  for (const file of readdirSync(serverDirectory, { recursive: true, encoding: 'utf8' }).toSorted()) {
    if (!file.endsWith('.ts') || /^(logging|observability)\//.test(file)) {
      continue;
    }

    const source = readFileSync(path.join(serverDirectory, file), 'utf8');
    const { program, errors } = parseSync(file, source);
    expect({ file, errors }).toEqual({ file, errors: [] });
    const shouldRemainUntraced = untracedFiles.has(file) || /^(domain|web)\/mappers\/.*-dto-mapper\.ts$/.test(file);
    const isRepository = /^(domain|web)\/repositories\/.*-repository\.ts$/.test(file);
    const untracedMethodStarts = new Set<number>();

    const hasTracedImport = program.body.some(
      (statement) =>
        statement.type === 'ImportDeclaration' &&
        statement.source.value === '~/.server/observability/decorator' &&
        statement.importKind !== 'type' &&
        statement.specifiers.some((specifier) => specifier.type === 'ImportSpecifier' && specifier.imported.type === 'Identifier' && specifier.imported.name === 'Traced' && specifier.local.name === 'Traced' && specifier.importKind !== 'type'),
    );

    new Visitor({
      ClassDeclaration(declaration) {
        for (const member of declaration.body.body) {
          if (member.type !== 'MethodDefinition' || member.key.type !== 'Identifier') {
            continue;
          }

          const isUntracedRepositoryMethod = isRepository && (declaration.id?.name.startsWith('Mock') === true || member.key.name === 'getMetadata');

          if (isUntracedRepositoryMethod || untracedMethods.has(`${declaration.id?.name}.${member.key.name}`)) {
            untracedMethodStarts.add(member.start);
          }
        }
      },
      MethodDefinition(member) {
        const decorators = member.decorators.filter((decorator) => decorator.expression.type === 'CallExpression' && decorator.expression.callee.type === 'Identifier' && decorator.expression.callee.name === 'Traced');

        if (shouldRemainUntraced || untracedMethodStarts.has(member.start)) {
          if (decorators.length !== 0) {
            violations.push(`${file}:${source.slice(0, member.start).split('\n').length}: expected no @Traced()`);
          }

          return;
        }

        if (member.kind !== 'method' || !member.value.body || member.key.type === 'PrivateIdentifier' || member.static || member.accessibility === 'private' || member.accessibility === 'protected') {
          return;
        }

        methodCount++;

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

  it('preserves the parent span without creating container, in-memory lookup, or mapper spans', async () => {
    const service = new DefaultLanguageService(new DefaultLanguageDtoMapper(), { ENGLISH_LANGUAGE_CODE: 1, FRENCH_LANGUAGE_CODE: 2 });
    const container = new Container();
    container.bind(DefaultLanguageService).toConstantValue(service);
    const provider = new DefaultAppContainerProvider(container);

    trace.getTracer('application-tracing-test').startActiveSpan('test.request', (span) => {
      try {
        expect(provider.find(DefaultLanguageService)).toBe(service);
        expect(provider.get(DefaultLanguageService)).toBe(service);
        expect(provider.findAll(DefaultLanguageService)).toEqual([service]);
        expect(provider.getAll(DefaultLanguageService)).toEqual([service]);
        expect(service.getLocalizedLanguageById('1', 'fr')).toEqual({ id: '1', code: 'en', name: 'Anglais' });
        expect(service.listAndSortLocalizedLanguages('en')).toEqual([
          { id: '1', code: 'en', name: 'English' },
          { id: '2', code: 'fr', name: 'French' },
        ]);
        expect(trace.getActiveSpan()).toBe(span);
      } finally {
        span.end();
      }
    });
    await processor.forceFlush();

    expect(exporter.getFinishedSpans().map((span) => span.name)).toEqual(['test.request']);
  });

  it('parents repository I/O directly under the caller without lookup service, mapper, or wrapper spans', async () => {
    const { service } = createCountryService();

    await trace.getTracer('application-tracing-test').startActiveSpan('test.request', async (span) => {
      try {
        await expect(service.getLocalizedCountryById('1', 'fr')).resolves.toEqual({ id: '1', name: 'Canada FR' });
      } finally {
        span.end();
      }
    });
    await processor.forceFlush();

    const spans = exporter.getFinishedSpans();
    expect(spans.map((span) => span.name).toSorted()).toEqual(['DefaultCountryRepository.listAllCountries', 'test.request'].toSorted());
    expect(new Set(spans.map((span) => span.spanContext().traceId)).size).toBe(1);

    const outerSpan = spans.find((span) => span.name === 'test.request');
    const innerSpan = spans.find((span) => span.name === 'DefaultCountryRepository.listAllCountries');
    expect(outerSpan).toBeDefined();
    expect(innerSpan?.attributes).toEqual({ 'code.function.name': 'DefaultCountryRepository.listAllCountries' });
    expect(innerSpan?.parentSpanContext?.spanId).toBe(outerSpan?.spanContext().spanId);

    for (const span of spans) {
      expect(span.status.code).toBe(SpanStatusCode.UNSET);
    }
  });

  it('keeps metadata and delegated health checks untraced while retaining repository I/O spans', async () => {
    const { repository, httpClient } = createCountryService();

    expect(repository.getMetadata()).toEqual({ baseUrl: 'https://api.example.test/dental-care/code-list/pp/v1' });
    await expect(repository.checkHealth()).resolves.toBeUndefined();
    expect(httpClient.instrumentedFetch).toHaveBeenCalledOnce();
    await processor.forceFlush();

    expect(exporter.getFinishedSpans().map((span) => span.name)).toEqual(['DefaultCountryRepository.listAllCountries']);
  });

  it('preserves memoization and emits method spans only on cache misses', async () => {
    const { service, httpClient } = createCountryService();

    const first = await service.getCountryById('1');
    expect(await service.getCountryById('1')).toBe(first);
    expect(httpClient.instrumentedFetch).toHaveBeenCalledOnce();
    await processor.forceFlush();

    expect(exporter.getFinishedSpans().map((span) => span.name)).toEqual(['DefaultCountryRepository.listAllCountries']);
  });

  it('preserves rejected errors and records failures on the retained repository I/O span', async () => {
    const { service, httpClient } = createCountryService();
    const error = new Error('Synthetic upstream failure');
    httpClient.instrumentedFetch.mockRejectedValueOnce(error);

    await expect(service.getCountryById('1')).rejects.toBe(error);
    await processor.forceFlush();

    const spans = exporter.getFinishedSpans();
    expect(spans.map((span) => span.name)).toEqual(['DefaultCountryRepository.listAllCountries']);

    for (const span of spans) {
      expect(span.status).toEqual({ code: SpanStatusCode.ERROR, message: error.message });
      expect(span.events.map((event) => event.name)).toEqual(['exception']);
    }
  });

  it('keeps synchronous and asynchronous mock repository methods untraced without changing their results', async () => {
    const repository = new MockCountryRepository();

    expect(repository.getMetadata()).toEqual({ mockEnabled: 'true' });
    expect(await repository.listAllCountries()).not.toHaveLength(0);
    await expect(repository.checkHealth()).resolves.toBeUndefined();
    await processor.forceFlush();

    expect(exporter.getFinishedSpans()).toHaveLength(0);
  });

  it('preserves session key access, missing-key errors, and the parent context without creating accessor spans', async () => {
    const { session } = createExpressSession();

    trace.getTracer('application-tracing-test').startActiveSpan('test.request', (span) => {
      try {
        session.set('authReturnUrl', '/en/apply');
        expect(session.has('authReturnUrl')).toBe(true);
        expect(Option.getOrThrow(session.find('authReturnUrl'))).toBe('/en/apply');
        expect(session.get('authReturnUrl')).toBe('/en/apply');
        expect(session.unset('authReturnUrl')).toBe(true);
        expect(Option.isNone(session.find('authReturnUrl'))).toBe(true);
        expect(() => session.get('authReturnUrl')).toThrowError("Key 'authReturnUrl' not found in session [synthetic-session]");
        expect(trace.getActiveSpan()).toBe(span);
      } finally {
        span.end();
      }
    });
    await processor.forceFlush();

    expect(exporter.getFinishedSpans().map((span) => span.name)).toEqual(['test.request']);
  });

  it('preserves stateless session accessor results and errors without creating spans', async () => {
    const session = new NoopSession();

    expect(session.has('authReturnUrl')).toBe(false);
    expect(Option.isNone(session.find('authReturnUrl'))).toBe(true);
    expect(() => session.get('authReturnUrl')).toThrowError('No session available in stateless context');
    expect(() => session.set('authReturnUrl', '/en/apply')).toThrowError('No session available in stateless context');
    expect(session.unset('authReturnUrl')).toBe(false);
    await processor.forceFlush();

    expect(exporter.getFinishedSpans()).toHaveLength(0);
  });

  it('retains lifecycle spans under the caller for both session implementations', async () => {
    const { session, sessionData } = createExpressSession();
    const lifecycleMethods = ['save', 'regenerate', 'destroy'] as const;

    for (const method of lifecycleMethods) {
      sessionData[method].mockImplementation((callback) => {
        callback?.(undefined);
        return sessionData;
      });
    }

    await trace.getTracer('application-tracing-test').startActiveSpan('test.request', async (span) => {
      try {
        await session.save();
        await session.regenerate();
        await session.destroy();
        const noopSession = new NoopSession();
        await noopSession.save();
        await noopSession.regenerate();
        await noopSession.destroy();
      } finally {
        span.end();
      }
    });
    await processor.forceFlush();

    const spans = exporter.getFinishedSpans();
    expect(spans.map((span) => span.name).toSorted()).toEqual(['ExpressSession.save', 'ExpressSession.regenerate', 'ExpressSession.destroy', 'NoopSession.save', 'NoopSession.regenerate', 'NoopSession.destroy', 'test.request'].toSorted());
    const parentSpan = spans.find((span) => span.name === 'test.request');

    for (const span of spans.filter((span) => span.name !== 'test.request')) {
      expect(span.parentSpanContext?.spanId).toBe(parentSpan?.spanContext().spanId);
      expect(span.status.code).toBe(SpanStatusCode.UNSET);
    }

    for (const method of lifecycleMethods) {
      expect(sessionData[method]).toHaveBeenCalledOnce();
    }
  });

  it('preserves session store errors and records failures on the retained lifecycle span', async () => {
    const { session, sessionData } = createExpressSession();
    const error = new Error('Synthetic session store failure');
    sessionData.save.mockImplementation((callback) => {
      callback?.(error);
      return sessionData;
    });

    await expect(session.save()).rejects.toBe(error);
    await processor.forceFlush();

    const spans = exporter.getFinishedSpans();
    expect(spans.map((span) => span.name)).toEqual(['ExpressSession.save']);
    expect(spans[0]?.status).toEqual({ code: SpanStatusCode.ERROR, message: error.message });
    expect(spans[0]?.events.map((event) => event.name)).toEqual(['exception']);
  });

  it.each([
    { name: 'protected', Resolver: DefaultProtectedApplicationStateResolver },
    { name: 'public', Resolver: DefaultPublicApplicationStateResolver },
  ])('keeps $name phone/email selection untraced while retaining address lookup spans', async ({ Resolver }) => {
    const { service } = createCountryService();
    const resolver = new Resolver(
      service,
      mock<FederalGovernmentInsurancePlanService>(),
      mock<GCCommunicationMethodService>(),
      mock<LanguageService>(),
      mock<ProvinceTerritoryStateService>(),
      mock<ProvincialGovernmentInsurancePlanService>(),
      mock<SunLifeCommunicationMethodService>(),
    );

    await trace.getTracer('application-tracing-test').startActiveSpan('test.request', async (span) => {
      try {
        expect(
          resolver.resolvePhoneNumberValue({
            phoneNumber: { hasChanged: true, value: { primary: '555-0100', alternate: undefined } },
          }),
        ).toEqual({ hasChanged: true, primary: '555-0100', alternate: undefined });
        expect(resolver.resolveEmailValue({ email: 'synthetic@example.test', emailVerified: true })).toBe('synthetic@example.test');
        await expect(resolver.resolveMailingAddressValue({ mailingAddress: { hasChanged: true, value: { address: '123 Test St', city: 'Ottawa', country: '1', postalCode: undefined, province: undefined } } }, 'en')).resolves.toEqual({
          hasChanged: true,
          address: '123 Test St',
          city: 'Ottawa',
          country: { id: '1', name: 'Canada EN' },
          postalCode: undefined,
          province: undefined,
        });
        expect(trace.getActiveSpan()).toBe(span);
      } finally {
        span.end();
      }
    });
    await processor.forceFlush();

    const spans = exporter.getFinishedSpans();
    const resolverSpanName = `${Resolver.name}.resolveMailingAddressValue`;
    expect(spans.map((span) => span.name).toSorted()).toEqual(['DefaultCountryRepository.listAllCountries', resolverSpanName, 'test.request'].toSorted());
    const parentSpan = spans.find((span) => span.name === 'test.request');
    const resolverSpan = spans.find((span) => span.name === resolverSpanName);
    const repositorySpan = spans.find((span) => span.name === 'DefaultCountryRepository.listAllCountries');
    expect(resolverSpan?.parentSpanContext?.spanId).toBe(parentSpan?.spanContext().spanId);
    expect(repositorySpan?.parentSpanContext?.spanId).toBe(resolverSpan?.spanContext().spanId);
  });
});
