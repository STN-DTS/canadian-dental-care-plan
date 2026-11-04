---
name: logging
description: |
  **WORKFLOW SKILL** - Privacy-first logging with OpenTelemetry severity, for any language or logger.
  USE FOR: add logging, review logging code, fix log levels, redact sensitive data, log exceptions, audit events, access logs.
  DO NOT USE FOR: metrics, span design, alert rules, incident response, analyzing runtime log output.
  FOR SINGLE OPERATIONS: Change one log line with the severity table below.
---

# Logging

Priority: privacy, severity, diagnostics, cost. Rules apply at every level, including DEBUG. For a single log line, apply the Rules and table and skip the workflow.

## Workflow

1. Detect the logger, the OpenTelemetry bridge, every sink, and the completion hook (the middleware or wrapper that sees each request or job finish). See [review.md](./references/review.md#detect-the-logging-path).
2. Admit only allowlisted fields. The schema owner keeps the allowlist; add a field only with its purpose, bounds, and destinations. See [sensitive-data.md](./references/sensitive-data.md).
3. Choose category and severity separately. See [severity.md](./references/severity.md).
4. Map every success return, rejection, failure return, and throw to its actual outcome and terminal owner. Emit one canonical event per unit of work on every outcome branch, success included. Without a completion hook, the handler emits it. Helpers add fields to that event or log at DEBUG, never emit standalone completion events. In your answer, name any hook that owns an exit. See [events.md](./references/events.md).
5. Send synthetic canaries shaped like SINs, emails, and tokens through every sink in a local or test environment. Check sink output, not the call site. Use production or third-party sinks only with the owner's authorization. In your answer, report each sink's result or name each unavailable sink and the gap. See [review.md](./references/review.md#minimum-gate-for-every-logging-change).

## Rules

- Never log SINs or derived forms, personal data, credentials, API keys, tokens, headers, raw session IDs, raw URLs or query strings, environment dumps, or whole objects.
- Log a safe exception type and a fixed reason code. Messages and stacks are sensitive; admit them only through the rules in [sensitive-data.md](./references/sensitive-data.md). Set `error.type` from a fixed code, never from an error's name or message.
- Every event, DEBUG included, carries `org.event.category` (`application`, `access`, `security`, `audit`) and a severity. Neither replaces the other.
- Audit and security events bypass sampling and level filters.
- The layer that handles a failure logs it once. Lower layers add context and rethrow without logging. Never invent a status for an error you rethrow.
- Fix logging without changing public signatures or business behavior.
- Use the approved structured logger and shared adapter, never console directly. The adapter keeps logging failures from failing requests. If redaction fails, drop the field, not the event.

| Outcome                                      | Severity   |
| -------------------------------------------- | ---------- |
| Final HTTP 1xx-3xx                           | INFO2 (10) |
| Other normal events, including audit success | INFO (9)   |
| Final inbound 4xx                            | WARN (13)  |
| Final inbound 5xx                            | ERROR (17) |
| Downstream 4xx caused by our request or keys | ERROR (17) |
| Other downstream failure that fails the unit | ERROR (17) |
| Retry attempt                                | DEBUG (5)  |
| Process-ending failure at the top level      | FATAL (21) |

Set severity text and number together, for example `INFO2` with 10.

## When the platform can't comply

- No FATAL: use ERROR (17) with outcome `terminated`.
- No INFO2: see [severity.md](./references/severity.md#adapt-missing-or-incorrect-levels).
- No structured fields, shared adapter, or unsampled audit route: make the safe change, report the gap, and don't claim compliance. Never relax a privacy rule to fit the platform.

## Example

Bad: `warn("Invalid body: %j", body)`, then return 400.
Good: one access event, WARN (13), with status 400 and `org.reason.code: "validation_failed"`.

## Troubleshooting

- Leak found: remove or redact the field where it is emitted, then report the field and sink without copying values.
