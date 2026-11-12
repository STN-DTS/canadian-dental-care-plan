import { execFile } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { gunzipSync } from 'node:zlib';
import { expect, test } from 'vitest';

const execFileAsync = promisify(execFile);
const frontendDirectory = fileURLToPath(new URL('../../', import.meta.url));

test.each(['console', 'otlp'])(
  'the official ESM hook instruments Express requests with the application SDK preload (%s)',
  async (sink) => {
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

      const { stdout } = await execFileAsync(
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
        import { once } from 'node:events';
        import { context, trace } from '@opentelemetry/api';
        import { suppressTracing } from '@opentelemetry/core';
        import express from 'express';

        const app = express();
        const traceId = '11111111111111111111111111111111';

        app.get('/otel-smoke', function smokeHandler(request, response) {
          trace.getSpan(context.active())?.setAttribute('password', 'otel-attribute-secret');
          response.json({ traceId: trace.getSpan(context.active())?.spanContext().traceId });
        });
        app.use(function backendHandler(request, response, next) {
          if (request.path.startsWith('/dental-care/')) {
            response.sendStatus(204);
            return;
          }
          next();
        });

        const server = app.listen(0, '127.0.0.1');
        await once(server, 'listening');

        try {
          const address = server.address();
          assert.ok(address && typeof address !== 'string');

          const response = await context.with(suppressTracing(context.active()), () => fetch('http://127.0.0.1:' + address.port + '/otel-smoke?token=otel-query-secret', {
            headers: {
              connection: 'close',
              traceparent: '00-' + traceId + '-2222222222222222-01',
            },
          }));
          assert.equal(response.status, 200);
          assert.deepEqual(await response.json(), { traceId });
          for (const path of [
            "/dental-care/appeal-upload-eligible/pp/v1/esdc_clients(esdc_clientnumber='000-000-000%20path-person%40example.test%20path-token-canary')",
            '/dental-care/doc-metadata/pp/v1/esdc_clients(00000000-0000-0000-0000-000000000001)/Microsoft.Dynamics.CRM.esdc_UploadEvidentiaryDocuments',
          ]) {
            const backendResponse = await fetch('http://127.0.0.1:' + address.port + path, { headers: { connection: 'close' } });
            assert.equal(backendResponse.status, 204);
          }
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
            OTEL_USE_CONSOLE_EXPORTERS: sink === 'console' ? 'true' : 'false',
            OTEL_API_KEY: 'local-synthetic-trace-key',
            OTEL_TRACES_ENDPOINT: `http://127.0.0.1:${address.port}/v1/traces`,
            OTEL_NODE_ENABLED_INSTRUMENTATIONS: 'http,express,router,undici',
            OTEL_NODE_RESOURCE_DETECTORS: 'none',
          },
          timeout: 20_000,
        },
      );

      const exported = sink === 'console' ? stdout : Buffer.concat(payloads).toString('utf8');
      expect(stdout).toContain('PASS: HTTP response and incoming trace context');
      expect(exported).toContain('@opentelemetry/instrumentation-http');
      expect(exported).toContain('@opentelemetry/instrumentation-express');
      expect(exported).toContain('@opentelemetry/instrumentation-undici');
      expect(exported).toContain('middleware - backendHandler');
      expect(exported).not.toContain('@opentelemetry/instrumentation-router');
      expect(exported).not.toContain('middleware - patched');
      expect(exported).toContain('GET /otel-smoke');
      expect(exported).toContain('token=%5BREDACTED%5D');
      expect(exported).toContain('[REDACTED]');

      for (const output of [exported, stdout]) {
        expect(output).not.toContain('otel-query-secret');
        expect(output).not.toContain('otel-attribute-secret');
        expect(output).not.toContain('000-000-000');
        expect(output).not.toContain('path-person');
        expect(output).not.toContain('path-token-canary');
        expect(output).not.toContain('00000000-0000-0000-0000-000000000001');
        expect(output).not.toContain('local-synthetic-trace-key');
      }

      expect(exported).toContain('/dental-care/appeal-upload-eligible/pp/v1/esdc_clients([REDACTED])');
      expect(exported).toContain('/dental-care/doc-metadata/pp/v1/esdc_clients([REDACTED])');
      expect(stdout).toContain('Shutting down OpenTelemetry instrumentation');
    } finally {
      await new Promise<void>((resolve, reject) => {
        collector.close((error) => (error ? reject(error) : resolve()));
      });
    }
  },
  30_000,
);
