# Slack Notifications

This composite action sends STN-DTS workflow notifications through Slack's
official GitHub Action. It authenticates with a bot token fetched from Vault.

## How It Works

1. `action.yaml` rejects a blank channel ID and fetches the Slack bot token from
   Vault using AppRole authentication.
2. `prepare-notification.mjs` reads the supplied environment variables, prepares
   links and failure details, and optionally fetches elapsed time from GitHub.
3. The script builds a JavaScript object and exports it as JSON in the `payload`
   step output. It does not send messages or include authentication tokens in
   the payload.
4. Slack's official action calls `chat.postMessage` with that payload and the
   Vault token. The composite action returns the posted message timestamp as `ts`.

## Message Content

- Workflow name, readable status, and a status-colored left border.
- Repository, branch/tag, actor, and exact source-commit links.
- Trigger, run number, attempt number, and a workflow-run button.
- Optional message, including the publishing workflows' pushed-image lists.
- Every failed build/test dependency supplied by the caller.
- Optional immutable published image reference (`image@sha256:...`).
- Completion elapsed time when a GitHub token is supplied.

Success is green, failure red, cancellation amber, start teal, and other statuses
gray. Empty optional sections are omitted.

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
6. Use a Linux runner with Bash, Node.js, and connectivity to Vault, Slack, and
   GitHub's API. Existing notification jobs use `arc-runners-dshp-dev`.

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
| `thread-ts`       | No       | Parent message timestamp; omitted for standalone messages     |
| `message`         | No       | Additional plain text; preserves newlines and image lists     |
| `job-results`     | No       | JSON `needs` context; defaults to `{}`                        |
| `image-ref`       | No       | Published immutable image reference                           |
| `github-token`    | No       | Token with `actions: read` for completion elapsed time        |
| `workflow-name`   | No       | Defaults to `github.workflow`                                 |
| `run-url`         | No       | Defaults to the current run URL                               |
| `ref`             | No       | Defaults to `github.ref_name`                                 |
| `commit-sha`      | No       | Defaults to `github.sha`                                      |

Output `ts` is the posted Slack message timestamp, not a credential.

## Workflow Integration

Define the channel once at workflow level:

```yaml
env:
  SLACK_CHANNEL_ID: ${{ vars.SLACK_CHANNEL_ID }}
```

After checkout, post a start message:

```yaml
- name: Notify Slack of workflow start
  id: slack
  uses: ./.github/actions/notify-slack
  with:
    vault-url: ${{ secrets.VAULT_URL_NONPROD }}
    vault-role-id: ${{ secrets.VAULT_ROLE_ID_NONPROD }}
    vault-secret-id: ${{ secrets.VAULT_SECRET_ID_NONPROD }}
    channel-id: ${{ env.SLACK_CHANNEL_ID }}
    status: started
```

In the `notify-start` job, expose the start message timestamp:

```yaml
outputs:
  slack-ts: ${{ steps.slack.outputs.ts }}
```

The `notify-complete` job must directly depend on `notify-start`, the repository
gate, and every build/test job whose result it reports. Its action call uses the
same Vault and channel inputs as the start call, plus a final `status` and these
optional inputs:

```yaml
thread-ts: ${{ needs.notify-start.outputs.slack-ts }}
job-results: ${{ toJSON(needs) }}
github-token: ${{ github.token }}
image-ref: ${{ needs.build-frontend.outputs.published-image-ref }}
```

For E2E-only workflows, omit `image-ref`. Set completion `status` from the
build/test job results, not the notification job's own status. Failed-job details
exclude jobs whose IDs start with `notify-`, because delivery failures are not
build failures. Only direct dependencies are available in `needs`.

Grant `contents: read` for checkout and `actions: read` to completion jobs that
request elapsed time. Checkout should use `persist-credentials: false`.
Every job must depend directly on the `check-repository` fork gate. Completion
jobs use `always() && needs.check-repository.result == 'success'`.

See the complete integrations in
[the branch build](../../workflows/build-publish-main-nonprod.yaml),
[the tag build](../../workflows/build-publish-tag-nonprod.yaml), and
[nightly E2E](../../workflows/nightly-e2e.yaml).

## Behavior

- Completion posts a reply under the start message. The parent remains
  `Started`; it is not updated. Replies are not broadcast to the channel.
- If start delivery fails or no timestamp is available, completion posts a new
  standalone message. A full rerun posts a new start message and thread. A partial
  rerun that does not rerun `notify-start` may reuse the earlier thread.
- Notification jobs use `continue-on-error: true`. Delivery errors remain visible
  in logs but do not fail the build/test workflow.
- Elapsed time uses the current run attempt's `run_started_at` through message
  preparation. It includes queue/setup time and is not the final workflow
  duration: the notification job is still running. API requests have a ten-second
  timeout; missing metadata produces a warning and omits elapsed time.
- Pushed-image lists contain only successful pushes, including promoted aliases.
  A reported digest identifies the published artifact, not proof that signing
  or deployment succeeded; check the final result and failed jobs.
- Cancellation replies are best-effort: GitHub can stop notification jobs too.

## Verify Delivery

1. Publish the action and workflow changes, then trigger a new run.
2. Confirm the start message, completion reply, status color, and GitHub links.
   For publishing workflows, also check the pushed-image list and digest.
3. Check failure and rerun cases without publishing unwanted images.
4. Once delivery works, disable `/github` workflow subscriptions if they produce
   duplicate notifications. Other GitHub app subscriptions can stay enabled.

Local tests validate payload preparation, not live Slack delivery or Vault access.

## Troubleshooting

- `not_in_channel`: invite the Slack app to the destination channel.
- `missing_scope`: add `chat:write` and reinstall the Slack app.
- Vault `403`: check the AppRole's read policy for the fixed secret path.
- Missing elapsed time: check the completion job's `actions: read` permission and
  the preparation step's warning logs. Other message details still post.
- Standalone completion message: check whether the start notification succeeded
  and its timestamp reached the completion call.

## Local Tests

From the repository root, run:

```sh
node --test .github/actions/notify-slack/prepare-notification.test.mjs
```

The tests execute the actual preparation script in isolated processes with mocked
GitHub API responses and time. They cover colors, links, threading, optional
sections, failed-job details, token exclusion, and elapsed-time fallback. No Vault
credentials, Slack token, network access, or extra npm packages are required.
