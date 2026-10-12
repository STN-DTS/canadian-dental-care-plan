import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildPayload } from './prepare-payload.mjs';

const event = {
  repository: { full_name: 'org/repo' },
  workflow_run: {
    id: 123,
    name: 'Build <image>&|test',
    run_number: 41,
    run_attempt: 2,
    html_url: 'https://github.com/org/repo/actions/runs/123',
    head_branch: 'release/v7.3.4',
    head_sha: 'abcdef1234567890',
    actor: { login: 'original' },
    triggering_actor: { login: 'dependabot[bot]' },
    event: 'push',
    conclusion: 'success',
  },
};
const options = {
  channelId: 'C123',
  token: 'fixture-token',
  serverUrl: 'https://github.com',
  apiUrl: 'https://api.github.com',
};
const response = async (artifacts) => await Promise.resolve({ ok: true, json: async () => await Promise.resolve({ artifacts }) });

for (const [conclusion, label, color] of [
  ['success', 'Succeeded', '#2DA44E'],
  ['failure', 'Failed', '#CF222E'],
  ['timed_out', 'Timed out', '#CF222E'],
  ['startup_failure', 'Startup failed', '#CF222E'],
  ['cancelled', 'Cancelled', '#BF8700'],
  ['action_required', 'Action required', '#BF8700'],
  ['neutral', 'Neutral', '#808080'],
  ['skipped', 'Skipped', '#808080'],
  ['stale', 'Stale', '#808080'],
  ['constructor', 'constructor', '#808080'],
]) {
  test(`renders ${conclusion}`, async () => {
    const payload = await buildPayload({ ...event, workflow_run: { ...event.workflow_run, conclusion } }, { ...options, fetch: async () => await response([]) });
    assert.equal(payload.attachments[0].color, color);
    assert.equal(payload.attachments[0].blocks.length, 1);
    assert.equal(payload.text, `Workflow *<https://github.com/org/repo/actions/runs/123/attempts/2|Build &lt;image&gt;&amp;&#124;test #41>* - *${label}*`);
    assert.ok(!JSON.stringify(payload).includes(options.token));
  });
}

test('links commit and triggering actor with inline-code context', async () => {
  const payload = await buildPayload(event, { ...options, fetch: async () => await response([]) });
  const section = payload.attachments[0].blocks[0];
  assert.equal(section.fields, undefined);
  assert.equal(section.text.type, 'mrkdwn');
  assert.equal(section.text.text, 'In _org/repo_, triggered by `push` on `release/v7.3.4` at commit <https://github.com/org/repo/commit/abcdef1234567890|abcdef12> by <https://github.com/dependabot%5Bbot%5D|dependabot[bot]> (attempt `2`).');
});

for (const [elapsedSeconds, expected] of [
  [0, '0s'],
  [59, '59s'],
  [60, '1m 0s'],
  [252, '4m 12s'],
  [3600, '1h 0m 0s'],
  [3723, '1h 2m 3s'],
]) {
  test(`renders source-run duration ${expected}`, async () => {
    const payload = await buildPayload(
      {
        ...event,
        workflow_run: {
          ...event.workflow_run,
          created_at: '2026-10-10T00:00:00Z',
          run_started_at: '2026-10-11T00:00:00Z',
          updated_at: new Date(Date.parse('2026-10-11T00:00:00Z') + elapsedSeconds * 1000).toISOString(),
        },
      },
      { ...options, fetch: async () => await response([]) },
    );
    assert.ok(payload.attachments[0].blocks[0].text.text.endsWith(`(attempt \`2\`, duration \`${expected}\`).`));
    assert.ok(payload.attachments[0].fallback.endsWith(` | Duration: ${expected}`));
  });
}

for (const timestamps of [{}, { run_started_at: '2026-10-11T00:00:00Z' }, { run_started_at: 'invalid', updated_at: '2026-10-11T00:00:00Z' }, { run_started_at: '2026-10-11T00:00:01Z', updated_at: '2026-10-11T00:00:00Z' }]) {
  test(`omits unavailable or invalid duration ${JSON.stringify(timestamps)}`, async () => {
    const payload = await buildPayload({ ...event, workflow_run: { ...event.workflow_run, ...timestamps } }, { ...options, fetch: async () => await response([]) });
    assert.ok(payload.attachments[0].blocks[0].text.text.endsWith('(attempt `2`).'));
    assert.ok(!payload.attachments[0].fallback.includes('Duration:'));
  });
}

test('paginates and excludes expired artifacts', async () => {
  const requests = [];
  const payload = await buildPayload(event, {
    ...options,
    fetch: async (url, config) => {
      requests.push(String(url));
      assert.equal(config.headers.Authorization, 'Bearer fixture-token');
      assert.ok(config.signal instanceof AbortSignal);
      return await response(requests.length === 1 ? Array.from({ length: 100 }, (_, id) => ({ id, name: 'expired', expired: true })) : [{ id: 77, name: 'coverage <test>', expired: false }]);
    },
  });
  assert.equal(requests.length, 2);
  assert.ok(requests[1].endsWith('page=2'));
  assert.equal(payload.attachments[0].blocks[1].text.text, '<https://github.com/org/repo/actions/runs/123#artifacts|1 artifact>');
  assert.ok(!JSON.stringify(payload).includes('expired'));
});

test('links the artifact count without individual artifact names', async () => {
  const payload = await buildPayload(event, {
    ...options,
    fetch: async () => await response(Array.from({ length: 12 }, (_, id) => ({ id, name: '&'.repeat(150), expired: false }))),
  });
  const text = payload.attachments[0].blocks[1].text.text;
  assert.equal(text, '<https://github.com/org/repo/actions/runs/123#artifacts|12 artifacts>');
  assert.ok(!JSON.stringify(payload).includes('&amp;'.repeat(150)));
  assert.ok(payload.attachments[0].fallback.endsWith('12 artifacts: https://github.com/org/repo/actions/runs/123#artifacts'));
});

test('counts all pages even when the first has more than ten retained artifacts', async () => {
  let requests = 0;
  const payload = await buildPayload(event, {
    ...options,
    fetch: async () => {
      requests++;
      return await response(
        Array.from({ length: requests === 1 ? 100 : 3 }, (_, id) => ({
          id,
          expired: false,
        })),
      );
    },
  });
  assert.equal(requests, 2);
  assert.equal(payload.attachments[0].blocks[1].text.text, '<https://github.com/org/repo/actions/runs/123#artifacts|103 artifacts>');
});

test('uses total_count to stop on a full final page', async () => {
  let requests = 0;
  const payload = await buildPayload(event, {
    ...options,
    fetch: async () => {
      requests++;
      return await Promise.resolve({
        ok: true,
        json: async () =>
          await Promise.resolve({
            total_count: 100,
            artifacts: Array.from({ length: 100 }, () => ({ expired: false })),
          }),
      });
    },
  });
  assert.equal(requests, 1);
  assert.equal(payload.attachments[0].blocks[1].text.text, '<https://github.com/org/repo/actions/runs/123#artifacts|100 artifacts>');
});

test('omits an incomplete count when the pagination limit is reached', async () => {
  let requests = 0;
  const warnings = [];
  const payload = await buildPayload(event, {
    ...options,
    warn: (warning) => warnings.push(warning),
    fetch: async () => {
      requests++;
      return await response(Array.from({ length: 100 }, () => ({ expired: false })));
    },
  });
  assert.equal(requests, 10);
  assert.equal(payload.attachments[0].blocks.length, 1);
  assert.equal(warnings.length, 1);
});

test('falls back to the original actor and handles a missing ref', async () => {
  const payload = await buildPayload(
    {
      ...event,
      workflow_run: { ...event.workflow_run, triggering_actor: null, head_branch: null },
    },
    { ...options, fetch: async () => await response([]) },
  );
  const text = payload.attachments[0].blocks[0].text.text;
  assert.ok(text.includes('on `Unknown`'));
  assert.ok(text.includes('by <https://github.com/original|original>'));
});

for (const mode of ['http', 'network']) {
  test(`posts without artifacts after ${mode} failure`, async () => {
    const warnings = [];
    const payload = await buildPayload(event, {
      ...options,
      warn: (warning) => warnings.push(warning),
      fetch: async () => {
        if (mode === 'network') throw new Error(options.token);
        return await Promise.resolve({ ok: false });
      },
    });
    assert.equal(payload.attachments[0].blocks.length, 1);
    assert.equal(warnings.length, 1);
    assert.ok(!warnings[0].includes(options.token));
  });
}
