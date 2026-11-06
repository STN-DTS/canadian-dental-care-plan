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
          import { createWinstonInstance } from './app/.server/logging/winston-factory.ts';

          const winston = createWinstonInstance({
            LOG_LEVEL: 'info',
            AUDIT_LOG_ENABLED: false,
            AUDIT_LOG_DIRNAME: 'logs',
            AUDIT_LOG_FILENAME: 'audit-%DATE%',
          });
          assert.equal(winston.transports.length, 2);
          const logger = new DefaultLogger(winston, 'winston-export-test');
          logger.info('Synthetic dependency request finished', {
            'org.event.category': 'application',
            'org.operation.outcome': 'success',
            'org.retry.count': 2,
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
    expect(stderr).not.toContain('log records will not be automatically sent');
  } finally {
    await new Promise<void>((resolve, reject) => {
      collector.close((error) => (error ? reject(error) : resolve()));
    });
  }
}, 30_000);
