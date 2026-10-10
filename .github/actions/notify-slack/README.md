# Slack Notifications

This composite action sends STN-DTS workflow notifications through Slack's
official GitHub Action. It authenticates with a bot token fetched from Vault.

The repository's notifications are centralized in
[notify-workflow-run.yaml](../../workflows/notify-workflow-run.yaml). Build workflows
do not call this action directly. The notifier posts standalone start and completion
messages without image metadata, artifact exchange, or thread timestamp storage.

## How It Works

1. `action.yaml` rejects a blank channel ID, ensures Node.js runtime libraries,
   sets up Node.js, and fetches the Slack bot token using Vault AppRole authentication.
2. The notifier passes metadata from `github.event.workflow_run`, not its own run.
   `prepare-workflow-run.mjs` fetches failed jobs for completed non-successful runs,
   using the originating run ID and attempt. API failures warn and omit job details.
3. `prepare-notification.mjs` reads the supplied environment variables and prepares
   links and failure details without querying GitHub's API.
4. The script builds a JavaScript object and exports it as JSON in the `payload`
   step output. It does not send messages or include authentication tokens in
   the payload.
5. Slack's official action calls `chat.postMessage` with that payload and the
   Vault token. The composite action returns the posted message timestamp as `ts`.

## Message Content

- One status-first headline above the colored attachment, linking the workflow
  name and run number to the run. Top-level `blocks` contain the headline;
  attachment blocks contain only metadata and result details.
- Linked branch/tag and exact source commit on one line.
- Standalone start and completion notifications include trigger, attempt number,
  and an actor link.
- Failed jobs retrieved from the originating workflow run attempt, without
  workflow-specific job-name exclusions.

Trigger names and failed-job names use inline code. Ref, commit, actor, and
workflow labels remain ordinary clickable links. Attachment fallback text stays plain.

The builder accepts only run metadata and API-derived job results. Custom messages,
container registries, image tags, digests, and Slack thread timestamps are not supported.

The repository remains in the attachment fallback text and GitHub link destinations.
Messages keep ref and commit so each announcement retains source context.
The attachment's `fallback` includes run metadata and failed jobs for clients
that cannot render its blocks. Top-level `text` is omitted to avoid a second
visible summary.

Success is green, failure red, cancellation amber, start teal, and other statuses
gray. Empty optional sections are omitted.

The workflow-run link uses ordinary Slack mrkdwn. It does not require an
interactivity endpoint. Slack URL buttons still send interaction payloads and
require an acknowledgement handler, so this action does not use buttons.

## Setup

1. Open the existing STN-DTS Notifications app in Slack's app dashboard.
2. Under **OAuth & Permissions**, add the bot scope `chat:write` and reinstall the
   app to the workspace. Obtain the **Bot User OAuth Token** (`xoxb-...`).
3. Store the token in Vault at API path
   `canada-dental-care-plan/data/shared/cicd/slack`, field `SLACK_BOT_TOKEN`.
   The Vault UI path is `shared/cicd/slack` under the `canada-dental-care-plan`
   KV v2 secrets engine. The location is fixed in this action.
4. Grant the CI AppRole read access to that API path. Keep the AppRole credentials
   in GitHub secrets `VAULT_URL_NONPROD`, `VAULT_ROLE_ID_NONPROD`, and
   `VAULT_SECRET_ID_NONPROD`.
5. Invite the app to the destination Slack channel. Copy the channel ID from
   channel details and set GitHub Actions repository variable `SLACK_CHANNEL_ID`.
6. Use a Debian/Ubuntu Linux runner with Bash and connectivity to Vault, Slack,
   GitHub's API, the Node.js download service, and package repositories. If
   `libatomic.so.1` is missing, the action installs `libatomic1` using passwordless
   `sudo -n`. Alternatively, include this library in the runner image.
   The action sets up Node.js 26.10.0 before preparing the payload; Node does not
   need to be preinstalled on the runner.
   Existing notification jobs use `arc-runners-dshp-dev`.

Never put tokens or AppRole secret values in source control or chat. The action
uses `exportEnv: false` and `exportToken: false`; the Slack token is not exposed
as a composite-action output. Existing TeamCity webhooks can remain unchanged.

## Inputs and Outputs

| Input             | Required | Behavior                                                      |
| ----------------- | -------- | ------------------------------------------------------------- |
| `vault-url`       | Yes      | Vault server URL                                              |
| `vault-role-id`   | Yes      | AppRole role ID                                               |
| `vault-secret-id` | Yes      | AppRole secret ID                                             |
| `channel-id`      | Yes      | Destination channel ID; blank values fail before Vault access |
| `status`          | Yes      | `started`, `success`, `failure`, `cancelled`, or `skipped`    |
| `job-results`     | No       | JSON run-attempt job results; defaults to `{}`                |
| `workflow-name`   | No       | Defaults to `github.workflow`                                 |
| `run-url`         | No       | Defaults to the current run URL                               |
| `ref`             | No       | Defaults to `github.ref_name`                                 |
| `commit-sha`      | No       | Defaults to `github.sha`                                      |
| `actor`           | No       | Defaults to triggering actor, then `github.actor`             |
| `event-name`      | No       | Defaults to `github.event_name`                               |
| `run-number`      | No       | Defaults to `github.run_number`                               |
| `run-attempt`     | No       | Defaults to `github.run_attempt`                              |

Output `ts` is the posted Slack message timestamp, not a credential.

## Workflow Integration

The notifier listens to `workflow_run` events for these exact workflow names:

- `Build, test, and publish nonprod images`
- `Build, test, and publish nonprod tag images`
- `Nightly e2e tests`

Add other workflow names to its `on.workflow_run.workflows` allowlist. Additional
branch, event, or conclusion conditions belong on the notifier job. No changes
to the source workflow are needed. Reusable workflow calls are reported under
the caller's workflow run name; a reusable workflow name alone does not select
an unrelated caller run.

`in_progress` posts Started; `completed` posts the originating run's conclusion.
These are separate notification runs, not a job that waits for the build.
The notifier itself is not allowlisted, preventing notification recursion.

The workflow must exist on the repository's default branch to receive these events.
It checks out only that branch with `persist-credentials: false`, never the triggering
run's code. This is important because `workflow_run` can access Vault secrets even
when the triggering run was unprivileged. Fork repositories are gated, and runs
whose `head_repository` differs from this repository are excluded before internal
runner execution. Do not execute triggering-branch code or downloaded artifacts here.

Workflow permissions default to `{}`. The notifier job grants `contents: read` for
trusted checkout and `actions: read` for the job lookup. The GitHub API token is
passed only to the metadata script, not the Slack posting action. That lookup is
paginated, uses ten-second request timeouts, and treats failed or timed-out jobs
as failures. It does not fetch artifacts or custom build outputs.

For event-driven callers, override all originating-run
metadata inputs shown in the notifier workflow so links and labels do not describe
the notification run instead.

## Behavior

- Start and completion are separate standalone posts. Completion does not depend
  on successful start delivery. No thread timestamp is persisted or reused.
- Event delivery and runner scheduling can delay announcements; there is no
  cross-run ordering guarantee for very short workflows.
- Notification jobs use `continue-on-error: true`. Delivery errors remain visible
  in logs but do not fail the build/test workflow.
- Elapsed time is intentionally omitted: notification preparation adds overhead
  and cannot report the final workflow duration. Use the workflow-run link for timing.
- Image metadata is not included by the generic notifier; use the workflow run's
  summaries and artifacts.
- Cancellation notifications use the originating run's completed event, but
  notification delivery remains best-effort.

## Verify Delivery

1. Publish the action and workflow changes, then trigger a new run.
2. Confirm standalone start and completion messages, status colors, and links
   to the originating run. Confirm actor, source commit, trigger, number, and attempt.
3. Check failure and rerun cases without publishing unwanted images.
4. Once delivery works, disable `/github` workflow subscriptions if they produce
   duplicate notifications. Other GitHub app subscriptions can stay enabled.

Local tests validate payload preparation, not live Slack delivery or Vault access.

## Troubleshooting

- `not_in_channel`: invite the Slack app to the destination channel.
- `missing_scope`: add `chat:write` and reinstall the Slack app.
- Vault `403`: check the AppRole's read policy for the fixed secret path.
- No events: ensure the notifier is on the default branch and the originating
  workflow name exactly matches the allowlist.
- Missing failed jobs: check the notifier's `actions: read` permission and metadata
  warning logs. The overall workflow conclusion still posts.

## Local Tests

From the repository root, run:

```sh
node --test .github/actions/notify-slack/prepare-notification.test.mjs
```

The tests execute the actual preparation script in isolated processes and detect
unexpected API requests. They cover colors, links, standalone messages,
failed-job details, job pagination, API failure handling, token exclusion, and
custom-content and elapsed-time omission. No Vault
credentials, Slack token, network access, or extra npm packages are required.
