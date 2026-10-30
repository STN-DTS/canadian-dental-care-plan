import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'vitest';

const action = readFileSync(new URL('./action.yaml', import.meta.url), 'utf8');
const script = action.match(/      run: \|\n((?:        .*\n|\n)+)/)?.[1];
assert.ok(script, 'The action must contain its authentication script');

function configure(token) {
  const directory = mkdtempSync(join(tmpdir(), 'cdcp-pnpm-auth.'));
  const environment = join(directory, 'env');

  try {
    writeFileSync(environment, 'EXISTING=value\n');
    const result = spawnSync('bash', ['-e', '-c', script], {
      encoding: 'utf8',
      env: { ...process.env, AUTH_TOKEN: token, GITHUB_ENV: environment },
    });
    return { ...result, environment: readFileSync(environment, 'utf8') };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test('exports scoped authentication for subsequent steps without logging the token', () => {
  const token = 'dummy-token-with-"quotes"-and-$characters';
  const result = configure(token);

  assert.equal(result.status, 0);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, '');
  const lines = result.environment.trimEnd().split('\n');
  assert.equal(lines[0], 'EXISTING=value');
  assert.equal(lines[1], `NODE_AUTH_TOKEN=${token}`);
  const auth = JSON.parse(lines[2].slice('pnpm_config__auth='.length));
  assert.deepEqual(auth, {
    'https://npm.pkg.github.com': { '@stn-dts': { authToken: '${NODE_AUTH_TOKEN}' } },
  });
  const downstream = spawnSync(process.execPath, ['-e', 'process.stdout.write(process.env.NODE_AUTH_TOKEN)'], {
    encoding: 'utf8',
    env: { ...process.env, ...Object.fromEntries(lines.map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)])) },
  });
  assert.equal(downstream.status, 0);
  assert.equal(downstream.stdout, token);
});

test.each(['', 'dummy\nINJECTED=value', 'dummy\rINJECTED=value', 'dummy\r\nINJECTED=value'])('rejects invalid token input %j without modifying the environment', (token) => {
  const result = configure(token);

  assert.equal(result.status, 1);
  assert.match(result.stdout, /::error::The auth-token input must be a non-empty, single-line GitHub Packages token\./);
  assert.equal(result.stderr, '');
  assert.equal(result.environment, 'EXISTING=value\n');
  assert.ok(!result.stdout.includes('INJECTED'));
});
