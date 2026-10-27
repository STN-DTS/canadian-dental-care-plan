import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { expect, test } from 'vitest';

const execFileAsync = promisify(execFile);
const frontendDirectory = fileURLToPath(new URL('../../../', import.meta.url));

test('the official ESM hook instruments Express requests with the application SDK preload', async () => {
  const { stdout } = await execFileAsync(
    process.execPath,
    [
      fileURLToPath(import.meta.resolve('tsx/cli')),
      '--conditions',
      'development',
      '--experimental-loader=@opentelemetry/instrumentation/hook.mjs',
      '--import',
      './app/.server/express-server/opentelemetry.ts',
      '--input-type=module',
      '--eval',
      `
        import assert from 'node:assert/strict';
        import { once } from 'node:events';
        import { context, trace } from '@opentelemetry/api';
        import express from 'express';

        const app = express();
        const traceId = '11111111111111111111111111111111';

        app.get('/otel-smoke', function smokeHandler(request, response) {
          response.json({ traceId: trace.getSpan(context.active())?.spanContext().traceId });
        });

        const server = app.listen(0, '127.0.0.1');
        await once(server, 'listening');

        try {
          const address = server.address();
          assert.ok(address && typeof address !== 'string');

          const response = await fetch('http://127.0.0.1:' + address.port + '/otel-smoke', {
            headers: {
              connection: 'close',
              traceparent: '00-' + traceId + '-2222222222222222-01',
            },
          });
          assert.equal(response.status, 200);
          assert.deepEqual(await response.json(), { traceId });
          console.log('PASS: HTTP response and incoming trace context');
        } finally {
          await new Promise((resolve, reject) => {
            server.close((error) => error ? reject(error) : resolve());
          });
        }
      `,
    ],
    {
      cwd: frontendDirectory,
      env: {
        PATH: process.env.PATH,
        NODE_ENV: 'test',
        OTEL_USE_CONSOLE_EXPORTERS: 'true',
        OTEL_NODE_ENABLED_INSTRUMENTATIONS: 'http,express',
        OTEL_NODE_RESOURCE_DETECTORS: 'none',
      },
      timeout: 20_000,
    },
  );

  expect(stdout).toContain('PASS: HTTP response and incoming trace context');
  expect(stdout).toContain("name: '@opentelemetry/instrumentation-http'");
  expect(stdout).toContain("name: '@opentelemetry/instrumentation-express'");
  expect(stdout).toContain("name: 'GET /otel-smoke'");
  expect(stdout).toContain('Shutting down instrumentation');
}, 30_000);
