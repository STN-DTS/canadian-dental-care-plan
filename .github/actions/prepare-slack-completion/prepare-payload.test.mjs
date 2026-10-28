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
const jsonResponse = async (body) => await Promise.resolve({ ok: true, json: async () => await Promise.resolve(body) });
const response = async (artifacts) => await jsonResponse({ artifacts });
const identityResponse = async () => await jsonResponse({ ok: true, user_id: 'U123BOT' });

test('renders requested workflows as queued without duration or artifact lookup', async () => {
  const payload = await buildPayload(
    {
      ...event,
      action: 'requested',
      workflow_run: {
        ...event.workflow_run,
        status: 'queued',
        conclusion: null,
        run_started_at: '2026-10-12T00:00:00Z',
        updated_at: '2026-10-12T00:01:00Z',
      },
    },
    {
      ...options,
      slackToken: 'slack-fixture-token',
      fetch: () => assert.fail('Requested workflows must not fetch artifacts.'),
      warn: () => assert.fail('Requested workflows must not warn about artifacts.'),
    },
  );
  assert.equal(payload.text, 'Workflow *<https://github.com/org/repo/actions/runs/123/attempts/2|Build &lt;image&gt;&amp;&#124;test #41>* - *Queued*');
  assert.equal(payload.attachments[0].color, '#0969DA');
  assert.equal(payload.attachments[0].blocks.length, 1);
  assert.ok(payload.attachments[0].fallback.startsWith('Result: Queued |'));
  assert.ok(!JSON.stringify(payload).includes('Duration:'));
  assert.ok(!payload.attachments[0].blocks[0].text.text.includes('duration'));
  assert.ok(!JSON.stringify(payload).includes(options.token));
});

for (const action of ['requested', 'completed']) {
  test(`adds source-run metadata to ${action} messages`, async () => {
    const payload = await buildPayload({ ...event, action }, { ...options, fetch: async () => await response([]) });
    assert.deepEqual(payload.metadata, {
      event_type: 'cdcp_workflow_run',
      event_payload: {
        repository: 'org/repo',
        run_id: '123',
        run_attempt: '2',
        action,
      },
    });
  });
}

test('finds queued-message metadata and broadcasts completion in its thread', async () => {
  const calls = [];
  const payload = await buildPayload(
    {
      ...event,
      action: 'completed',
      workflow_run: { ...event.workflow_run, created_at: '2026-10-12T00:00:00Z' },
    },
    {
      ...options,
      slackToken: 'slack-fixture-token',
      fetch: async (url, config) => {
        calls.push(String(url));

        if (url.origin === 'https://slack.com') {
          assert.equal(config.headers.Authorization, 'Bearer slack-fixture-token');
          assert.ok(config.signal instanceof AbortSignal);

          if (url.pathname === '/api/auth.test') {
            assert.equal(config.method, 'POST');
            return await identityResponse();
          }

          assert.equal(url.pathname, '/api/conversations.history');
          assert.equal(url.searchParams.get('channel'), 'C123');
          assert.equal(url.searchParams.get('include_all_metadata'), 'true');
          assert.equal(url.searchParams.get('oldest'), '1791763140');
          return await jsonResponse({ ok: true, messages: [queuedMessage()] });
        }

        return await response([]);
      },
    },
  );
  assert.equal(calls.length, 3);
  assert.equal(calls[0], 'https://slack.com/api/auth.test');
  assert.equal(payload.thread_ts, '1791763200.000001');
  assert.equal(payload.reply_broadcast, true);
  assert.ok(!JSON.stringify(payload).includes('slack-fixture-token'));
});

function queuedMessage(context = {}, overrides = {}) {
  return {
    ts: '1791763200.000001',
    user: 'U123BOT',
    metadata: {
      event_type: 'cdcp_workflow_run',
      event_payload: {
        repository: 'org/repo',
        run_id: '123',
        run_attempt: '2',
        action: 'requested',
        ...context,
      },
    },
    ...overrides,
  };
}

test('rejects copied queue metadata from another Slack sender', async () => {
  const payload = await buildPayload(event, {
    ...options,
    slackToken: 'slack-fixture-token',
    fetch: async (url) => {
      if (url.origin !== 'https://slack.com') {
        return await response([]);
      }

      if (url.pathname === '/api/auth.test') {
        return await identityResponse();
      }

      return await jsonResponse({
        ok: true,
        messages: [queuedMessage({}, { user: 'UOTHER', ts: '1791763200.999999' }), queuedMessage()],
      });
    },
  });
  assert.equal(payload.thread_ts, '1791763200.000001');
  assert.equal(payload.reply_broadcast, true);
});

test('paginates Slack history and ignores other runs, attempts, repositories, and replies', async () => {
  let pages = 0;
  const payload = await buildPayload(event, {
    ...options,
    slackToken: 'slack-fixture-token',
    fetch: async (url) => {
      if (url.origin !== 'https://slack.com') {
        return await response([]);
      }

      if (url.pathname === '/api/auth.test') {
        return await identityResponse();
      }

      pages++;
      assert.equal(url.searchParams.get('cursor'), pages === 1 ? null : 'next-page');

      if (pages === 2) {
        return await jsonResponse({ ok: true, messages: [queuedMessage()] });
      }

      return await jsonResponse({
        ok: true,
        messages: [
          queuedMessage({ repository: 'other/repo' }),
          queuedMessage({ run_id: '999' }),
          queuedMessage({ run_attempt: '1' }),
          queuedMessage({ action: 'completed' }),
          queuedMessage({}, { metadata: { event_type: 'other' } }),
          queuedMessage({}, { thread_ts: '1791763200.999999' }),
          queuedMessage({}, { ts: 'invalid' }),
          { ts: '1791763200.000002' },
        ],
        has_more: true,
        response_metadata: { next_cursor: 'next-page' },
      });
    },
  });
  assert.equal(pages, 2);
  assert.equal(payload.thread_ts, '1791763200.000001');
  assert.equal(payload.reply_broadcast, true);
});

const historyResponses = {
  'missing parent': { ok: true, messages: [] },
  api: { ok: false, error: 'missing_scope' },
  malformed: { ok: true },
  'missing cursor': { ok: true, messages: [], has_more: true },
  'pagination limit': {
    ok: true,
    messages: [],
    has_more: true,
    response_metadata: { next_cursor: 'more' },
  },
};

for (const mode of ['missing parent', 'http', 'api', 'rate limit', 'network', 'malformed', 'missing cursor', 'pagination limit']) {
  test(`posts standalone completion after Slack history ${mode}`, async () => {
    let requests = 0;
    const warnings = [];
    const payload = await buildPayload(event, {
      ...options,
      slackToken: 'slack-fixture-token',
      warn: (warning) => warnings.push(warning),
      fetch: async (url) => {
        if (url.origin !== 'https://slack.com') {
          return await response([{ expired: false }]);
        }

        if (url.pathname === '/api/auth.test') {
          return await identityResponse();
        }

        requests++;

        if (mode === 'network') {
          throw new Error('slack-fixture-token');
        }

        if (mode === 'http' || mode === 'rate limit') {
          return { ok: false, status: mode === 'rate limit' ? 429 : 503 };
        }

        return await jsonResponse(historyResponses[mode]);
      },
    });
    assert.equal(requests, mode === 'pagination limit' ? 10 : 1);
    assert.equal(warnings.length, mode === 'missing parent' ? 0 : 1);
    assert.equal(Object.hasOwn(payload, 'thread_ts'), false);
    assert.equal(Object.hasOwn(payload, 'reply_broadcast'), false);
    assert.equal(payload.attachments[0].blocks.length, 2);
    assert.ok(payload.text.endsWith('*Succeeded*'));
    assert.ok(!JSON.stringify({ payload, warnings }).includes('slack-fixture-token'));
  });
}

for (const sender of ['UOTHER', undefined, 123]) {
  test(`posts standalone completion for an untrusted queued sender: ${String(sender)}`, async () => {
    const payload = await buildPayload(event, {
      ...options,
      slackToken: 'slack-fixture-token',
      fetch: async (url) => {
        if (url.origin !== 'https://slack.com') {
          return await response([]);
        }

        if (url.pathname === '/api/auth.test') {
          return await identityResponse();
        }

        return await jsonResponse({ ok: true, messages: [queuedMessage({}, { user: sender })] });
      },
    });
    assert.equal(Object.hasOwn(payload, 'thread_ts'), false);
    assert.equal(Object.hasOwn(payload, 'reply_broadcast'), false);
  });
}

const invalidIdentities = {
  api: { ok: false, error: 'invalid_auth' },
  malformed: null,
  'missing user': { ok: true },
  'empty user': { ok: true, user_id: '' },
  'blank user': { ok: true, user_id: ' ' },
  'numeric user': { ok: true, user_id: 123 },
};

for (const mode of [...Object.keys(invalidIdentities), 'http', 'network', 'invalid JSON']) {
  test(`posts standalone completion after Slack identity failure: ${mode}`, async () => {
    const requests = [];
    const warnings = [];
    const payload = await buildPayload(event, {
      ...options,
      slackToken: 'slack-fixture-token',
      warn: (warning) => warnings.push(warning),
      fetch: async (url) => {
        if (url.origin !== 'https://slack.com') {
          return await response([{ expired: false }]);
        }

        requests.push(String(url));

        if (mode === 'network') {
          throw new Error('slack-fixture-token');
        }

        if (mode === 'http') {
          return { ok: false, status: 503 };
        }

        if (mode === 'invalid JSON') {
          return {
            ok: true,
            json: async () => await Promise.reject(new Error('slack-fixture-token')),
          };
        }

        return await jsonResponse(invalidIdentities[mode]);
      },
    });
    assert.deepEqual(requests, ['https://slack.com/api/auth.test']);
    assert.equal(warnings.length, 1);
    assert.equal(Object.hasOwn(payload, 'thread_ts'), false);
    assert.equal(Object.hasOwn(payload, 'reply_broadcast'), false);
    assert.equal(payload.attachments[0].blocks.length, 2);
    assert.ok(payload.text.endsWith('*Succeeded*'));
    assert.ok(!JSON.stringify({ payload, warnings }).includes('slack-fixture-token'));
  });
}

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
        if (mode === 'network') {
          throw new Error(options.token);
        }

        return await Promise.resolve({ ok: false });
      },
    });
    assert.equal(payload.attachments[0].blocks.length, 1);
    assert.equal(warnings.length, 1);
    assert.ok(!warnings[0].includes(options.token));
  });
}
