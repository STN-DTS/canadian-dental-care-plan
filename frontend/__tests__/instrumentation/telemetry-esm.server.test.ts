import { SpanKind } from '@opentelemetry/api';
import { execFile } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { gunzipSync } from 'node:zlib';
import { expect, test } from 'vitest';
import { z } from 'zod';

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
        import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
        import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace';
        import express from 'express';
        import { DefaultHttpClient } from './app/.server/http/http-client.ts';

        for (const Exporter of [OTLPTraceExporter, ConsoleSpanExporter]) {
          const exportSpans = Exporter.prototype.export;
          Exporter.prototype.export = function (spans, callback) {
            for (const span of spans) {
              console.log('OTEL_SMOKE_SPAN:' + JSON.stringify({
                name: span.name, kind: span.kind, scope: span.instrumentationScope.name,
                attributes: span.attributes, traceId: span.spanContext().traceId,
                spanId: span.spanContext().spanId, parentSpanId: span.parentSpanContext?.spanId,
              }));
            }
            exportSpans.call(this, spans, callback);
          };
        }

        const app = express();
        const traceId = '11111111111111111111111111111111';
        const client = new DefaultHttpClient({ countHttpStatus() {} });
        let origin;

        app.get('/otel-smoke', async function smokeHandler(request, response) {
          trace.getSpan(context.active())?.setAttribute('password', 'otel-attribute-secret');
          const dependency = await client.instrumentedFetch('http.client.smoke.posts', origin + '/otel-dependency?token=client-query-canary', {
            method: 'POST',
            headers: { authorization: 'Bearer client-header-canary', connection: 'close' },
            body: 'client-request-canary',
          });
          assert.equal(dependency.status, 404);
          assert.equal(await dependency.text(), 'client-response-canary');
          response.json({ traceId: trace.getSpan(context.active())?.spanContext().traceId });
        });
        app.post('/otel-dependency', function dependencyHandler(request, response) {
          assert.equal(request.headers.authorization, 'Bearer client-header-canary');
          assert.equal(trace.getSpan(context.active())?.spanContext().traceId, traceId);
          response.status(404).send('client-response-canary');
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
          origin = 'http://127.0.0.1:' + address.port;

          const response = await context.with(suppressTracing(context.active()), () => fetch(origin + '/otel-smoke?token=otel-query-secret', {
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
            LOG_LEVEL: 'error',
            AUDIT_LOG_ENABLED: 'false',
            OTEL_USE_CONSOLE_EXPORTERS: sink === 'console' ? 'true' : 'false',
            OTEL_BSP_SCHEDULE_DELAY: '60000',
            OTEL_API_KEY: 'local-synthetic-trace-key',
            OTEL_TRACES_ENDPOINT: `http://127.0.0.1:${address.port}/v1/traces`,
            OTEL_NODE_ENABLED_INSTRUMENTATIONS: 'http,express,router,undici',
            OTEL_NODE_RESOURCE_DETECTORS: 'none',
          },
          timeout: 20_000,
        },
      );

      const exported = sink === 'console' ? stdout : Buffer.concat(payloads).toString('utf8');
      const spanPrefix = 'OTEL_SMOKE_SPAN:';
      const spanSchema = z.object({
        name: z.string(),
        kind: z.number(),
        scope: z.string(),
        attributes: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
        traceId: z.string(),
        spanId: z.string(),
        parentSpanId: z.string().optional(),
      });
      const spans = stdout
        .split('\n')
        .filter((line) => line.startsWith(spanPrefix))
        .map((line) => spanSchema.parse(JSON.parse(line.slice(spanPrefix.length))));
      const clients = spans.filter((span) => span.kind === SpanKind.CLIENT);
      expect(clients.filter((span) => span.scope === 'default').map((span) => span.name)).toEqual(['http.client.smoke.posts']);
      expect(clients.filter((span) => span.scope === '@opentelemetry/instrumentation-undici').map((span) => span.name)).toEqual(['GET', 'GET']);
      const dependency = clients.find((span) => span.name === 'http.client.smoke.posts');
      expect(dependency?.attributes).toEqual({ 'http.request.method': 'POST', 'http.response.status_code': 404, 'error.type': '404' });
      const downstream = spans.find((span) => span.kind === SpanKind.SERVER && span.name === 'POST /otel-dependency');
      expect(downstream?.traceId).toBe('1'.repeat(32));
      expect(downstream?.parentSpanId).toBe(dependency?.spanId);
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
        expect(output).not.toContain('client-query-canary');
        expect(output).not.toContain('client-header-canary');
        expect(output).not.toContain('client-request-canary');
        expect(output).not.toContain('client-response-canary');
      }

      expect(exported).toContain('/dental-care/appeal-upload-eligible/pp/v1/esdc_clients([REDACTED])');
      expect(exported).toContain('/dental-care/doc-metadata/pp/v1/esdc_clients([REDACTED])');
      expect(exported).not.toContain('/v1/traces');

      expect(payloads).toHaveLength(sink === 'otlp' ? 1 : 0);
      expect(stdout).toContain('Shutting down OpenTelemetry instrumentation');
    } finally {
      await new Promise<void>((resolve, reject) => {
        collector.close((error) => (error ? reject(error) : resolve()));
      });
    }
  },
  30_000,
);
