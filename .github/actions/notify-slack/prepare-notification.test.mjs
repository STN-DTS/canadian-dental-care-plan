import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(new URL('./prepare-notification.mjs', import.meta.url));
const apiMock = `
  import fs from 'node:fs';
  Date.now = () => Date.parse('2026-10-10T12:02:05Z');
  globalThis.fetch = async (url, options) => {
    fs.writeFileSync(process.env.TEST_REQUEST_FILE, JSON.stringify({
      url,
      authorization: options.headers.Authorization,
      accept: options.headers.Accept,
      hasSignal: options.signal instanceof AbortSignal
    }));
    if (process.env.TEST_API_MODE === 'network-error') throw new Error('fixture failure');
    return {
      ok: process.env.TEST_API_MODE !== 'http-error',
      json: async () => ({ run_started_at: process.env.TEST_STARTED_AT })
    };
  };
`;

function runNotification(overrides = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'slack-notification-test-'));
  const outputPath = path.join(directory, 'output');
  const requestPath = path.join(directory, 'request');
  try {
    const result = spawnSync(process.execPath, ['--import', `data:text/javascript,${encodeURIComponent(apiMock)}`, scriptPath], {
      cwd: directory,
      encoding: 'utf8',
      timeout: 15000,
      env: {
        ...process.env,
        SERVER_URL: 'https://github.com',
        REPOSITORY: 'STN-DTS/repo',
        REF_NAME: 'main',
        ACTOR: 'test-user',
        COMMIT_SHA: 'abcdef1234567890abcdef1234567890abcdef1234',
        JOB_RESULTS: '{}',
        GH_TOKEN: '',
        API_URL: 'https://api.github.com',
        RUN_ID: '123',
        RUN_ATTEMPT: '2',
        RUN_NUMBER: '42',
        NOTIFICATION_STATUS: 'started',
        SLACK_CHANNEL_ID: 'C123',
        THREAD_TS: '',
        WORKFLOW_NAME: 'Build and test',
        RUN_URL: 'https://github.com/STN-DTS/repo/actions/runs/123',
        MESSAGE: '',
        IMAGE_REF: '',
        TEST_API_MODE: 'success',
        TEST_STARTED_AT: '2026-10-10T12:00:00Z',
        ...overrides,
        EVENT_NAME: 'push',
        GITHUB_OUTPUT: outputPath,
        TEST_REQUEST_FILE: requestPath,
      },
    });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr);
    const lines = fs.readFileSync(outputPath, 'utf8').trimEnd().split('\n');
    assert.equal(lines.length, 1, 'Only the payload should be exported');
    assert.ok(lines[0].startsWith('payload='));
    return {
      payload: JSON.parse(lines[0].slice('payload='.length)),
      request: fs.existsSync(requestPath) ? JSON.parse(fs.readFileSync(requestPath, 'utf8')) : undefined,
      stdout: result.stdout,
    };
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

for (const [status, color, label] of [
  ['started', '#359FA3', 'Started'],
  ['success', 'good', 'Succeeded'],
  ['failure', 'danger', 'Failed'],
  ['cancelled', 'warning', 'Cancelled'],
  ['skipped', '#808080', 'Skipped'],
  ['unknown', '#808080', 'unknown'],
  ['constructor', '#808080', 'constructor'],
]) {
  test(`renders ${status} with the expected color and label`, () => {
    const { payload, request } = runNotification({ NOTIFICATION_STATUS: status });
    assert.equal(payload.channel, 'C123');
    assert.equal(payload.attachments[0].color, color);
    assert.equal(payload.attachments[0].blocks[1].fields[0].text, `Status: ${label}`);
    assert.equal(payload.attachments[0].blocks.length, 4);
    assert.equal(payload.thread_ts, undefined);
    assert.equal(request, undefined);
    assert.ok(payload.text.includes(status));
  });
}

test('preserves GitHub links, encoded refs, and escaped labels', () => {
  const { payload } = runNotification({
    REF_NAME: 'feature/<name>|test',
    ACTOR: 'dependabot[bot]',
  });
  const blocks = payload.attachments[0].blocks;
  assert.equal(blocks[1].fields[1].text, 'Ref: <https://github.com/STN-DTS/repo/tree/feature%2F%3Cname%3E%7Ctest|feature/&lt;name&gt;&#124;test>');
  assert.equal(blocks[1].fields[2].text, 'Repository: <https://github.com/STN-DTS/repo|STN-DTS/repo>');
  assert.equal(blocks[1].fields[4].text, 'Commit: <https://github.com/STN-DTS/repo/commit/abcdef1234567890abcdef1234567890abcdef1234|abcdef12>');
  assert.equal(blocks.at(-2).elements[0].text, 'Run #42 | Attempt 2 | By <https://github.com/dependabot%5Bbot%5D|dependabot[bot]>');
  assert.equal(blocks.at(-1).elements[0].url, 'https://github.com/STN-DTS/repo/actions/runs/123');
});

test('includes threaded results, multiline messages, all failed jobs, and image digests', () => {
  const message = 'Pushed image tags:\n- registry/image:v1\nQuoted "text"';
  const image = `registry/image@sha256:${'a'.repeat(64)}`;
  const { payload } = runNotification({
    NOTIFICATION_STATUS: 'failure',
    THREAD_TS: '123.456',
    MESSAGE: message,
    IMAGE_REF: image,
    JOB_RESULTS: JSON.stringify({
      'test-frontend': { result: 'failure' },
      'build-frontend': { result: 'failure' },
      'notify-start': { result: 'failure' },
      skipped: { result: 'skipped' },
    }),
  });
  const blocks = payload.attachments[0].blocks;
  assert.equal(payload.thread_ts, '123.456');
  assert.equal(blocks[2].text.text, message);
  assert.equal(blocks[3].text.text, 'Failed jobs:\n- test-frontend\n- build-frontend');
  assert.equal(blocks[4].text.text, `Image digest: ${image}`);
  assert.equal(blocks.length, 7);
});

test('fetches elapsed time for the current attempt without exposing the token', () => {
  const { payload, request, stdout } = runNotification({
    NOTIFICATION_STATUS: 'success',
    GH_TOKEN: 'fixture-token',
  });
  assert.equal(request.url, 'https://api.github.com/repos/STN-DTS/repo/actions/runs/123/attempts/2');
  assert.equal(request.authorization, 'Bearer fixture-token');
  assert.equal(request.accept, 'application/vnd.github+json');
  assert.equal(request.hasSignal, true);
  assert.equal(payload.attachments[0].blocks[2].elements[0].text, 'Elapsed: 2m 5s');
  assert.ok(!JSON.stringify(payload).includes('fixture-token'));
  assert.ok(!stdout.includes('fixture-token'));
});

test('does not request elapsed time for start notifications even with a token', () => {
  const { request } = runNotification({ GH_TOKEN: 'fixture-token' });
  assert.equal(request, undefined);
});

for (const [scenario, overrides] of [
  ['HTTP failure', { TEST_API_MODE: 'http-error' }],
  ['network failure', { TEST_API_MODE: 'network-error' }],
  ['invalid timestamp', { TEST_STARTED_AT: 'invalid' }],
]) {
  test(`posts without duration after ${scenario}`, () => {
    const { payload, stdout } = runNotification({
      NOTIFICATION_STATUS: 'success',
      GH_TOKEN: 'fixture-token',
      ...overrides,
    });
    assert.equal(payload.attachments[0].blocks.length, 4);
    assert.ok(stdout.includes('::warning::Unable to fetch workflow elapsed time; posting without it.'));
  });
}

test('clamps elapsed time to zero when the API start time is in the future', () => {
  const { payload } = runNotification({
    NOTIFICATION_STATUS: 'success',
    GH_TOKEN: 'fixture-token',
    TEST_STARTED_AT: '2026-10-10T12:03:00Z',
  });
  assert.equal(payload.attachments[0].blocks[2].elements[0].text, 'Elapsed: 0m 0s');
});
