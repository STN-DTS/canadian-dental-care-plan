/** @file Builds requested/completed workflow messages; does not access Vault or send Slack messages. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** @param {string} value Slack label. @returns {string} Escaped label. */
function escape(value) {
  return value //
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\|/g, '&#124;');
}

/** @param {string} value Code value. @returns {string} Escaped inline code. */
function inlineCode(value) {
  return `\`${escape(value).replace(/`/g, '&#96;')}\``;
}

/**
 * Adds one workflow-run link labeled with the retained artifact count.
 * @param {object} attachment Completion attachment.
 * @param {number} count Non-expired artifact count.
 * @param {object} run Originating run.
 */
function addArtifacts(attachment, count, run) {
  if (!count) return;
  const label = `${count} ${count === 1 ? 'artifact' : 'artifacts'}`;
  const url = new URL(run.html_url);
  url.hash = 'artifacts';
  const text = `<${url.href}|${label}>`;
  attachment.blocks.push({ type: 'section', text: { type: 'mrkdwn', text } });
  attachment.fallback += `\n${label}: ${url.href}`;
}

/**
 * Maps a workflow event and conclusion to its display label and attachment color.
 * @param {string} conclusion Workflow conclusion.
 * @param {string} action Workflow event action.
 * @returns {string[]} Label and color.
 */
function resultPresentation(conclusion, action) {
  if (action === 'requested') return ['Queued', '#0969DA'];
  const results = {
    success: ['Succeeded', '#2DA44E'],
    failure: ['Failed', '#CF222E'],
    timed_out: ['Timed out', '#CF222E'],
    startup_failure: ['Startup failed', '#CF222E'],
    cancelled: ['Cancelled', '#BF8700'],
    action_required: ['Action required', '#BF8700'],
    skipped: ['Skipped', '#808080'],
    neutral: ['Neutral', '#808080'],
    stale: ['Stale', '#808080'],
  };
  return Object.hasOwn(results, conclusion) ? results[conclusion] : [conclusion || 'Unknown', '#808080'];
}

/**
 * Formats elapsed source-run time from the completion event's timestamps.
 * @param {object} run Originating workflow run.
 * @returns {string | null} Duration, or null when timestamps are unavailable or invalid.
 */
function runDuration(run) {
  const elapsed = Date.parse(run.updated_at) - Date.parse(run.run_started_at);
  if (!Number.isFinite(elapsed) || elapsed < 0) return null;
  const totalSeconds = Math.floor(elapsed / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours ? `${hours}h` : null, hours || minutes ? `${minutes}m` : null, `${seconds}s`].filter((part) => part !== null).join(' ');
}

/**
 * Builds a colored attachment with source-run context in one sentence.
 * @param {object} run Originating workflow run.
 * @param {string} repository Repository full name.
 * @param {string} serverUrl GitHub browser origin.
 * @param {string} action Workflow event action.
 * @returns {object} Slack attachment with plain-text fallback.
 */
function createResultAttachment(run, repository, serverUrl, action) {
  const actor = run.triggering_actor?.login ?? run.actor.login;
  const ref = run.head_branch ?? 'Unknown';
  const attempt = String(run.run_attempt);
  const duration = action === 'requested' ? null : runDuration(run);
  const [label, color] = resultPresentation(run.conclusion, action);
  return {
    color,
    fallback: `Result: ${label} | ${repository} | Ref: ${ref} | Attempt ${attempt} | Commit: ${run.head_sha.slice(0, 8)} | Actor: ${actor} | Trigger: ${run.event}${duration === null ? '' : ` | Duration: ${duration}`}`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `In _${escape(repository)}_, triggered by ${inlineCode(run.event)} on ${inlineCode(ref)} at commit <${serverUrl}/${repository}/commit/${encodeURIComponent(run.head_sha)}|${escape(run.head_sha.slice(0, 8))}> by <${serverUrl}/${encodeURIComponent(actor)}|${escape(actor)}> (attempt ${inlineCode(attempt)}${duration === null ? '' : `, duration ${inlineCode(duration)}`}).`,
        },
      },
    ],
  };
}

/**
 * Creates the headline and result details without performing network requests.
 * @param {object} event GitHub workflow_run webhook payload.
 * @param {{channelId: string, serverUrl: string}} options Rendering configuration.
 * @returns {object} Slack workflow notification payload.
 */
function createCompletionPayload(event, options) {
  const run = event.workflow_run;
  const [label] = resultPresentation(run.conclusion, event.action);
  const url = new URL(run.html_url);
  url.pathname = `${url.pathname.replace(/\/$/, '')}/attempts/${encodeURIComponent(String(run.run_attempt))}`;
  return {
    channel: options.channelId,
    text: `Workflow *<${url.href}|${escape(run.name)} #${escape(String(run.run_number))}>* - *${escape(label)}*`,
    attachments: [createResultAttachment(run, event.repository.full_name, options.serverUrl, event.action)],
    metadata: {
      event_type: 'cdcp_workflow_run',
      event_payload: {
        repository: event.repository.full_name,
        run_id: String(run.id),
        run_attempt: String(run.run_attempt),
        action: event.action ?? 'completed',
      },
    },
    unfurl_links: false,
    unfurl_media: false,
  };
}

/**
 * Counts retained artifacts with bounded pagination and request timeouts.
 * @param {object} run Originating workflow run.
 * @param {string} repository Repository full name.
 * @param {{apiUrl: string, token: string, fetch?: typeof globalThis.fetch}} options API configuration.
 * @returns {Promise<number>} Non-expired artifact count.
 */
async function fetchArtifactCount(run, repository, options) {
  async function fetchPage(page, count) {
    const endpoint = new URL(`${options.apiUrl}/repos/${repository}/actions/runs/${run.id}/artifacts`);
    endpoint.searchParams.set('per_page', '100');
    endpoint.searchParams.set('page', String(page));
    const response = await (options.fetch ?? globalThis.fetch)(endpoint, {
      headers: {
        Authorization: `Bearer ${options.token}`,
        Accept: 'application/vnd.github+json',
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error('Artifacts unavailable');
    const data = await response.json();
    const retained = count + data.artifacts.filter((artifact) => !artifact.expired).length;
    if (data.artifacts.length < 100 || page * 100 >= data.total_count) return retained;
    if (page === 10) throw new Error('Artifact count exceeds pagination limit');
    return await fetchPage(page + 1, retained);
  }
  return await fetchPage(1, 0);
}

/**
 * Finds a queued parent by repository, run ID, and attempt in bounded Slack history.
 * @param {object} run Originating workflow run; created_at bounds history when valid.
 * @param {string} repository Repository full name.
 * @param {{channelId: string, slackToken: string, fetch?: typeof globalThis.fetch}} options Slack API configuration.
 * @returns {Promise<string | null>} Parent message timestamp, or null when no match exists.
 * @throws {Error} When history is unavailable, malformed, or exceeds ten pages.
 */
async function findQueueMessage(run, repository, options) {
  const createdAt = Date.parse(run.created_at);
  async function fetchPage(page, cursor) {
    const endpoint = new URL('https://slack.com/api/conversations.history');
    endpoint.searchParams.set('channel', options.channelId);
    endpoint.searchParams.set('include_all_metadata', 'true');
    endpoint.searchParams.set('limit', '100');
    if (Number.isFinite(createdAt)) endpoint.searchParams.set('oldest', String(Math.max(0, Math.floor(createdAt / 1000) - 60)));
    if (cursor) endpoint.searchParams.set('cursor', cursor);
    const response = await (options.fetch ?? globalThis.fetch)(endpoint, {
      headers: { Authorization: `Bearer ${options.slackToken}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error('Slack history unavailable');
    const data = await response.json();
    if (!data.ok || !Array.isArray(data.messages)) throw new Error('Slack history unavailable');
    const message = data.messages.find((message) => {
      const metadata = message.metadata;
      const context = metadata?.event_payload;
      return (
        metadata?.event_type === 'cdcp_workflow_run' &&
        context?.action === 'requested' &&
        context.repository === repository &&
        context.run_id === String(run.id) &&
        context.run_attempt === String(run.run_attempt) &&
        (!message.thread_ts || message.thread_ts === message.ts) &&
        typeof message.ts === 'string' &&
        /^\d+\.\d+$/.test(message.ts)
      );
    });
    if (message) return message.ts;
    const nextCursor = data.response_metadata?.next_cursor?.trim() ?? '';
    if (!nextCursor) {
      if (data.has_more) throw new Error('Slack history pagination unavailable');
      return null;
    }
    if (page === 10) throw new Error('Slack history exceeds pagination limit');
    return await fetchPage(page + 1, nextCursor);
  }
  return await fetchPage(1, '');
}

/**
 * Creates a payload; lookup failures preserve a standalone completion notification.
 * @param {object} event GitHub workflow_run webhook payload.
 * @param {{channelId: string, token: string, serverUrl: string, apiUrl: string, slackToken?: string, fetch?: typeof globalThis.fetch, warn?: (message: string) => void}} options Runtime configuration and test dependencies.
 * @returns {Promise<object>} Slack payload without tokens.
 */
export async function buildPayload(event, options) {
  const payload = createCompletionPayload(event, options);
  if (event.action === 'requested') return payload;
  const run = event.workflow_run;
  const repository = event.repository.full_name;
  if (options.slackToken) {
    try {
      const threadTs = await findQueueMessage(run, repository, options);
      if (threadTs) {
        payload.thread_ts = threadTs;
        payload.reply_broadcast = true;
      }
    } catch {
      (options.warn ?? console.log)('::warning::Unable to find queued Slack message; posting completion as a standalone message.');
    }
  }
  try {
    const count = await fetchArtifactCount(run, repository, options);
    addArtifacts(payload.attachments[0], count, run);
  } catch {
    (options.warn ?? console.log)('::warning::Unable to list workflow artifacts; posting completion without artifact links.');
  }
  return payload;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
  const payload = await buildPayload(event, {
    channelId: process.env.SLACK_CHANNEL_ID,
    token: process.env.GH_TOKEN,
    slackToken: process.env.SLACK_BOT_TOKEN,
    serverUrl: process.env.GITHUB_SERVER_URL,
    apiUrl: process.env.GITHUB_API_URL,
  });
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `payload=${JSON.stringify(payload)}\n`);
}
