import { execFile } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { gunzipSync } from 'node:zlib';
import { expect, test } from 'vitest';

const execFileAsync = promisify(execFile);
const frontendDirectory = fileURLToPath(new URL('../../', import.meta.url));

test('the application preload exports a Winston log through its automatically attached transport', async () => {
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
          import { DefaultLogger } from './app/.server/logging/logger-default.ts';
          import { redisErrorType } from './app/.server/data/redis-error-type.ts';
          import { operationalErrorCode } from './app/instrumentation/operational-error-type.ts';
          import { ATTR_CDCP_ERROR_CODE } from './app/instrumentation/log-attributes.ts';
          import { maskApplicationConfirmationCode } from './app/.server/logging/mask-application-confirmation-code.ts';
          import { createWinstonInstance } from './app/.server/logging/winston-factory.ts';

          const winston = createWinstonInstance({
            LOG_LEVEL: 'info',
            AUDIT_LOG_ENABLED: false,
            AUDIT_LOG_DIRNAME: 'logs',
            AUDIT_LOG_FILENAME: 'audit-%DATE%',
          });
          assert.equal(winston.transports.length, 2);
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
          logger.info('Synthetic backend request finished', {
            'url.full': "https://backend.example.test/dental-care/appeal-upload-eligible/pp/v1/esdc_clients(esdc_clientnumber='000-000-000%20path-person%40example.test%20path-token-canary')",
            'url.path': '/dental-care/doc-metadata/pp/v1/esdc_clients(00000000-0000-0000-0000-000000000001)/Microsoft.Dynamics.CRM.esdc_UploadEvidentiaryDocuments',
          });
          logger.info('Synthetic application confirmation received', {
            'cdcp.application.confirmation_code': maskApplicationConfirmationCode('12345678'),
            'url.path': '/en/application/confirmation',
          });
          await new Promise(resolve => setImmediate(resolve));
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
        },
        timeout: 20_000,
      },
    );

    const exported = Buffer.concat(payloads).toString('utf8');
    expect(exported).toContain('Synthetic dependency request finished');
    expect(exported).toContain('org.event.category');
    expect(exported).toContain('application');
    expect(exported).toContain('org.operation.outcome');
    expect(exported).toContain('org.retry.count');
    expect(exported).not.toContain('local-synthetic-key');
    expect(stdout).toContain('Synthetic dependency request finished');

    for (const output of [exported, stdout]) {
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
      expect(output).toContain('/dental-care/doc-metadata/pp/v1/esdc_clients([REDACTED])');
      expect(output).not.toContain('000-000-000');
      expect(output).not.toContain('path-person');
      expect(output).not.toContain('path-token-canary');
      expect(output).not.toContain('00000000-0000-0000-0000-000000000001');
      expect(output).toContain('/en/application/confirmation');
      expect(output).toContain('1234****');
      expect(output).not.toContain('12345678');
    }

    expect(stderr).not.toContain('log records will not be automatically sent');
  } finally {
    await new Promise<void>((resolve, reject) => {
      collector.close((error) => (error ? reject(error) : resolve()));
    });
  }
}, 30_000);
