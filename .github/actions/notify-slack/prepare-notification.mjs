/**
 * @file Prepares GitHub metadata for the Vault-backed Slack notification action.
 * Reads workflow metadata and job results from environment variables supplied by action.yaml.
 * Writes JSON-encoded repository, ref, actor, failure, commit, and duration values to GITHUB_OUTPUT.
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
  repository: `Repository: <${repositoryUrl}|${escapeLabel(REPOSITORY)}>`,
  ref: `Ref: <${repositoryUrl}/tree/${encodeURIComponent(REF_NAME)}|${escapeLabel(REF_NAME)}>`,
  actor: `By <${SERVER_URL}/${encodeURIComponent(ACTOR)}|${escapeLabel(ACTOR)}>`,
  failures: failedJobs.length ? `Failed jobs:\n${failedJobs.join("\n")}` : "",
  commit: `Commit: <${repositoryUrl}/commit/${encodeURIComponent(commitSha)}|${escapeLabel(commitSha.slice(0, 8))}>`,
};

for (const [name, value] of Object.entries(links)) {
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${JSON.stringify(value)}\n`);
}

/**
 * Writes JSON-encoded elapsed time to GITHUB_OUTPUT for the current run attempt.
 * Skips the API request for start notifications or when no token is provided.
 * API failures produce a warning and an empty duration; output-write errors propagate.
 *
 * @returns {Promise<void>} Resolves after the duration output is written.
 */
async function writeElapsedTimeOutput() {
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
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `duration=${JSON.stringify(duration)}\n`);
}

writeElapsedTimeOutput();
