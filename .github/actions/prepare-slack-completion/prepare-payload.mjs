/** @file Builds completion messages; does not access Vault or send Slack messages. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** @param {string} value Slack label. @returns {string} Escaped label. */
function escape(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\|/g, "&#124;");
}

/** @param {string} value Code value. @returns {string} Escaped inline code. */
function inlineCode(value) {
  return `\`${escape(value).replace(/`/g, "&#96;")}\``;
}

/**
 * Adds retained artifact links without exceeding Slack's section text limit.
 * @param {object} attachment Completion attachment.
 * @param {object[]} artifacts API artifact objects.
 * @param {object} run Originating run.
 * @param {string} repository Repository full name.
 * @param {string} serverUrl GitHub browser origin.
 */
function addArtifacts(attachment, artifacts, run, repository, serverUrl) {
  if (!artifacts.length) return;
  const footer = `\n<${run.html_url}|View artifacts in workflow run>`;
  let text = "*Artifacts*";
  if (text.length + footer.length > 3000) throw new Error("Artifact summary link is too long");
  const displayed = [];
  for (const artifact of artifacts.slice(0, 10)) {
    const url = `${serverUrl}/${repository}/actions/runs/${encodeURIComponent(run.id)}/artifacts/${encodeURIComponent(artifact.id)}`;
    const name = artifact.name.length > 150 ? `${artifact.name.slice(0, 147)}...` : artifact.name;
    const line = `\n- <${url}|${escape(name)}>`;
    if (text.length + line.length + footer.length > 3000) break;
    text += line;
    displayed.push(`${name}: ${url}`);
  }
  attachment.blocks.push({ type: "section", text: { type: "mrkdwn", text: text + footer } });
  attachment.fallback += `\nArtifacts:\n${displayed.join("\n")}\nView artifacts in workflow run: ${run.html_url}`;
}

/**
 * Builds the colored result attachment and source-run fields.
 * @param {object} run Originating workflow run.
 * @param {string} repository Repository full name.
 * @param {string} serverUrl GitHub browser origin.
 * @returns {object} Slack attachment with plain-text fallback.
 */
function createResultAttachment(run, repository, serverUrl) {
  const actor = run.triggering_actor?.login || run.actor.login;
  const ref = run.head_branch ?? "Unknown";
  const attempt = String(run.run_attempt);
  const results = {
    success: ["Succeeded", "#2DA44E"],
    failure: ["Failed", "#CF222E"],
    timed_out: ["Timed out", "#CF222E"],
    startup_failure: ["Startup failed", "#CF222E"],
    cancelled: ["Cancelled", "#BF8700"],
    action_required: ["Action required", "#BF8700"],
    skipped: ["Skipped", "#808080"],
    neutral: ["Neutral", "#808080"],
    stale: ["Stale", "#808080"],
  };
  const [label, color] = Object.hasOwn(results, run.conclusion)
    ? results[run.conclusion]
    : [run.conclusion || "Unknown", "#808080"];
  return {
    color,
    fallback: `Result: ${label} | ${repository} | Ref: ${ref} | Attempt ${attempt} | Commit: ${run.head_sha.slice(0, 8)} | Actor: ${actor} | Trigger: ${run.event}`,
    blocks: [
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Result: ${escape(label)}*` },
          { type: "mrkdwn", text: `Ref: ${inlineCode(ref)}` },
          { type: "plain_text", text: `Repository: ${repository}` },
          { type: "mrkdwn", text: `Attempt: ${inlineCode(attempt)}` },
          {
            type: "mrkdwn",
            text: `Commit: <${serverUrl}/${repository}/commit/${encodeURIComponent(run.head_sha)}|${escape(run.head_sha.slice(0, 8))}>`,
          },
          {
            type: "mrkdwn",
            text: `Actor: <${serverUrl}/${encodeURIComponent(actor)}|${escape(actor)}>`,
          },
          { type: "mrkdwn", text: `Trigger: ${inlineCode(run.event)}` },
        ],
      },
    ],
  };
}

/**
 * Creates the headline and result details without performing network requests.
 * @param {object} event GitHub workflow_run webhook payload.
 * @param {{channelId: string, serverUrl: string}} options Rendering configuration.
 * @returns {object} Slack completion payload.
 */
function createCompletionPayload(event, options) {
  const run = event.workflow_run;
  const url = new URL(run.html_url);
  url.pathname = `${url.pathname.replace(/\/$/, "")}/attempts/${encodeURIComponent(String(run.run_attempt))}`;
  return {
    channel: options.channelId,
    text: `Workflow *<${url.href}|${escape(run.name)} #${escape(String(run.run_number))}>* completed`,
    attachments: [createResultAttachment(run, event.repository.full_name, options.serverUrl)],
    unfurl_links: false,
    unfurl_media: false,
  };
}

/**
 * Lists retained artifacts with bounded pagination and request timeouts.
 * @param {object} run Originating workflow run.
 * @param {string} repository Repository full name.
 * @param {{apiUrl: string, token: string, fetch?: typeof globalThis.fetch}} options API configuration.
 * @returns {Promise<object[]>} Non-expired artifact objects.
 */
async function fetchArtifacts(run, repository, options) {
  const artifacts = [];
  for (let page = 1; page <= 10 && artifacts.length < 10; page++) {
    const endpoint = new URL(
      `${options.apiUrl}/repos/${repository}/actions/runs/${run.id}/artifacts`,
    );
    endpoint.searchParams.set("per_page", "100");
    endpoint.searchParams.set("page", String(page));
    const response = await (options.fetch ?? globalThis.fetch)(endpoint, {
      headers: {
        Authorization: `Bearer ${options.token}`,
        Accept: "application/vnd.github+json",
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error("Artifacts unavailable");
    const data = await response.json();
    artifacts.push(...data.artifacts.filter((artifact) => !artifact.expired));
    if (data.artifacts.length < 100) break;
  }
  return artifacts;
}

/**
 * Creates a payload; artifact lookup failures leave the completion details intact.
 * @param {object} event GitHub workflow_run webhook payload.
 * @param {{channelId: string, token: string, serverUrl: string, apiUrl: string, fetch?: typeof globalThis.fetch, warn?: (message: string) => void}} options Runtime configuration and test dependencies.
 * @returns {Promise<object>} Slack payload without tokens.
 */
export async function buildPayload(event, options) {
  const payload = createCompletionPayload(event, options);
  const run = event.workflow_run;
  const repository = event.repository.full_name;
  try {
    const artifacts = await fetchArtifacts(run, repository, options);
    addArtifacts(payload.attachments[0], artifacts, run, repository, options.serverUrl);
  } catch {
    (options.warn ?? console.log)(
      "::warning::Unable to list workflow artifacts; posting completion without artifact links.",
    );
  }
  return payload;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"));
  const payload = await buildPayload(event, {
    channelId: process.env.SLACK_CHANNEL_ID,
    token: process.env.GH_TOKEN,
    serverUrl: process.env.GITHUB_SERVER_URL,
    apiUrl: process.env.GITHUB_API_URL,
  });
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `payload=${JSON.stringify(payload)}\n`);
}
