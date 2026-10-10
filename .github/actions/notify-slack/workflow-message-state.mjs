/**
 * @file Finds this bot's workflow message in Slack history for forward-only updates.
 * Job concurrency serializes lookup and delivery. Lookup failures stop delivery
 * rather than risking duplicates or updating an unrelated message.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const METADATA_EVENT_TYPE = "stn_dts.workflow_run";

/**
 * @typedef {object} MessageState
 * @property {string} key Repository, run, attempt, and channel identity.
 * @property {number} phase Queued (1), started (2), or completed (3).
 * @property {string} timestamp Slack message timestamp.
 */

/**
 * Maps a workflow event to its monotonic phase.
 * @param {string} action GitHub activity type.
 * @returns {number} Lifecycle phase.
 */
export function lifecyclePhase(action) {
  const phases = { requested: 1, in_progress: 2, completed: 3 };
  if (!Object.hasOwn(phases, action)) throw new Error("Unsupported workflow lifecycle event");
  return phases[action];
}

/**
 * Allows only forward transitions and preserves the existing timestamp.
 * @param {string} action GitHub activity type.
 * @param {MessageState} [state] Existing message state.
 * @returns {{phase: number, shouldPost: boolean, timestamp: string}} Delivery decision.
 */
export function messageTransition(action, state) {
  const phase = lifecyclePhase(action);
  return { phase, shouldPost: !state || phase > state.phase, timestamp: state?.timestamp ?? "" };
}

/**
 * Validates state identity, phase, and timestamp before updating Slack.
 * @param {MessageState} state Candidate state.
 * @param {string} key Expected message identity.
 * @returns {MessageState} Validated state.
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
 * Builds hidden correlation metadata stored with the Slack message.
 * @param {string} repository Source repository.
 * @param {string} runId Source run ID.
 * @param {string} attempt Source run attempt.
 * @param {string} status Notification status.
 * @returns {object} Slack message metadata.
 */
export function messageMetadata(repository, runId, attempt, status) {
  return {
    event_type: METADATA_EVENT_TYPE,
    event_payload: {
      repository,
      run_id: String(runId),
      attempt: String(attempt),
      phase: status === "queued" ? 1 : status === "started" ? 2 : 3,
    },
  };
}

/**
 * Matches metadata or a legacy headline and attempt, only for this bot's messages.
 * @param {object} message Slack history message.
 * @param {{userId: string, repository: string, runId: string, attempt: string, channel: string, runUrl: string}} identity Expected identity.
 * @returns {MessageState | undefined} Matched state, if any.
 */
export function matchMessage(message, identity) {
  if (message.user !== identity.userId) return undefined;
  const key = `${identity.repository}:${identity.runId}:${identity.attempt}:${identity.channel}`;
  if (message.metadata) {
    if (message.metadata.event_type !== METADATA_EVENT_TYPE) return undefined;
    const payload = message.metadata.event_payload;
    if (!payload) throw new Error("Workflow message metadata payload unavailable");
    if (
      payload?.repository !== identity.repository ||
      String(payload.run_id) !== identity.runId ||
      String(payload.attempt) !== identity.attempt
    )
      return undefined;
    return validateState({ key, phase: payload.phase, timestamp: message.ts }, key);
  }

  const sections = [
    ...(message.blocks ?? []),
    ...(message.attachments ?? []).flatMap((attachment) => attachment.blocks ?? []),
  ]
    .filter((block) => block.type === "section" && block.text?.type === "mrkdwn")
    .map((block) => block.text.text);
  const headline = sections.find((text) => text.includes(`<${identity.runUrl}|`));
  const label = headline?.match(/^\*([^*]+)\* · </)?.[1];
  const attempts = sections.flatMap((text) =>
    [...text.matchAll(/\bAttempt (\d+)\b/g)].map((match) => match[1]),
  );
  if (!label || attempts.length !== 1 || attempts[0] !== identity.attempt) return undefined;
  const completedLabels = [
    "Succeeded",
    "Failed",
    "Cancelled",
    "Skipped",
    "Timed out",
    "Startup failed",
    "Action required",
    "Neutral",
    "Stale",
  ];
  const phase =
    label === "Queued"
      ? 1
      : label === "Started"
        ? 2
        : completedLabels.includes(label)
          ? 3
          : undefined;
  if (!phase) return undefined;
  return validateState({ key, phase, timestamp: message.ts }, key);
}

/**
 * Calls Slack without exposing tokens or response bodies in errors.
 * @param {string} method Slack API method.
 * @param {object} [parameters] Query parameters.
 * @returns {Promise<object>} Successful Slack response.
 */
async function requestSlack(method, parameters = {}) {
  const url = new URL(`https://slack.com/api/${method}`);
  for (const [name, value] of Object.entries(parameters)) url.searchParams.set(name, String(value));
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}` },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Slack ${method} request failed`);
  const data = await response.json();
  if (!data.ok)
    throw new Error(
      `Slack ${method} request rejected; check scopes, channel membership, and rate limits`,
    );
  return data;
}

/**
 * Searches bounded, paginated history and rejects multiple matching messages.
 * @param {object} identity Source run and bot identity.
 * @param {string} createdAt Source run creation time, or empty for all retained history.
 * @returns {Promise<MessageState | undefined>} Unique existing message.
 */
async function findMessage(identity, createdAt) {
  const parameters = { channel: identity.channel, include_all_metadata: true, limit: 100 };
  if (createdAt) {
    const timestamp = Date.parse(createdAt);
    if (!Number.isFinite(timestamp)) throw new Error("Invalid source run creation time");
    parameters.oldest = String(Math.max(0, Math.floor(timestamp / 1000) - 60));
  }
  const matches = new Map();
  const cursors = new Set();
  for (let page = 0; page < 100; page++) {
    const data = await requestSlack("conversations.history", parameters);
    for (const message of data.messages) {
      const state = matchMessage(message, identity);
      if (state) matches.set(state.timestamp, state);
    }
    if (matches.size > 1)
      throw new Error("Multiple workflow messages match; refusing an ambiguous update");
    const cursor = data.response_metadata?.next_cursor;
    if (!cursor) {
      if (data.has_more) throw new Error("Incomplete Slack history response");
      return matches.values().next().value;
    }
    if (cursors.has(cursor)) throw new Error("Repeated Slack history cursor");
    cursors.add(cursor);
    parameters.cursor = cursor;
  }
  throw new Error("Slack history search limit exceeded");
}

/**
 * Resolves bot identity and writes a safe post/update decision for the action.
 * @returns {Promise<void>}
 */
async function main() {
  const auth = await requestSlack("auth.test");
  if (!auth.user_id) throw new Error("Slack bot identity unavailable");
  const identity = {
    userId: auth.user_id,
    repository: process.env.REPOSITORY,
    runId: process.env.RUN_ID,
    attempt: process.env.RUN_ATTEMPT,
    channel: process.env.SLACK_CHANNEL_ID,
    runUrl: process.env.RUN_URL,
  };
  const state = await findMessage(identity, process.env.RUN_CREATED_AT);
  const action =
    process.env.NOTIFICATION_STATUS === "queued"
      ? "requested"
      : process.env.NOTIFICATION_STATUS === "started"
        ? "in_progress"
        : "completed";
  const transition = messageTransition(action, state);
  fs.appendFileSync(
    process.env.GITHUB_OUTPUT,
    `should-post=${transition.shouldPost}\nmessage-ts=${transition.timestamp}\n`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await main();
