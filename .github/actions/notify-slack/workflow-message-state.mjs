/**
 * @file Persists one Slack message per workflow run attempt using trusted artifacts.
 * Job concurrency serializes restore, Slack update, and save. Restore errors stop
 * delivery rather than risking duplicates; lifecycle phases prevent backward updates.
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

/**
 * @typedef {object} MessageState
 * @property {string} key Repository, source run, attempt, and channel identity.
 * @property {number} phase Queued (1), started (2), or completed (3).
 * @property {string} timestamp Slack message timestamp, preserved as a string.
 */
const MAX_STATE_BYTES = 65536;

/**
 * Maps a workflow_run event to a monotonic lifecycle phase.
 * @param {string} action GitHub activity type.
 * @returns {number} The lifecycle phase.
 * @throws {Error} If the activity type is unsupported.
 */
export function lifecyclePhase(action) {
  const phases = { requested: 1, in_progress: 2, completed: 3 };
  if (!Object.hasOwn(phases, action)) throw new Error("Unsupported workflow lifecycle event");
  return phases[action];
}

/**
 * Allows only forward transitions, reusing the existing message timestamp.
 * @param {string} action GitHub activity type.
 * @param {MessageState} [state] Previously persisted state.
 * @returns {{phase: number, shouldPost: boolean, timestamp: string}} Delivery decision.
 */
export function messageTransition(action, state) {
  const phase = lifecyclePhase(action);
  return { phase, shouldPost: !state || phase > state.phase, timestamp: state?.timestamp ?? "" };
}

/**
 * Validates identity and timestamp before state can control Slack updates.
 * @param {MessageState} state Parsed artifact or newly constructed state.
 * @param {string} key Expected message identity.
 * @returns {MessageState} The validated state.
 * @throws {Error} If state is malformed or belongs to another run attempt or channel.
 */
export function validateState(state, key) {
  if (
    state?.key !== key ||
    ![1, 2, 3].includes(state.phase) ||
    typeof state.timestamp !== "string" ||
    !/^\d+\.\d+$/.test(state.timestamp)
  ) {
    throw new Error("Invalid Slack message state");
  }
  return state;
}

/**
 * Requests GitHub data with authentication and a bounded timeout.
 * @param {string | URL} url GitHub API endpoint.
 * @returns {Promise<Response>} Successful response.
 * @throws {Error} If GitHub rejects the request or the timeout expires.
 */
async function requestGitHub(url) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${process.env.GH_TOKEN}`,
      Accept: "application/vnd.github+json",
    },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("Unable to retrieve notification state");
  return response;
}

/**
 * Reads only state.json from a size-limited archive; never extracts executable files.
 * @param {Response} response Artifact ZIP download response.
 * @param {string} key Expected message identity.
 * @returns {Promise<MessageState>} Validated state.
 */
async function readStateArchive(response, key) {
  const archive = await response.arrayBuffer();
  if (archive.byteLength > MAX_STATE_BYTES)
    throw new Error("Notification state archive is too large");
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "slack-state-"));
  try {
    const archivePath = path.join(directory, "state.zip");
    fs.writeFileSync(archivePath, Buffer.from(archive));
    const content = execFileSync("unzip", ["-p", archivePath, "state.json"], {
      encoding: "utf8",
      maxBuffer: MAX_STATE_BYTES,
    });
    return validateState(JSON.parse(content), key);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

/**
 * Restores the latest retained state produced by this notifier workflow.
 * @param {string} api Repository API base URL.
 * @param {string} artifactName Artifact name scoped to run attempt and channel.
 * @param {string} key Expected message identity.
 * @returns {Promise<MessageState | undefined>} State, or undefined if none is retained.
 */
async function restoreState(api, artifactName, key) {
  const currentRun = await (
    await requestGitHub(`${api}/actions/runs/${process.env.GITHUB_RUN_ID}`)
  ).json();
  for (let page = 1; ; page++) {
    const url = new URL(`${api}/actions/artifacts`);
    url.searchParams.set("name", artifactName);
    url.searchParams.set("per_page", "100");
    url.searchParams.set("page", String(page));
    const data = await (await requestGitHub(url)).json();
    const artifacts = data.artifacts
      .filter((artifact) => artifact.name === artifactName && !artifact.expired)
      .sort((first, second) => second.id - first.id);
    for (const artifact of artifacts) {
      if (artifact.size_in_bytes > MAX_STATE_BYTES)
        throw new Error("Notification state artifact is too large");
      const producer = await (
        await requestGitHub(`${api}/actions/runs/${artifact.workflow_run.id}`)
      ).json();
      if (producer.workflow_id !== currentRun.workflow_id || producer.event !== "workflow_run")
        continue;
      return readStateArchive(
        await requestGitHub(`${api}/actions/artifacts/${artifact.id}/zip`),
        key,
      );
    }
    if (data.artifacts.length < 100) return undefined;
  }
}

/**
 * Restores a delivery decision or saves state after a successful Slack operation.
 * Reads workflow environment configuration and writes GitHub step outputs.
 * @returns {Promise<void>}
 */
async function main() {
  const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"));
  const run = event.workflow_run;
  const key = `${process.env.REPOSITORY}:${run.id}:${run.run_attempt}:${process.env.SLACK_CHANNEL_ID}`;
  const artifactName = `slack-message-${event.repository.id}-${run.id}-${run.run_attempt}-${process.env.SLACK_CHANNEL_ID}`;
  const stateFile = path.join(process.env.RUNNER_TEMP, "slack-message-state", "state.json");

  if (process.env.NOTIFICATION_STATE_MODE === "save") {
    const state = validateState(
      { key, phase: lifecyclePhase(event.action), timestamp: process.env.MESSAGE_TS },
      key,
    );
    fs.mkdirSync(path.dirname(stateFile), { recursive: true });
    fs.writeFileSync(stateFile, JSON.stringify(state));
    return;
  }

  const api = `${process.env.API_URL}/repos/${process.env.REPOSITORY}`;
  const state = await restoreState(api, artifactName, key);
  const transition = messageTransition(event.action, state);
  const outputs = {
    "should-post": String(transition.shouldPost),
    "message-ts": transition.timestamp,
    "artifact-name": artifactName,
    "state-file": stateFile,
  };
  fs.appendFileSync(
    process.env.GITHUB_OUTPUT,
    Object.entries(outputs)
      .map(([name, value]) => `${name}=${value}\n`)
      .join(""),
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
