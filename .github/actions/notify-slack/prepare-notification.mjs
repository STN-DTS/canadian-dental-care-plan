/**
 * @file Prepares GitHub metadata for the Vault-backed Slack notification action.
 * Reads workflow metadata and job results from environment variables supplied by action.yaml.
 * Writes the complete Slack payload as JSON to GITHUB_OUTPUT.
 * Optionally queries the current run attempt for elapsed time; API failures omit duration.
 * This script does not fetch Vault secrets or send Slack messages.
 */

import fs from "node:fs";

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

const { SERVER_URL, REPOSITORY, REF_NAME, ACTOR } = process.env;
const repositoryUrl = `${SERVER_URL}/${REPOSITORY}`;
const commitSha = process.env.COMMIT_SHA;

const failedJobs = Object.entries(JSON.parse(process.env.JOB_RESULTS))
  .filter(([name, job]) => !name.startsWith("notify-") && job.result === "failure")
  .map(([name]) => `- ${name}`);

const links = {
  ref: `Ref: <${repositoryUrl}/tree/${encodeURIComponent(REF_NAME)}|${escapeLabel(REF_NAME)}>`,
  actor: `By <${SERVER_URL}/${encodeURIComponent(ACTOR)}|${escapeLabel(ACTOR)}>`,
  failures: failedJobs.length ? `Failed jobs:\n${failedJobs.join("\n")}` : "",
  commit: `Commit: <${repositoryUrl}/commit/${encodeURIComponent(commitSha)}|${escapeLabel(commitSha.slice(0, 8))}>`,
};

/**
 * Fetches elapsed time for the current run attempt.
 * Skips the API request for start notifications or when no token is provided.
 * API failures produce a warning and an empty duration.
 *
 * @returns {Promise<string>} The elapsed-time label, or an empty string when unavailable.
 */
async function getElapsedTime() {
  let duration = "";
  if (process.env.GH_TOKEN && process.env.NOTIFICATION_STATUS !== "started") {
    try {
      const url = `${process.env.API_URL}/repos/${REPOSITORY}/actions/runs/${process.env.RUN_ID}/attempts/${process.env.RUN_ATTEMPT}`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${process.env.GH_TOKEN}`,
          Accept: "application/vnd.github+json",
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error("Run metadata unavailable");
      }

      const run = await response.json();
      const startedAt = Date.parse(run.run_started_at);

      if (!Number.isFinite(startedAt)) {
        throw new Error("Run start time unavailable");
      }

      const seconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
      duration = `Elapsed: ${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    } catch {
      console.log("::warning::Unable to fetch workflow elapsed time; posting without it.");
    }
  }
  return duration;
}

/**
 * Builds the Slack message with status colors, links, and nonempty optional sections.
 *
 * @param {string} duration - Elapsed-time label, or an empty string to omit it.
 * @returns {object} The chat.postMessage payload, without authentication credentials.
 */
function createNotificationPayload(duration) {
  const status = process.env.NOTIFICATION_STATUS;
  const statuses = {
    success: { color: "#2DA44E", label: "Succeeded" },
    failure: { color: "#CF222E", label: "Failed" },
    cancelled: { color: "#BF8700", label: "Cancelled" },
    started: { color: "#359FA3", label: "Started" },
    skipped: { color: "#808080", label: "Skipped" },
  };

  const presentation = Object.hasOwn(statuses, status)
    ? statuses[status]
    : { color: "#808080", label: status };

  const headline = `*${escapeLabel(presentation.label)}* · <${process.env.RUN_URL}|${escapeLabel(process.env.WORKFLOW_NAME)} #${process.env.RUN_NUMBER}>`;
  const metadata =
    status === "started"
      ? `Trigger: ${escapeLabel(process.env.EVENT_NAME)} | Attempt ${process.env.RUN_ATTEMPT} | ${links.actor}`
      : [duration, `Attempt ${process.env.RUN_ATTEMPT}`].filter(Boolean).join(" | ");
  const fallbackMetadata =
    status === "started"
      ? `Trigger: ${process.env.EVENT_NAME} | Attempt ${process.env.RUN_ATTEMPT} | By ${ACTOR}`
      : metadata;
  const blocks = [
    {
      type: "section",
      text: { type: "mrkdwn", text: headline },
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: `${links.ref} | ${links.commit}\n${metadata}` },
    },
  ];

  let message = process.env.MESSAGE;
  let publishedImage = "";
  if (process.env.IMAGE_REF) {
    const [imageName, digest] = process.env.IMAGE_REF.split("@");
    const registrySeparator = imageName.indexOf("/");
    const imageDetails = [
      "Published image",
      `ACR: ${imageName.slice(0, registrySeparator)}`,
      `Image: ${imageName.slice(registrySeparator + 1)}`,
    ];
    if (message?.startsWith("Pushed image tags:\n")) {
      const tagLines = message.slice("Pushed image tags:\n".length).split("\n");
      const prefix = `- ${imageName}:`;
      if (tagLines.every((line) => line.startsWith(prefix) && line.length > prefix.length)) {
        imageDetails.push(`Tags: ${tagLines.map((line) => line.slice(prefix.length)).join(", ")}`);
        message = "";
      }
    }
    imageDetails.push(`Digest: ${digest}`);
    publishedImage = imageDetails.join("\n");
  }
  for (const text of [links.failures, message, publishedImage]) {
    if (!text) continue;
    blocks.push({
      type: "section",
      text: { type: "plain_text", text },
    });
  }

  return {
    channel: process.env.SLACK_CHANNEL_ID,
    ...(process.env.THREAD_TS ? { thread_ts: process.env.THREAD_TS, reply_broadcast: true } : {}),
    text: [
      `${presentation.label} · ${process.env.WORKFLOW_NAME} #${process.env.RUN_NUMBER}`,
      `${REPOSITORY} | Ref: ${REF_NAME} | Commit: ${commitSha.slice(0, 8)}`,
      fallbackMetadata,
      links.failures,
      message,
      publishedImage,
      process.env.RUN_URL,
    ]
      .filter(Boolean)
      .join("\n"),
    attachments: [{ color: presentation.color, blocks }],
  };
}

const duration = await getElapsedTime();
const payload = createNotificationPayload(duration);
fs.appendFileSync(process.env.GITHUB_OUTPUT, `payload=${JSON.stringify(payload)}\n`);
