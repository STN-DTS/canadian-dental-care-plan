import { execFile } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { gunzipSync } from 'node:zlib';
import { expect, test } from 'vitest';
import { z } from 'zod';

const execFileAsync = promisify(execFile);
const frontendDirectory = fileURLToPath(new URL('../../', import.meta.url));
const logRecordSchema = z.object({
  hrTime: z.tuple([z.number(), z.number()]),
  hrTimeObserved: z.tuple([z.number(), z.number()]),
  severityNumber: z.number(),
  severityText: z.string(),
  body: z.string(),
  attributes: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  eventName: z.string().optional(),
  spanContext: z.object({ traceId: z.string(), spanId: z.string(), traceFlags: z.number() }).optional(),
});

test('the application preload preserves event schemas, severity and privacy through its real log sinks', async () => {
  const auditDirectory = await mkdtemp(join(tmpdir(), 'cdcp-audit-export-'));
  const payloads: Buffer[] = [];
  const collector = createServer(async (request, response) => {
    const chunks: Buffer[] = [];

    for await (const chunk of request) {
      chunks.push(Buffer.from(chunk));
    }

    const body = Buffer.concat(chunks);
    payloads.push(request.headers['content-encoding'] === 'gzip' ? gunzipSync(body) : body);
    response.writeHead(200, { 'content-type': 'application/x-protobuf' }).end();
  });
  collector.listen(0, '127.0.0.1');

  try {
    await once(collector, 'listening');
    const address = collector.address();

    if (!address || typeof address === 'string') {
      throw new Error('Expected a loopback collector address');
    }

    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      [
        fileURLToPath(import.meta.resolve('tsx/cli')),
        '--conditions',
        'development',
        '--experimental-loader=@opentelemetry/instrumentation/hook.mjs',
        '--import',
        './app/instrumentation/telemetry.server.ts',
        '--input-type=module',
        '--eval',
        `
          import assert from 'node:assert/strict';
          import { logs, trace } from '@opentelemetry/api';
          import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-proto';
          import express from 'express';
          import { once } from 'node:events';
          import { DefaultAuditService } from './app/.server/domain/services/audit-service.ts';
          import { createRequestLoggerMiddleware } from './app/.server/express-server/middleware.ts';
          import { DefaultLogger } from './app/.server/logging/logger-default.ts';
          import { singleton } from './app/.server/utils/instance-registry.ts';
          import { redisErrorType } from './app/.server/data/redis-error-type.ts';
          import { operationalErrorCode } from './app/instrumentation/operational-error-type.ts';
          import { ATTR_CDCP_ERROR_CODE } from './app/instrumentation/log-attributes.ts';
          import { maskApplicationConfirmationCode } from './app/.server/logging/mask-application-confirmation-code.ts';
          import { createWinstonInstance } from './app/.server/logging/winston-factory.ts';

          const exportLogs = OTLPLogExporter.prototype.export;
          OTLPLogExporter.prototype.export = function (records, resultCallback) {
            for (const { hrTime, hrTimeObserved, severityNumber, severityText, body, attributes, eventName, spanContext } of records) {
              console.log('OTEL_TEST_RECORD:' + JSON.stringify({ hrTime, hrTimeObserved, severityNumber, severityText, body, attributes, eventName, spanContext }));
            }
            exportLogs.call(this, records, resultCallback);
          };

          const winston = createWinstonInstance({
            LOG_LEVEL: 'info',
            AUDIT_LOG_ENABLED: true,
            AUDIT_LOG_DIRNAME: process.env.AUDIT_TEST_DIRECTORY,
            AUDIT_LOG_FILENAME: 'audit-%DATE%',
          });
          assert.equal(winston.transports.length, 3);
          singleton('winstonLogger', () => winston);
          const logger = new DefaultLogger(winston, 'winston-export-test');
          logger.error('Synthetic Redis connection failed', {
            'error.type': redisErrorType(Object.assign(new Error('operational-person@example.test operational-token-canary 000-000-000'), { code: 'ECONNREFUSED' })),
            [ATTR_CDCP_ERROR_CODE]: operationalErrorCode(Object.assign(new Error('operational-token-canary'), { code: 'ECONNREFUSED' })),
          });
          logger.error('Synthetic known exception', {
            'error.type': redisErrorType(new TypeError('operational-token-canary')),
          });
          class SyntheticOperationalError extends Error {}
          logger.error('Synthetic custom exception', {
            'error.type': redisErrorType(new SyntheticOperationalError('operational-token-canary')),
          });
          logger.error('Synthetic unknown failure', {
            'error.type': redisErrorType({ name: 'untrusted-error-name-canary' }),
          });
          logger.info('Synthetic dependency request finished', {
            'org.event.category': 'application',
            'org.operation.outcome': 'success',
            'org.retry.count': 2,
          });
          logger.http('Suppressed successful HTTP diagnostic');
          logger.info('Synthetic request-path diagnostic', {
            'url.path': '/en/documents/upload',
          });
          logs.getLogger('sink-canary').emit({
            severityNumber: 9,
            severityText: 'info',
            body: 'Synthetic SDK request-path diagnostic',
            attributes: { 'url.path': '/en/application/summary' },
          });
          logger.info('Synthetic backend request finished', {
            'url.full': "https://backend.example.test/dental-care/appeal-upload-eligible/pp/v1/esdc_clients(esdc_clientnumber='000-000-000%20path-person%40example.test%20path-token-canary')",
            'url.path': '/dental-care/doc-metadata/pp/v1/esdc_clients(00000000-0000-0000-0000-000000000001)/Microsoft.Dynamics.CRM.esdc_UploadEvidentiaryDocuments',
          });
          logger.info('Synthetic application confirmation received', {
            'cdcp.application.confirmation_code': maskApplicationConfirmationCode('12345678'),
            'url.path': '/en/application/confirmation',
          });
          winston.level = 'trace';
          logger.trace('Synthetic trace diagnostic');
          logger.debug('Synthetic debug diagnostic');
          logger.http('Synthetic HTTP request completed');
          logger.warn('Synthetic warning diagnostic');
          winston.level = 'info';

          const app = express();
          app.use(createRequestLoggerMiddleware(true));
          app.all('/status/:status', (request, response) => response.status(Number(request.params.status)).end());
          app.get('/abort', (_request, response) => response.destroy());
          app.use((_request, response) => response.send('ok'));
          const server = app.listen(0, '127.0.0.1');
          await once(server, 'listening');
          const address = server.address();
          assert.ok(address && typeof address !== 'string');
          const origin = 'http://127.0.0.1:' + address.port;
          try {
            for (const path of [
              '/en/application/confirmation?sin=999999998&email=sink-person%40example.invalid&token=query-token-canary',
              '/status/302',
              '/status/404',
              '/status/503',
              '/api/readyz',
            ]) {
              const response = await fetch(origin + path, { redirect: 'manual', headers: { connection: 'close' } });
              await response.text();
            }
            await assert.rejects(fetch(origin + '/abort', { headers: { connection: 'close' } }));
            winston.level = 'http';
            for (const status of [200, 302]) {
              const response = await fetch(origin + '/status/' + status, { method: 'POST', redirect: 'manual', headers: { connection: 'close' } });
              assert.equal(response.status, status);
              await response.text();
            }
          } finally {
            await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
          }

          winston.level = 'error';
          logger.info('Suppressed ordinary diagnostic');
          const auditService = new DefaultAuditService();
          trace.getTracer('winston-export-test').startActiveSpan('Synthetic audit context', span => {
            auditService.createAudit('auth.session-created', {
              userId: 'audit-actor-001',
              sin: '999999998',
              invalidSin: '999999999',
              email: 'sink-person@example.invalid',
              token: 'sink-token-canary',
              details: { secret: 'nested-audit-canary' },
              error: new Error('arbitrary-error-canary'),
            });
            span.end();
          });
          winston.level = 'audit';
          auditService.createAudit('pdf.get', { userId: 'audit-actor-001', letterId: 'audit-letter-001' });
          const finished = once(winston, 'finish');
          winston.end();
          await finished;
          winston.close();
        `,
      ],
      {
        cwd: frontendDirectory,
        env: {
          PATH: process.env.PATH,
          NODE_ENV: 'production',
          OTEL_NODE_ENABLED_INSTRUMENTATIONS: 'winston',
          OTEL_NODE_RESOURCE_DETECTORS: 'none',
          OTEL_API_KEY: 'local-synthetic-key',
          OTEL_LOGS_ENDPOINT: `http://127.0.0.1:${address.port}/v1/logs`,
          OTEL_LOGS_EXPORT_INTERVAL_MILLIS: '10',
          OTEL_TRACES_SAMPLER: 'always_off',
          AUDIT_TEST_DIRECTORY: auditDirectory,
        },
        timeout: 20_000,
      },
    );

    const exported = Buffer.concat(payloads).toString('utf8');
    const recordPrefix = 'OTEL_TEST_RECORD:';
    const records = stdout
      .split('\n')
      .filter((line) => line.startsWith(recordPrefix))
      .map((line) => logRecordSchema.parse(JSON.parse(line.slice(recordPrefix.length))));
    const files = (await readdir(auditDirectory)).filter((file) => file.endsWith('.log'));
    expect(files).toHaveLength(1);
    const auditFile = join(auditDirectory, files[0]!);
    const auditOutput = await readFile(auditFile, 'utf8');
    expect((await stat(auditFile)).mode & 0o777).toBe(0o666 & ~process.umask());
    const jsonRecordSchema = z.record(z.string(), z.unknown());
    const fileRecords = auditOutput
      .trim()
      .split('\n')
      .map((line) => jsonRecordSchema.parse(JSON.parse(line)));
    const consoleRecords = stdout
      .split('\n')
      .filter((line) => line.startsWith('{'))
      .map((line) => jsonRecordSchema.parse(JSON.parse(line)));
    const consoleOutput = consoleRecords.map((record) => JSON.stringify(record)).join('\n');

    expect(exported).toContain('Synthetic dependency request finished');
    expect(exported).toContain('Synthetic HTTP request completed');
    expect(exported).toContain('org.event.category');
    expect(exported).toContain('application');
    expect(exported).toContain('org.operation.outcome');
    expect(exported).toContain('org.retry.count');
    expect(exported).not.toContain('local-synthetic-key');
    expect(consoleOutput).toContain('Synthetic dependency request finished');
    expect(consoleOutput).toContain('Synthetic HTTP request completed');

    for (const output of [exported, consoleOutput]) {
      expect(output).toContain('Synthetic Redis connection failed');
      expect(output).toContain('cdcp.error.code');
      expect(output).toContain('ECONNREFUSED');
      expect(output).toContain('TypeError');
      expect(output).toContain('SyntheticOperationalError');
      expect(output).toContain('_OTHER');
      expect(output).not.toContain('untrusted-error-name-canary');
      expect(output).not.toContain('operational-person');
      expect(output).not.toContain('operational-token-canary');
      expect(output).toContain('Synthetic backend request finished');
      expect(output).toContain('/dental-care/appeal-upload-eligible/pp/v1/esdc_clients([REDACTED])');
      expect(output).toContain('[REDACTED]');
      expect(output).not.toContain('000-000-000');
      expect(output).not.toContain('path-person');
      expect(output).not.toContain('path-token-canary');
      expect(output).not.toContain('00000000-0000-0000-0000-000000000001');
      expect(output).toContain('/en/documents/upload');
      expect(output).toContain('/en/application/confirmation');
      expect(output).toContain('1234****');
      expect(output).not.toContain('12345678');
    }

    for (const output of [exported, stdout, stderr, auditOutput]) {
      for (const canary of ['999999998', '999999999', 'sink-person', 'sink-token-canary', 'query-token-canary', 'nested-audit-canary', 'arbitrary-error-canary']) {
        expect(output).not.toContain(canary);
      }

      expect(output).not.toContain('Suppressed ordinary diagnostic');
      expect(output).not.toContain('Suppressed successful HTTP diagnostic');
      expect(output).not.toContain('%j');
    }

    for (const [message, severityNumber, severityText] of [
      ['Synthetic trace diagnostic', 1, 'trace'],
      ['Synthetic debug diagnostic', 5, 'debug'],
      ['Synthetic dependency request finished', 9, 'info'],
      ['Synthetic HTTP request completed', 8, 'http'],
      ['Synthetic warning diagnostic', 13, 'warn'],
      ['Synthetic Redis connection failed', 17, 'error'],
    ] as const) {
      const record = records.find((entry) => entry.body === message);
      expect(record).toMatchObject({ severityNumber, severityText });
      expect(record?.eventName).toBeUndefined();
    }

    for (const message of ['Synthetic request-path diagnostic', 'Synthetic SDK request-path diagnostic']) {
      const record = records.find((entry) => entry.body === message);
      expect(record?.attributes['url.path']).toBe(message === 'Synthetic request-path diagnostic' ? '/en/documents/upload' : '/en/application/summary');
    }

    const completions = records.filter((record) => record.eventName === 'cdcp.http.request.completed');
    expect(completions).toHaveLength(5);
    expect(completions.map((record) => record.attributes['http.response.status_code'])).toEqual(expect.arrayContaining([200, 302, 404, 503]));

    for (const record of completions) {
      const attributes = record.attributes;
      const status = Number(attributes['http.response.status_code']);
      expect(attributes['url.path']).toBe(Number.isNaN(status) ? '/abort' : `/status/${status}`);
      expect(attributes['otel.event.name']).toBeUndefined();
      expect(record.severityNumber).toBe(Number.isNaN(status) || status >= 500 ? 17 : status >= 400 ? 13 : 8);
      expect(record.severityText).toBe(Number.isNaN(status) || status >= 500 ? 'error' : status >= 400 ? 'warn' : 'http');
      expect(attributes['http.request.method']).toBe(status < 400 ? 'POST' : 'GET');
    }

    const consoleCompletions = consoleRecords.filter((record) => record['otel.event.name'] === 'cdcp.http.request.completed');
    expect(consoleCompletions).toHaveLength(5);

    for (const record of consoleCompletions) {
      const status = Number(record['http.response.status_code']);
      expect(record['http.request.method']).toBe(status < 400 ? 'POST' : 'GET');
      expect(record['url.path']).toBe(Number.isNaN(status) ? '/abort' : `/status/${status}`);
    }

    const auditRecords = records.filter((record) => record.eventName === 'cdcp.audit.recorded');
    expect(auditRecords).toHaveLength(2);

    for (const record of auditRecords) {
      const attributes = record.attributes;
      const timestamp = BigInt(record.hrTime[0]) * 1_000_000_000n + BigInt(record.hrTime[1]);
      const observedTimestamp = BigInt(record.hrTimeObserved[0]) * 1_000_000_000n + BigInt(record.hrTimeObserved[1]);
      expect(record.severityNumber).toBe(9);
      expect(record.severityText).toBe('audit');
      expect(timestamp).toBeGreaterThan(0n);
      expect(observedTimestamp).toBeGreaterThanOrEqual(timestamp);
      expect(attributes['cdcp.user.id']).toBe('audit-actor-001');
      expect(attributes['cdcp.audit.event_id']).toMatch(/^(auth.session-created|pdf.get)$/);
      expect(Object.keys(attributes)).toEqual(expect.arrayContaining(['cdcp.audit.event_id', 'cdcp.user.id']));
      expect(Object.keys(attributes).filter((key) => !['cdcp.audit.event_id', 'cdcp.user.id', 'cdcp.letter.id', 'label', 'timestamp'].includes(key))).toEqual([]);
    }

    const actorRecord = auditRecords.find((record) => record.attributes['cdcp.audit.event_id'] === 'auth.session-created');
    expect(actorRecord?.spanContext?.traceId).toHaveLength(32);
    expect(actorRecord?.spanContext?.spanId).toHaveLength(16);
    expect(actorRecord?.spanContext?.traceFlags).toBe(0);
    expect(auditRecords.find((record) => record.attributes['cdcp.audit.event_id'] === 'pdf.get')?.attributes['cdcp.letter.id']).toBe('audit-letter-001');

    for (const sinkRecords of [fileRecords, consoleRecords.filter((record) => record.message === 'Audit event recorded')]) {
      expect(sinkRecords).toHaveLength(2);

      for (const record of sinkRecords) {
        expect(record.level).toBe('audit');
        expect(record['otel.event.name']).toBe('cdcp.audit.recorded');
        expect(record['cdcp.user.id']).toBe('audit-actor-001');
        expect(record['cdcp.audit.event_id']).toMatch(/^(auth.session-created|pdf.get)$/);
        expect(typeof record.timestamp).toBe('string');
        expect(Object.keys(record).every((key) => ['level', 'message', 'label', 'timestamp', 'otel.event.name', 'cdcp.audit.event_id', 'cdcp.user.id', 'cdcp.letter.id', 'trace_id', 'span_id', 'trace_flags'].includes(key))).toBe(true);
      }
    }

    expect(stderr).not.toContain('log records will not be automatically sent');
  } finally {
    await Promise.all([
      new Promise<void>((resolve, reject) => {
        collector.close((error) => (error ? reject(error) : resolve()));
      }),
      rm(auditDirectory, { recursive: true, force: true }),
    ]);
  }
}, 30_000);
