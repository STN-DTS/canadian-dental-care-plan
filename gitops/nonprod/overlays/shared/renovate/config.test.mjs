import assert from 'node:assert/strict';
import { generateKeyPairSync, verify } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { afterEach, beforeEach, test, vi } from 'vitest';

import config from './config.mjs';

vi.mock('node:fs/promises', () => ({ readFile: vi.fn() }));

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const token = 'ghs_test_only';
let requests;
let responses;

beforeEach(() => {
  vi.stubEnv('RENOVATE_APP_CLIENT_ID', 'test-client-id');
  vi.stubEnv('RENOVATE_APP_PRIVATE_KEY_FILE', '/test/private-key.pem');
  vi.stubEnv('RENOVATE_DRY_RUN', 'full');
  vi.mocked(readFile).mockResolvedValue(privateKey.export({ type: 'pkcs8', format: 'pem' }));
  requests = [];
  responses = [
    { id: 123 },
    { token, expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString() },
    { default_branch: 'default/branch' },
    {
      encoding: 'base64',
      content: Buffer.from(JSON.stringify({ engines: { node: '>=26.12.1 <27.0.0' }, packageManager: 'pnpm@12.16.0+sha512.test' })).toString('base64'),
    },
  ];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, options) => {
      requests.push({ url, ...options });
      const response = responses.shift();
      return await Promise.resolve(response instanceof Response ? response : Response.json(response));
    }),
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

test('authenticates the App, limits the token to CDCP, and reads default-branch tool versions', async () => {
  assert.deepEqual(await config(), {
    token,
    repositories: ['STN-DTS/canadian-dental-care-plan'],
    autodiscover: false,
    constraints: { node: '26.12.1', pnpm: '12.16.0' },
  });
  assert.equal(requests[0].url, 'https://api.github.com/repos/STN-DTS/canadian-dental-care-plan/installation');
  const [header, payload, signature] = requests[0].headers.Authorization.slice('Bearer '.length).split('.');
  assert.equal(verify('RSA-SHA256', Buffer.from(`${header}.${payload}`), publicKey, Buffer.from(signature, 'base64url')), true);
  const claims = JSON.parse(Buffer.from(payload, 'base64url'));
  assert.equal(claims.iss, 'test-client-id');
  assert.equal(claims.exp - claims.iat, 600);
  assert.ok(claims.iat <= Date.now() / 1000);
  assert.ok(claims.exp > Date.now() / 1000);
  assert.equal(requests[1].url, 'https://api.github.com/app/installations/123/access_tokens');
  assert.equal(requests[1].method, 'POST');
  assert.deepEqual(JSON.parse(requests[1].body), { repositories: ['canadian-dental-care-plan'] });
  assert.equal(requests[3].url, 'https://api.github.com/repos/STN-DTS/canadian-dental-care-plan/contents/package.json?ref=default%2Fbranch');
  assert.equal(requests[3].headers.Authorization, `Bearer ${token}`);
  assert.equal(requests.length, 4);
});

test('requires explicit dry-run or write mode before making API requests', async () => {
  vi.stubEnv('RENOVATE_DRY_RUN', '');
  await assert.rejects(config(), /RENOVATE_DRY_RUN must explicitly be full or null/);
  assert.equal(requests.length, 0);
});

test('requires App credentials without attempting API requests', async () => {
  vi.stubEnv('RENOVATE_APP_CLIENT_ID', '');
  await assert.rejects(config(), /RENOVATE_APP_CLIENT_ID and RENOVATE_APP_PRIVATE_KEY_FILE are required/);
  assert.equal(requests.length, 0);
});

test('accepts explicit write mode', async () => {
  vi.stubEnv('RENOVATE_DRY_RUN', 'null');
  assert.deepEqual((await config()).constraints, { node: '26.12.1', pnpm: '12.16.0' });
});

test('reports authentication failure without including the response body', async () => {
  responses[0] = new Response('sensitive response content', { status: 403 });
  await assert.rejects(config(), /installation failed with HTTP 403\.$/);
  assert.equal(requests.length, 1);
});

test('rejects a missing default branch', async () => {
  responses[2].default_branch = '';
  await assert.rejects(config(), /did not return the repository default branch/);
  assert.equal(requests.length, 3);
});

test('rejects an unsupported manifest response', async () => {
  responses[3].encoding = 'none';
  await assert.rejects(config(), /did not return base64 package.json content/);
});

test('rejects an invalid manifest instead of selecting arbitrary tool versions', async () => {
  responses[3].content = Buffer.from(JSON.stringify({ engines: { node: '^26' }, packageManager: 'pnpm@latest' })).toString('base64');
  await assert.rejects(config(), /minimum Node.js version and an exact pnpm/);
});

test('reports repository read failures', async () => {
  responses[2] = new Response(null, { status: 500 });
  await assert.rejects(config(), /failed with HTTP 500/);
});

test('rejects invalid installation IDs before requesting a token', async () => {
  responses[0].id = -1;
  await assert.rejects(config(), /valid App installation ID/);
  assert.equal(requests.length, 1);
});

test.each(['', undefined])('rejects a missing installation token (%s)', async (missing) => {
  responses[1].token = missing;
  await assert.rejects(config(), /installation token valid for more than 50 minutes/);
  assert.equal(requests.length, 2);
});

test('rejects a token that could expire before the Job deadline', async () => {
  responses[1].expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  await assert.rejects(config(), /installation token valid for more than 50 minutes/);
  assert.equal(requests.length, 2);
});
