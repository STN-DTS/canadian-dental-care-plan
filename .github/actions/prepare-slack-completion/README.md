# Prepare Slack Completion

Builds JSON Slack `chat.postMessage` payloads for requested and completed workflow runs.
This action does not fetch Vault secrets, send Slack messages, download artifacts,
or maintain external message state. Slack metadata correlates completion replies
with their queued messages; authentication and delivery belong to the caller.

## Requirements

- Invoke from a `workflow_run` workflow with `types: [requested, completed]`.
- Check out the repository so the local action is available. Use trusted
  default-branch code, not the originating run's branch or commit.
- Provide Bash and Node.js 24. The action does not install Node.js.
- Grant `contents: read` for checkout and `actions: read` for artifact lookup.
- Allow outbound access to GitHub's API and Slack's API.

The script reads the originating run from `GITHUB_EVENT_PATH` and uses
`GITHUB_SERVER_URL`, `GITHUB_API_URL`, and `GITHUB_OUTPUT` supplied by the runner.
It does not use the notification workflow's own run number, commit, or conclusion.

## Inputs And Output

| Input          | Required | Purpose                                                    |
| -------------- | -------- | ---------------------------------------------------------- |
| `channel-id`   | Yes      | Destination Slack channel ID                               |
| `github-token` | Yes      | GitHub token with `actions: read` for listing artifacts    |
| `slack-token`  | No       | Bot token with history access for locating queued messages |

Output `payload` is a single-line JSON string suitable for Slack's official
action. It contains no authentication credentials. The caller should validate
that the channel ID is nonblank before invoking this action.

## Usage

After trusted checkout and Node.js setup:

```yaml
- name: Prepare workflow notification
  id: message
  uses: ./.github/actions/prepare-slack-completion
  with:
    channel-id: ${{ vars.SLACK_CHANNEL_ID }}
    github-token: ${{ github.token }}
    slack-token: ${{ steps.vault.outputs.SLACK_BOT_TOKEN }}

  - name: Post workflow notification
  uses: slackapi/slack-github-action@dcb1066f776dd043e64d0e8ba94ca15cc7e1875d # v4.0.0
  with:
    method: chat.postMessage
    token: ${{ steps.vault.outputs.SLACK_BOT_TOKEN }}
    errors: true
    payload: ${{ steps.message.outputs.payload }}
```

The example assumes a preceding Vault step provides `SLACK_BOT_TOKEN`. The bot
needs `chat:write` and membership in the destination channel. For threading,
configure `channels:history` for public channels or `groups:history` for private
channels, plus `metadata.message:read`. Reinstall the app after changing scopes.
Register the `cdcp_workflow_run` metadata schema in the Slack app manifest:

```yaml
metadata:
  event_subscriptions:
    - event_type: cdcp_workflow_run
      schema:
        type: object
        properties:
          repository: { type: string }
          run_id: { type: string }
          run_attempt: { type: string }
          action: { type: string, enum: [requested, completed] }
        required: [repository, run_id, run_attempt, action]
```

No metadata event receiver or interactivity endpoint is required; lookup uses
`conversations.history`. Metadata is visible to channel members and other apps;
never include credentials. See [Slack metadata documentation](https://docs.slack.dev/messaging/message-metadata/).

See [Post workflow updates to Slack](../../workflows/notify-slack-workflow-updates.yaml)
for runtime setup, Vault authentication, repository guards, and workflow exclusions.
That workflow must exist on the default branch to receive these events.

## Threaded Notifications

Requested events create blue **Queued** messages without duration or artifact lookup.
Both phases attach `cdcp_workflow_run` metadata containing the repository, run ID,
attempt, and action. Completion verifies the token's user ID with `auth.test`,
then searches channel history with `include_all_metadata=true` for a requested
parent posted by that user with matching run metadata. `auth.test` needs no extra scopes.
The payload sets
`thread_ts` and `reply_broadcast: true` so the result appears in the thread and channel.

History lookup scans at most ten pages of 100 messages with ten-second request
timeouts. When available, the source run's creation time bounds the search with
a sixty-second clock-skew allowance. Internal Slack apps use Tier 3 history limits;
non-Marketplace commercially distributed apps may face stricter limits.

Unverified bot identity, missing parents, insufficient scopes, rate limits,
malformed responses, or lookup failures preserve a standalone completion message.
This includes reruns, because
GitHub does not emit `requested` again, and fast workflows whose queued message
has not been posted yet. Different runs and attempts never share a thread.
Retrying a notifier can post duplicates; metadata lookup does not make posting atomic.

## Message Content

- A headline linking the workflow name and run number to the specific attempt,
  followed by the bold result separated by a simple hyphen.
- A colored attachment with a sentence describing the repository, trigger, ref,
  commit link, actor profile link, attempt, and available duration.
- Inline code for ref, attempt, and trigger; escaped labels for Slack links.
- Duration uses `updated_at - run_started_at` from the source run's completion
  event, formatted as `4m 12s` or `1h 2m 3s`. It measures elapsed time, including
  waits between jobs, not summed job execution or billable time. It excludes
  notification delay and is omitted when timestamps are missing or invalid.
- Actor selection prefers `triggering_actor`, then the original `actor`.
  A missing ref is displayed as `Unknown`.
- Plain-text attachment fallback and disabled link/media unfurling.

Queued is blue. Success is green; failure, timeout, and startup failure are red; cancellation and
action-required results are amber. Skipped, neutral, stale, and unknown results
are gray. The action prepares all completion results; selection is the caller's policy.

## Example Output

Illustrative message for a successful run with two retained artifacts:

Workflow **[Build, test, and publish nonprod images #41](https://github.com/org/repo/actions/runs/123/attempts/2)** - **Succeeded**

> In _org/repo_, triggered by `push` on `release/v7.3.4` at commit [abcdef12](https://github.com/org/repo/commit/abcdef1234567890) by [dependabot\[bot\]](https://github.com/dependabot%5Bbot%5D) (attempt `2`, duration `4m 12s`).
>
> [2 artifacts](https://github.com/org/repo/actions/runs/123#artifacts)

Slack displays a green bar beside the attachment for this success result.
The artifact link is omitted when no retained artifacts exist.

## Artifact Links

For completed events, the action lists artifacts for the originating run, excluding expired artifacts.
It counts all retained artifacts across up to ten pages of 100 artifacts.
Each request has a ten-second timeout. If the pagination limit prevents a complete
count, the action emits a warning and omits the artifact link.

The attachment shows one link to the workflow run's `#artifacts` section, labeled with the retained
artifact count, such as `1 artifact` or `12 artifacts`. Individual artifact names
and links are not included. GitHub authentication and repository access are still
required to download artifacts from the run.

Artifact listing is run-wide: reruns may include reports uploaded by previous
attempts. The action does not create coverage or E2E reports; source workflows
must upload them first. If no retained artifacts exist, the section is omitted.
Lookup or formatting failures emit a generic warning and preserve the completion
message without artifact links. Invalid event data or output-write errors still
fail preparation; live Slack delivery is handled separately.

## Development

The script exposes `buildPayload(event, options)` for tests. Rendering, history lookup,
and artifact fetching are separate helpers; `options.fetch` and `options.warn` allow tests to
replace network calls and capture warnings without credentials.

Run from the repository root:

```sh
node --test .github/actions/prepare-slack-completion/prepare-payload.test.mjs
```

Tests cover result labels and colors, escaping, links, actor/ref fallbacks,
queued rendering, metadata matching, broadcast replies, artifact counts,
pagination limits, expiration, empty results, and API failures.
They require no npm packages, Vault access, or Slack token. They do not verify
live Slack rendering or delivery.
