/**
 * @file Prepares GitHub metadata for the Vault-backed Slack notification action.
 * Reads workflow metadata and job results from environment variables supplied by action.yaml.
 * Writes the complete Slack payload as JSON to GITHUB_OUTPUT.
 * This script does not fetch Vault secrets or send Slack messages.
 */

import fs from "node:fs";
import { messageMetadata } from "./workflow-message-state.mjs";

/**
 * Escapes characters that could alter a Slack mrkdwn link label.
 *
 * @param {string} value - Unescaped display label.
 * @returns {string} The escaped label.
 */
function escapeLabel(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\|/g, "&#124;");
}

/**
 * Escapes a value for use as inline code in Slack mrkdwn.
 *
 * @param {string} value - The value to escape and format as inline code.
 * @returns {string} The escaped inline code string.
 */
function inlineCode(value) {
  return `\`${escapeLabel(value).replace(/`/g, "&#96;")}\``;
}

const { SERVER_URL, REPOSITORY, REF_NAME, ACTOR } = process.env;
const repositoryUrl = `${SERVER_URL}/${REPOSITORY}`;
const commitSha = process.env.COMMIT_SHA;

const failedJobs = Object.entries(JSON.parse(process.env.JOB_RESULTS))
  .filter(([, job]) => job.result === "failure")
  .map(([name]) => name);

const links = {
  ref: `Ref: <${repositoryUrl}/tree/${encodeURIComponent(REF_NAME)}|${escapeLabel(REF_NAME)}>`,
  actor: `By <${SERVER_URL}/${encodeURIComponent(ACTOR)}|${escapeLabel(ACTOR)}>`,
  failures: failedJobs.length
    ? `Failed jobs:\n${failedJobs.map((name) => `- ${name}`).join("\n")}`
    : "",
  commit: `Commit: <${repositoryUrl}/commit/${encodeURIComponent(commitSha)}|${escapeLabel(commitSha.slice(0, 8))}>`,
};

/**
 * Builds the Slack message with status colors, links, and nonempty optional sections.
 *
 * @returns {object} The chat.postMessage payload, without authentication credentials.
 */
function createNotificationPayload() {
  const status = process.env.NOTIFICATION_STATUS;
  const statuses = {
    success: { color: "#2DA44E", label: "Succeeded" },
    failure: { color: "#CF222E", label: "Failed" },
    cancelled: { color: "#BF8700", label: "Cancelled" },
    queued: { color: "#359FA3", label: "Queued" },
    started: { color: "#359FA3", label: "Started" },
    skipped: { color: "#808080", label: "Skipped" },
    timed_out: { color: "#CF222E", label: "Timed out" },
    startup_failure: { color: "#CF222E", label: "Startup failed" },
    action_required: { color: "#BF8700", label: "Action required" },
    neutral: { color: "#808080", label: "Neutral" },
    stale: { color: "#808080", label: "Stale" },
  };

  const presentation = Object.hasOwn(statuses, status)
    ? statuses[status]
    : { color: "#808080", label: status };

  const headline = `*${escapeLabel(presentation.label)}* · <${process.env.RUN_URL}|${escapeLabel(process.env.WORKFLOW_NAME)} #${process.env.RUN_NUMBER}>`;
  const metadata = `Trigger: ${inlineCode(process.env.EVENT_NAME)} | Attempt ${process.env.RUN_ATTEMPT} | ${links.actor}`;
  const fallbackMetadata = `Trigger: ${process.env.EVENT_NAME} | Attempt ${process.env.RUN_ATTEMPT} | By ${ACTOR}`;
  const blocks = [
    {
      type: "section",
      text: { type: "mrkdwn", text: `${links.ref} | ${links.commit}\n${metadata}` },
    },
  ];

  if (links.failures) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Failed jobs*\n${failedJobs.map((name) => `- ${inlineCode(name)}`).join("\n")}`,
      },
    });
  }

  return {
    channel: process.env.SLACK_CHANNEL_ID,
    metadata: messageMetadata(REPOSITORY, process.env.RUN_ID, process.env.RUN_ATTEMPT, status),
    ...(process.env.MESSAGE_TS ? { ts: process.env.MESSAGE_TS } : {}),
    blocks: [{ type: "section", text: { type: "mrkdwn", text: headline } }],
    attachments: [
      {
        color: presentation.color,
        blocks,
        fallback: [
          `${presentation.label} · ${process.env.WORKFLOW_NAME} #${process.env.RUN_NUMBER}`,
          `${REPOSITORY} | Ref: ${REF_NAME} | Commit: ${commitSha.slice(0, 8)}`,
          fallbackMetadata,
          links.failures,
          process.env.RUN_URL,
        ]
          .filter(Boolean)
          .join("\n"),
      },
    ],
  };
}

const payload = createNotificationPayload();
fs.appendFileSync(process.env.GITHUB_OUTPUT, `payload=${JSON.stringify(payload)}\n`);
