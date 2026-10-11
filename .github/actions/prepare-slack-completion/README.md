# Prepare Slack Completion

Builds a JSON Slack `chat.postMessage` payload for a completed GitHub workflow run.
This action does not fetch Vault secrets, send Slack messages, download artifacts,
or maintain message state. Authentication and delivery belong to the calling workflow.

## Requirements

- Invoke from a `workflow_run` workflow with `types: [completed]`.
- Check out the repository so the local action is available. Use trusted
  default-branch code, not the originating run's branch or commit.
- Provide Bash and Node.js 24. The action does not install Node.js.
- Grant `contents: read` for checkout and `actions: read` for artifact lookup.
- Allow outbound access to GitHub's API.

The script reads the originating run from `GITHUB_EVENT_PATH` and uses
`GITHUB_SERVER_URL`, `GITHUB_API_URL`, and `GITHUB_OUTPUT` supplied by the runner.
It does not use the notification workflow's own run number, commit, or conclusion.

## Inputs And Output

| Input          | Required | Purpose                                                 |
| -------------- | -------- | ------------------------------------------------------- |
| `channel-id`   | Yes      | Destination Slack channel ID                            |
| `github-token` | Yes      | GitHub token with `actions: read` for listing artifacts |

Output `payload` is a single-line JSON string suitable for Slack's official
action. It contains no authentication credentials. The caller should validate
that the channel ID is nonblank before invoking this action.

## Usage

After trusted checkout and Node.js setup:

```yaml
- name: Prepare completion message
  id: message
  uses: ./.github/actions/prepare-slack-completion
  with:
    channel-id: ${{ vars.SLACK_CHANNEL_ID }}
    github-token: ${{ github.token }}

- name: Post completion notification
  uses: slackapi/slack-github-action@dcb1066f776dd043e64d0e8ba94ca15cc7e1875d # v4.0.0
  with:
    method: chat.postMessage
    token: ${{ steps.vault.outputs.SLACK_BOT_TOKEN }}
    errors: true
    payload: ${{ steps.message.outputs.payload }}
```

The example assumes a preceding Vault step provides `SLACK_BOT_TOKEN`. The Slack
bot needs `chat:write` and membership in the destination channel. No history-read
scope, message metadata schema, or interactivity endpoint is needed.

See [the completion workflow](../../workflows/notify-workflow-completion.yaml)
for runtime setup, Vault authentication, repository guards, and the workflow allowlist.
That workflow must exist on the default branch to receive completion events.

## Message Content

- A headline linking the workflow name and run number to the specific attempt.
- A colored attachment with a bold result, ref, repository, attempt, commit link,
  actor profile link, and trigger.
- Inline code for ref, attempt, and trigger; escaped labels for Slack links.
- Actor selection prefers `triggering_actor`, then the original `actor`.
  A missing ref is displayed as `Unknown`.
- Plain-text attachment fallback and disabled link/media unfurling.

Success is green; failure, timeout, and startup failure are red; cancellation and
action-required results are amber. Skipped, neutral, stale, and unknown results
are gray. The action prepares all completion results; selection is the caller's policy.

## Artifact Links

The action lists artifacts for the originating run, excluding expired artifacts.
It requests up to ten pages of 100 artifacts and stops once it has at least ten
retained artifacts. Each request has a ten-second timeout.

The attachment shows at most ten links. Names are shortened to 150 characters,
and the final escaped section is limited to 3,000 characters. Links are never
split. Space is reserved for a link to the workflow run where users can view the
full artifact list. GitHub authentication and repository access are still required
to download the linked artifacts.

Artifact listing is run-wide: reruns may include reports uploaded by previous
attempts. The action does not create coverage or E2E reports; source workflows
must upload them first. If no retained artifacts exist, the section is omitted.
Lookup or formatting failures emit a generic warning and preserve the completion
message without artifact links. Invalid event data or output-write errors still
fail preparation; live Slack delivery is handled separately.

## Development

The script exposes `buildPayload(event, options)` for tests. Rendering and artifact
fetching are separate helpers; `options.fetch` and `options.warn` allow tests to
replace network calls and capture warnings without credentials.

Run from the repository root:

```sh
node --test .github/actions/prepare-slack-completion/prepare-payload.test.mjs
```

Tests cover result labels and colors, escaping, links, actor/ref fallbacks,
pagination, expiration, artifact caps, the escaped-text budget, and API failures.
They require no npm packages, Vault access, or Slack token. They do not verify
live Slack rendering or delivery.
