import assert from "node:assert/strict";
import { test } from "node:test";
import { buildPayload } from "./prepare-payload.mjs";

const event = {
  repository: { full_name: "org/repo" },
  workflow_run: {
    id: 123,
    name: "Build <image>&|test",
    run_number: 41,
    run_attempt: 2,
    html_url: "https://github.com/org/repo/actions/runs/123",
    head_branch: "release/v7.3.4",
    head_sha: "abcdef1234567890",
    actor: { login: "original" },
    triggering_actor: { login: "dependabot[bot]" },
    event: "push",
    conclusion: "success",
  },
};
const options = {
  channelId: "C123",
  token: "fixture-token",
  serverUrl: "https://github.com",
  apiUrl: "https://api.github.com",
};
const response = (artifacts) => ({ ok: true, json: async () => ({ artifacts }) });

for (const [conclusion, label, color] of [
  ["success", "Succeeded", "#2DA44E"],
  ["failure", "Failed", "#CF222E"],
  ["timed_out", "Timed out", "#CF222E"],
  ["startup_failure", "Startup failed", "#CF222E"],
  ["cancelled", "Cancelled", "#BF8700"],
  ["action_required", "Action required", "#BF8700"],
  ["neutral", "Neutral", "#808080"],
  ["skipped", "Skipped", "#808080"],
  ["stale", "Stale", "#808080"],
  ["constructor", "constructor", "#808080"],
]) {
  test(`renders ${conclusion}`, async () => {
    const payload = await buildPayload(
      { ...event, workflow_run: { ...event.workflow_run, conclusion } },
      { ...options, fetch: async () => response([]) },
    );
    assert.equal(payload.attachments[0].color, color);
    assert.equal(payload.attachments[0].blocks[0].fields[0].text, `*Result: ${label}*`);
    assert.equal(
      payload.text,
      "Workflow *<https://github.com/org/repo/actions/runs/123/attempts/2|Build &lt;image&gt;&amp;&#124;test #41>* completed",
    );
    assert.ok(!JSON.stringify(payload).includes(options.token));
  });
}

test("links commit and triggering actor with inline-code context", async () => {
  const payload = await buildPayload(event, { ...options, fetch: async () => response([]) });
  const fields = payload.attachments[0].blocks[0].fields;
  assert.equal(fields[1].text, "Ref: `release/v7.3.4`");
  assert.equal(fields[3].text, "Attempt: `2`");
  assert.equal(
    fields[4].text,
    "Commit: <https://github.com/org/repo/commit/abcdef1234567890|abcdef12>",
  );
  assert.equal(fields[5].text, "Actor: <https://github.com/dependabot%5Bbot%5D|dependabot[bot]>");
  assert.equal(fields[6].text, "Trigger: `push`");
});

test("paginates and excludes expired artifacts", async () => {
  const requests = [];
  const payload = await buildPayload(event, {
    ...options,
    fetch: async (url, config) => {
      requests.push(String(url));
      assert.equal(config.headers.Authorization, "Bearer fixture-token");
      assert.ok(config.signal instanceof AbortSignal);
      return response(
        requests.length === 1
          ? Array.from({ length: 100 }, (_, id) => ({ id, name: "expired", expired: true }))
          : [{ id: 77, name: "coverage <test>", expired: false }],
      );
    },
  });
  assert.equal(requests.length, 2);
  assert.ok(requests[1].endsWith("page=2"));
  assert.ok(
    payload.attachments[0].blocks[1].text.text.includes("/artifacts/77|coverage &lt;test&gt;>"),
  );
  assert.ok(!JSON.stringify(payload).includes("expired"));
});

test("budgets escaped artifact text and preserves complete links", async () => {
  const payload = await buildPayload(event, {
    ...options,
    fetch: async () =>
      response(
        Array.from({ length: 12 }, (_, id) => ({ id, name: "&".repeat(150), expired: false })),
      ),
  });
  const text = payload.attachments[0].blocks[1].text.text;
  assert.ok(text.length <= 3000);
  const lines = text.split("\n").filter((line) => line.startsWith("- "));
  assert.ok(lines.length < 10);
  assert.ok(lines.every((line) => line.endsWith("&amp;".repeat(150) + ">")));
  assert.ok(
    text.endsWith("<https://github.com/org/repo/actions/runs/123|View artifacts in workflow run>"),
  );
});

test("caps short artifact lists at ten links", async () => {
  const payload = await buildPayload(event, {
    ...options,
    fetch: async () =>
      response(
        Array.from({ length: 12 }, (_, id) => ({ id, name: `report-${id}`, expired: false })),
      ),
  });
  const text = payload.attachments[0].blocks[1].text.text;
  assert.equal(text.split("\n").filter((line) => line.startsWith("- ")).length, 10);
  assert.ok(text.length <= 3000);
});

test("falls back to the original actor and handles a missing ref", async () => {
  const payload = await buildPayload(
    {
      ...event,
      workflow_run: { ...event.workflow_run, triggering_actor: null, head_branch: null },
    },
    { ...options, fetch: async () => response([]) },
  );
  const fields = payload.attachments[0].blocks[0].fields;
  assert.equal(fields[1].text, "Ref: `Unknown`");
  assert.equal(fields[5].text, "Actor: <https://github.com/original|original>");
});

for (const mode of ["http", "network"]) {
  test(`posts without artifacts after ${mode} failure`, async () => {
    const warnings = [];
    const payload = await buildPayload(event, {
      ...options,
      warn: (warning) => warnings.push(warning),
      fetch: async () => {
        if (mode === "network") throw new Error(options.token);
        return { ok: false };
      },
    });
    assert.equal(payload.attachments[0].blocks.length, 1);
    assert.equal(warnings.length, 1);
    assert.ok(!warnings[0].includes(options.token));
  });
}
