import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { messageTransition, validateState } from "./workflow-message-state.mjs";

const scriptPath = fileURLToPath(new URL("./prepare-notification.mjs", import.meta.url));
const apiMock = `
  import fs from 'node:fs';
  globalThis.fetch = async (url) => {
    fs.writeFileSync(process.env.TEST_REQUEST_FILE, JSON.stringify({ url }));
    throw new Error('Unexpected API request');
  };
`;

function runNotification(overrides = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "slack-notification-test-"));
  const outputPath = path.join(directory, "output");
  const requestPath = path.join(directory, "request");
  try {
    const result = spawnSync(
      process.execPath,
      ["--import", `data:text/javascript,${encodeURIComponent(apiMock)}`, scriptPath],
      {
        cwd: directory,
        encoding: "utf8",
        timeout: 15000,
        env: {
          ...process.env,
          SERVER_URL: "https://github.com",
          REPOSITORY: "STN-DTS/repo",
          REF_NAME: "main",
          ACTOR: "test-user",
          COMMIT_SHA: "abcdef1234567890abcdef1234567890abcdef1234",
          JOB_RESULTS: "{}",
          GH_TOKEN: "",
          RUN_ATTEMPT: "2",
          RUN_NUMBER: "42",
          NOTIFICATION_STATUS: "queued",
          SLACK_CHANNEL_ID: "C123",
          MESSAGE_TS: "",
          WORKFLOW_NAME: "Build and test",
          RUN_URL: "https://github.com/STN-DTS/repo/actions/runs/123",
          ...overrides,
          EVENT_NAME: "push",
          GITHUB_OUTPUT: outputPath,
          TEST_REQUEST_FILE: requestPath,
        },
      },
    );
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr);
    const lines = fs.readFileSync(outputPath, "utf8").trimEnd().split("\n");
    assert.equal(lines.length, 1, "Only the payload should be exported");
    assert.ok(lines[0].startsWith("payload="));
    return {
      payload: JSON.parse(lines[0].slice("payload=".length)),
      request: fs.existsSync(requestPath)
        ? JSON.parse(fs.readFileSync(requestPath, "utf8"))
        : undefined,
      stdout: result.stdout,
    };
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

for (const [status, color, label] of [
  ["queued", "#359FA3", "Queued"],
  ["started", "#359FA3", "Started"],
  ["success", "#2DA44E", "Succeeded"],
  ["failure", "#CF222E", "Failed"],
  ["cancelled", "#BF8700", "Cancelled"],
  ["skipped", "#808080", "Skipped"],
  ["timed_out", "#CF222E", "Timed out"],
  ["startup_failure", "#CF222E", "Startup failed"],
  ["action_required", "#BF8700", "Action required"],
  ["neutral", "#808080", "Neutral"],
  ["stale", "#808080", "Stale"],
  ["unknown", "#808080", "unknown"],
  ["constructor", "#808080", "constructor"],
]) {
  test(`renders ${status} with the expected color and label`, () => {
    const { payload, request } = runNotification({ NOTIFICATION_STATUS: status });
    assert.equal(payload.channel, "C123");
    assert.equal(payload.attachments[0].color, color);
    assert.equal(
      payload.blocks[0].text.text,
      `*${label}* · <https://github.com/STN-DTS/repo/actions/runs/123|Build and test #42>`,
    );
    assert.equal(payload.blocks.length, 1);
    assert.equal(payload.attachments[0].blocks.length, 1);
    assert.ok(!JSON.stringify(payload.attachments[0].blocks).includes("Build and test #42"));
    assert.equal(payload.thread_ts, undefined);
    assert.equal(payload.reply_broadcast, undefined);
    assert.equal(request, undefined);
    assert.ok(payload.attachments[0].fallback.startsWith(`${label} · Build and test #42`));
  });
}

test("renders the headline above attachment details without duplicate top-level text", () => {
  const { payload } = runNotification();
  assert.equal(Object.hasOwn(payload, "text"), false);
  assert.equal(payload.attachments.length, 1);
  assert.equal(payload.blocks.length, 1);
  assert.ok(payload.blocks[0].text.text.startsWith("*Queued*"));
  assert.ok(payload.attachments[0].blocks[0].text.text.startsWith("Ref:"));
});

test("updates an existing message without creating a thread reply", () => {
  const { payload } = runNotification({ NOTIFICATION_STATUS: "started", MESSAGE_TS: "123.456" });
  assert.equal(payload.ts, "123.456");
  assert.equal(payload.thread_ts, undefined);
  assert.equal(payload.reply_broadcast, undefined);
});

test("preserves GitHub links, encoded refs, and escaped labels", () => {
  const { payload } = runNotification({
    REF_NAME: "feature/<name>|test",
    ACTOR: "dependabot[bot]",
  });
  const blocks = payload.attachments[0].blocks;
  assert.equal(
    blocks[0].text.text,
    "Ref: <https://github.com/STN-DTS/repo/tree/feature%2F%3Cname%3E%7Ctest|feature/&lt;name&gt;&#124;test> | Commit: <https://github.com/STN-DTS/repo/commit/abcdef1234567890abcdef1234567890abcdef1234|abcdef12>\nTrigger: `push` | Attempt 2 | By <https://github.com/dependabot%5Bbot%5D|dependabot[bot]>",
  );
  assert.equal(blocks[0].text.type, "mrkdwn");
  assert.ok(!JSON.stringify(blocks).includes("View workflow run"));
  assert.ok(!JSON.stringify(payload).includes('"type":"button"'));
});

test("includes all failed originating jobs without workflow-specific exclusions", () => {
  const { payload } = runNotification({
    NOTIFICATION_STATUS: "failure",
    JOB_RESULTS: JSON.stringify({
      "test-frontend": { result: "failure" },
      "build-frontend": { result: "failure" },
      "notify-start": { result: "failure" },
      skipped: { result: "skipped" },
    }),
  });
  const blocks = payload.attachments[0].blocks;
  assert.equal(blocks[1].text.type, "mrkdwn");
  assert.equal(
    blocks[1].text.text,
    "*Failed jobs*\n- `test-frontend`\n- `build-frontend`\n- `notify-start`",
  );
  assert.equal(blocks.length, 2);
  assert.ok(
    payload.attachments[0].fallback.includes(
      "Failed jobs:\n- test-frontend\n- build-frontend\n- notify-start",
    ),
  );
  assert.ok(blocks[0].text.text.includes("Trigger:"));
  assert.ok(blocks[0].text.text.includes("By "));
});

test("escapes inline-code job names and keeps fallback metadata plain", () => {
  const jobName = "test <image>&|`";
  const { payload } = runNotification({
    NOTIFICATION_STATUS: "failure",
    REF_NAME: "feature/<name>|test",
    JOB_RESULTS: JSON.stringify({ [jobName]: { result: "failure" } }),
  });
  const attachment = payload.attachments[0];
  assert.equal(
    attachment.blocks[1].text.text,
    "*Failed jobs*\n- `test &lt;image&gt;&amp;&#124;&#96;`",
  );
  assert.ok(attachment.fallback.includes(`Failed jobs:\n- ${jobName}`));
  assert.ok(attachment.fallback.includes("Ref: feature/<name>|test | Commit: abcdef12"));
  assert.ok(attachment.fallback.includes("Trigger: push | Attempt 2 | By test-user"));
});

test("ignores legacy custom message, image, and thread values", () => {
  const { payload } = runNotification({
    NOTIFICATION_STATUS: "success",
    IMAGE_REF: `registry/image@sha256:${"b".repeat(64)}`,
    MESSAGE: "Custom build details",
    THREAD_TS: "123.456",
  });
  assert.equal(payload.attachments[0].blocks.length, 1);
  assert.equal(payload.thread_ts, undefined);
  assert.equal(payload.reply_broadcast, undefined);
  assert.ok(!JSON.stringify(payload).includes("Custom build details"));
  assert.ok(!JSON.stringify(payload).includes("sha256:"));
});

test("escapes the workflow headline and uses the run number rather than the run ID", () => {
  const { payload } = runNotification({ WORKFLOW_NAME: "Build <image> & test|publish" });
  assert.equal(
    payload.blocks[0].text.text,
    "*Queued* · <https://github.com/STN-DTS/repo/actions/runs/123|Build &lt;image&gt; &amp; test&#124;publish #42>",
  );
});

test("omits elapsed time and makes no API request for completion", () => {
  const { payload, request, stdout } = runNotification({
    NOTIFICATION_STATUS: "success",
    GH_TOKEN: "fixture-token",
  });
  assert.equal(request, undefined);
  assert.ok(
    payload.attachments[0].blocks[0].text.text.includes("\nTrigger: `push` | Attempt 2 | By "),
  );
  assert.ok(!JSON.stringify(payload).includes("Elapsed:"));
  assert.ok(!JSON.stringify(payload).includes("fixture-token"));
  assert.ok(!stdout.includes("fixture-token"));
});

function runWorkflowMetadata(action, conclusion, pages = [], apiMode = "success") {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "slack-workflow-test-"));
  const outputPath = path.join(directory, "output");
  const eventPath = path.join(directory, "event.json");
  const requestPath = path.join(directory, "requests.json");
  const mock = `
    import fs from 'node:fs';
    const requests = [];
    globalThis.fetch = async (url, options) => {
      requests.push({ url: String(url), hasSignal: options.signal instanceof AbortSignal });
      fs.writeFileSync(process.env.TEST_REQUEST_FILE, JSON.stringify(requests));
      if (process.env.TEST_API_MODE === 'network-error') throw new Error('fixture failure');
      return {
        ok: process.env.TEST_API_MODE !== 'http-error',
        json: async () => ({ jobs: JSON.parse(process.env.TEST_PAGES)[requests.length - 1] })
      };
    };
  `;
  try {
    fs.writeFileSync(
      eventPath,
      JSON.stringify({ action, workflow_run: { id: 987, run_attempt: 3, conclusion } }),
    );
    const result = spawnSync(
      process.execPath,
      [
        "--import",
        `data:text/javascript,${encodeURIComponent(mock)}`,
        fileURLToPath(new URL("./prepare-workflow-run.mjs", import.meta.url)),
      ],
      {
        encoding: "utf8",
        timeout: 15000,
        env: {
          ...process.env,
          GITHUB_EVENT_PATH: eventPath,
          GITHUB_OUTPUT: outputPath,
          GH_TOKEN: "fixture-token",
          API_URL: "https://api.github.com",
          REPOSITORY: "STN-DTS/repo",
          TEST_REQUEST_FILE: requestPath,
          TEST_PAGES: JSON.stringify(pages),
          TEST_API_MODE: apiMode,
        },
      },
    );
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr);
    const output = fs.readFileSync(outputPath, "utf8").trimEnd();
    assert.ok(output.startsWith("job-results="));
    assert.ok(!output.includes("fixture-token"));
    assert.ok(!result.stdout.includes("fixture-token"));
    return {
      results: JSON.parse(output.slice("job-results=".length)),
      requests: fs.existsSync(requestPath) ? JSON.parse(fs.readFileSync(requestPath, "utf8")) : [],
      stdout: result.stdout,
    };
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

for (const [action, conclusion] of [
  ["requested", null],
  ["completed", "success"],
]) {
  test(`skips job lookups for ${action} ${conclusion ?? ""}`, () => {
    const { results, requests } = runWorkflowMetadata(action, conclusion);
    assert.deepEqual(results, {});
    assert.deepEqual(requests, []);
  });
}

test("collects failures across pages from the originating run attempt", () => {
  const firstPage = Array.from({ length: 100 }, (_, index) => ({
    name: `job-${index}`,
    conclusion: "success",
  }));
  firstPage[0] = { name: "test-frontend", conclusion: "failure" };
  const { results, requests } = runWorkflowMetadata("completed", "failure", [
    firstPage,
    [
      { name: "build-frontend", conclusion: "timed_out" },
      { name: "setup", conclusion: "startup_failure" },
      { name: "cancelled", conclusion: "cancelled" },
    ],
  ]);
  assert.deepEqual(results, {
    "test-frontend": { result: "failure" },
    "build-frontend": { result: "failure" },
    setup: { result: "failure" },
  });
  assert.equal(requests.length, 2);
  assert.equal(
    requests[0].url,
    "https://api.github.com/repos/STN-DTS/repo/actions/runs/987/attempts/3/jobs?per_page=100&page=1",
  );
  assert.ok(requests[1].url.endsWith("page=2"));
  assert.ok(requests.every((request) => request.hasSignal));
});

for (const apiMode of ["http-error", "network-error"]) {
  test(`keeps completion deliverable after a job lookup ${apiMode}`, () => {
    const { results, stdout } = runWorkflowMetadata("completed", "failure", [], apiMode);
    assert.deepEqual(results, {});
    assert.ok(stdout.includes("::warning::Unable to fetch failed jobs"));
  });
}

test("advances one message through queued, started, and completed without backward transitions", () => {
  assert.deepEqual(messageTransition("requested"), { phase: 1, shouldPost: true, timestamp: "" });
  assert.deepEqual(messageTransition("in_progress"), { phase: 2, shouldPost: true, timestamp: "" });
  assert.deepEqual(messageTransition("completed"), { phase: 3, shouldPost: true, timestamp: "" });
  for (const phase of [1, 2, 3]) {
    const state = { phase, timestamp: "123.456" };
    for (const [action, target] of [
      ["requested", 1],
      ["in_progress", 2],
      ["completed", 3],
    ]) {
      assert.deepEqual(messageTransition(action, state), {
        phase: target,
        shouldPost: target > phase,
        timestamp: "123.456",
      });
    }
  }
});

test("rejects cross-attempt and malformed message state", () => {
  const state = { key: "repo:123:1:C123", phase: 2, timestamp: "123.456" };
  assert.equal(validateState(state, state.key), state);
  assert.throws(() => validateState(state, "repo:123:2:C123"));
  assert.throws(() => validateState({ ...state, phase: 4 }, state.key));
  assert.throws(() => validateState({ ...state, timestamp: "123\ninjected=true" }, state.key));
  assert.throws(() => messageTransition("unknown"));
});

function runMessageState({
  action = "in_progress",
  phase,
  mode = "restore",
  apiError = false,
  untrusted = false,
  attempt = 1,
} = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "slack-lifecycle-test-"));
  const eventPath = path.join(directory, "event.json");
  const outputPath = path.join(directory, "output");
  const requestPath = path.join(directory, "requests");
  const state = { key: `STN-DTS/repo:123:${attempt}:C123`, phase, timestamp: "123.456" };
  const mock = `
    import fs from 'node:fs';
    import childProcess from 'node:child_process';
    import { syncBuiltinESMExports } from 'node:module';
    childProcess.execFileSync = (command, args) => {
      if (command !== 'unzip' || args[0] !== '-p' || args[2] !== 'state.json') throw new Error('Unexpected archive extraction');
      return process.env.TEST_STATE;
    };
    syncBuiltinESMExports();
    const requests = [];
    globalThis.fetch = async (url) => {
      requests.push(String(url));
      fs.writeFileSync(process.env.TEST_REQUEST_FILE, JSON.stringify(requests));
      if (process.env.TEST_API_ERROR === 'true') return { ok: false };
      const state = JSON.parse(process.env.TEST_STATE);
      let data;
      if (String(url).includes('/actions/artifacts?')) {
        data = { artifacts: state.phase ? [{
          id: 77, name: 'slack-message-42-123-' + process.env.TEST_ATTEMPT + '-C123',
          expired: false, size_in_bytes: 100, workflow_run: { id: 88 }
        }] : [] };
      } else if (String(url).endsWith('/actions/runs/88')) {
        data = { workflow_id: process.env.TEST_UNTRUSTED === 'true' ? 999 : 55, event: 'workflow_run' };
      } else {
        data = { workflow_id: 55 };
      }
      return { ok: true, json: async () => data, arrayBuffer: async () => new Uint8Array([1, 2]).buffer };
    };
  `;
  try {
    fs.writeFileSync(
      eventPath,
      JSON.stringify({
        action,
        repository: { id: 42 },
        workflow_run: { id: 123, run_attempt: attempt },
      }),
    );
    fs.writeFileSync(outputPath, "");
    const result = spawnSync(
      process.execPath,
      [
        "--import",
        `data:text/javascript,${encodeURIComponent(mock)}`,
        fileURLToPath(new URL("./workflow-message-state.mjs", import.meta.url)),
      ],
      {
        encoding: "utf8",
        timeout: 15000,
        env: {
          ...process.env,
          GITHUB_EVENT_PATH: eventPath,
          GITHUB_OUTPUT: outputPath,
          RUNNER_TEMP: directory,
          GITHUB_RUN_ID: "99",
          REPOSITORY: "STN-DTS/repo",
          API_URL: "https://api.github.com",
          GH_TOKEN: "fixture-token",
          SLACK_CHANNEL_ID: "C123",
          MESSAGE_TS: "123.456",
          NOTIFICATION_STATE_MODE: mode,
          TEST_STATE: JSON.stringify(state),
          TEST_REQUEST_FILE: requestPath,
          TEST_API_ERROR: String(apiError),
          TEST_UNTRUSTED: String(untrusted),
          TEST_ATTEMPT: String(attempt),
        },
      },
    );
    assert.ifError(result.error);
    const output = fs.readFileSync(outputPath, "utf8");
    const stateFile = path.join(directory, "slack-message-state", "state.json");
    assert.ok(!output.includes("fixture-token"));
    assert.ok(!result.stderr.includes("fixture-token"));
    return {
      status: result.status,
      output,
      saved: fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, "utf8")) : undefined,
      requests: fs.existsSync(requestPath) ? JSON.parse(fs.readFileSync(requestPath, "utf8")) : [],
    };
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

test("restores the trusted timestamp and suppresses duplicate Started events", () => {
  const result = runMessageState({ phase: 2 });
  assert.equal(result.status, 0);
  assert.ok(result.output.includes("should-post=false\n"));
  assert.ok(result.output.includes("message-ts=123.456\n"));
});

test("updates Queued to Started and keeps completion final after late events", () => {
  for (const [action, phase, shouldPost] of [
    ["in_progress", 1, true],
    ["completed", 2, true],
    ["requested", 3, false],
    ["in_progress", 3, false],
  ]) {
    const result = runMessageState({ action, phase });
    assert.equal(result.status, 0);
    assert.ok(result.output.includes(`should-post=${shouldPost}\n`));
  }
});

test("creates a new message for a rerun without a Queued event", () => {
  const result = runMessageState({ attempt: 2 });
  assert.equal(result.status, 0);
  assert.ok(result.output.includes("should-post=true\nmessage-ts=\n"));
  assert.ok(result.output.includes("artifact-name=slack-message-42-123-2-C123\n"));
});

test("does not trust message state artifacts produced by a different workflow", () => {
  const result = runMessageState({ phase: 2, untrusted: true });
  assert.equal(result.status, 0);
  assert.ok(result.output.includes("message-ts=\n"));
  assert.ok(!result.requests.some((url) => url.endsWith("/zip")));
});

test("fails closed when state cannot be retrieved", () => {
  const result = runMessageState({ apiError: true });
  assert.notEqual(result.status, 0);
  assert.equal(result.output, "");
});

test("saves completion state with its timestamp without API requests", () => {
  const result = runMessageState({ mode: "save", action: "completed" });
  assert.equal(result.status, 0);
  assert.deepEqual(result.saved, {
    key: "STN-DTS/repo:123:1:C123",
    phase: 3,
    timestamp: "123.456",
  });
  assert.deepEqual(result.requests, []);
});
