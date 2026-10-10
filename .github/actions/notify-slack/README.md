# Slack Notifications

This composite action sends STN-DTS workflow notifications through Slack's
official GitHub Action. It authenticates with a bot token fetched from Vault.

## How It Works

1. `action.yaml` rejects a blank channel ID, ensures Node.js runtime libraries,
   sets up Node.js, and fetches the Slack bot token using Vault AppRole authentication.
2. `prepare-notification.mjs` reads the supplied environment variables, prepares
   links and failure details without querying GitHub's API.
3. The script builds a JavaScript object and exports it as JSON in the `payload`
   step output. It does not send messages or include authentication tokens in
   the payload.
4. Slack's official action calls `chat.postMessage` with that payload and the
   Vault token. The composite action returns the posted message timestamp as `ts`.

## Message Content

- One status-first headline above the colored attachment, linking the workflow
  name and run number to the run. Top-level `blocks` contain the headline;
  attachment blocks contain only metadata and result details.
- Linked branch/tag and exact source commit on one line.
- Start notifications include trigger, attempt number, and an actor link.
- Completion replies include attempt number;
  actor and trigger remain in the parent start message.
- Optional plain-text message, including pushed-image lists after partial publication.
- Every failed build/test dependency supplied by the caller.
- Published-image section with destination ACR, image path, and full digest,
  derived from the optional `image-ref` input. Matching pushed tags appear as
  comma-separated short tag names on a `Tags:` line, without repeating the registry
  and image path.
  The section uses Slack `mrkdwn` with bold headings and inline-code identifiers;
  its fallback remains plain text.

The repository remains in the attachment fallback text and GitHub link destinations.
Completion replies keep ref and commit so channel broadcasts retain source context.
The attachment's `fallback` includes failures and published-image details for clients
that cannot render its blocks. Top-level `text` is omitted to avoid a second
visible summary. Unrecognized messages and tags for other images remain unchanged.

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
| `thread-ts`       | No       | Parent message timestamp; omitted for standalone messages     |
| `message`         | No       | Additional plain text; preserves newlines and image lists     |
| `job-results`     | No       | JSON `needs` context; defaults to `{}`                        |
| `image-ref`       | No       | Published immutable image reference                           |
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
image-ref: ${{ needs.build-frontend.outputs.published-image-ref }}
```

For E2E-only workflows, omit `image-ref`. Set completion `status` from the
build/test job results, not the notification job's own status. Failed-job details
exclude jobs whose IDs start with `notify-`, because delivery failures are not
build failures. Only direct dependencies are available in `needs`.

Grant `contents: read` for checkout. Notification jobs do not need `actions: read`
or a GitHub API token. Checkout should use `persist-credentials: false`.
Every job must depend directly on the `check-repository` fork gate. Completion
jobs use `always() && needs.check-repository.result == 'success'`.

See the complete integrations in
[the branch build](../../workflows/build-publish-main-nonprod.yaml),
[the tag build](../../workflows/build-publish-tag-nonprod.yaml), and
[nightly E2E](../../workflows/nightly-e2e.yaml).

## Behavior

- Completion posts a reply under the start message. The parent remains
  `Started`; it is not updated. Threaded replies use `reply_broadcast: true` so
  Slack also shares them in the channel. Slack controls how broadcast references
  and attachment colors render in each client and thread view.
- If start delivery fails or no timestamp is available, completion posts a new
  standalone message. A full rerun posts a new start message and thread. A partial
  rerun that does not rerun `notify-start` may reuse the earlier thread.
- Notification jobs use `continue-on-error: true`. Delivery errors remain visible
  in logs but do not fail the build/test workflow.
- Elapsed time is intentionally omitted: notification preparation adds overhead
  and cannot report the final workflow duration. Use the workflow-run link for timing.
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
- Standalone completion message: check whether the start notification succeeded
  and its timestamp reached the completion call.

## Local Tests

From the repository root, run:

```sh
node --test .github/actions/notify-slack/prepare-notification.test.mjs
```

The tests execute the actual preparation script in isolated processes and detect
unexpected API requests. They cover colors, links, threading, optional
sections, failed-job details, token exclusion, and elapsed-time omission. No Vault
credentials, Slack token, network access, or extra npm packages are required.
