---
name: logging
description: |
  **WORKFLOW SKILL** - Privacy-first logging with OpenTelemetry LogRecords, EventRecords, and semantic conventions, for any language or logger.
  USE FOR: add logging, review logging code, fix log levels, redact sensitive data, log exceptions, audit events, access logs.
  DO NOT USE FOR: metrics, span design, alert rules, incident response, analyzing runtime log output.
  FOR SINGLE OPERATIONS: Change one log line with the severity table below.
---

# Logging

Priority: privacy, severity, diagnostics, cost. Rules apply to both log records and event records at every level, including DEBUG and TRACE. For a single log line, classify the record, apply the Rules and table, and skip the workflow.

## Log records and event records

OpenTelemetry uses one `LogRecord` model. A log record with a non-empty native `EventName` is an `EventRecord`, not a separate telemetry signal.

- Ordinary diagnostics use log records without `EventName`. They may carry approved structured attributes and trace context.
- Named checkpoints, state changes, audit facts, and completion outcomes use event records with a stable `EventName` and a documented event schema.

Structured attributes, category, and severity do not make a log record an event record. Do not invent event names or terminal events for helper diagnostics. See [events.md](./references/events.md#log-records-and-event-records).

## Standards and application policy

Reuse OpenTelemetry native fields and applicable semantic conventions with their defined meaning, type, and stability. Use the installed semantic-conventions constants where available. Do not treat a similar name as an equivalent convention.

When no convention fits, omit unnecessary fields or document a custom field under an approved application namespace or company reverse-domain namespace. Never invent fields in OpenTelemetry namespaces, including reserved `otel.*`. See [events.md](./references/events.md#attribute-selection).

The privacy restrictions, canonical completion ownership, protected audit delivery, and exact HTTP severity choices below are application policy, not OpenTelemetry requirements. Standard attributes remain subject to privacy admission.

## Workflow

1. Detect the logger, the OpenTelemetry bridge, every sink, and the completion hook (the middleware or wrapper that sees each request or job finish). See [review.md](./references/review.md#detect-the-logging-path).
2. Admit only allowlisted fields. The schema owner keeps the allowlist; add a field only with its purpose, bounds, and destinations. See [sensitive-data.md](./references/sensitive-data.md).
3. Classify the record as an ordinary diagnostic or a named event. Choose severity from the outcome. Add a category only when an approved schema or routing policy needs it, independently of severity. See [events.md](./references/events.md#log-records-and-event-records) and [severity.md](./references/severity.md).
4. For an owned request or job, map every success return, rejection, failure return, and throw to its actual outcome and terminal owner. Emit one canonical completion event per owned unit on every outcome branch, success included. Without a completion hook, the handler emits it. Helpers add fields to that event or emit ordinary diagnostic log records, normally at DEBUG or TRACE, never duplicate completion events. A diagnostic log edit does not require a new completion event. In your answer, name any hook that owns a relevant exit. See [events.md](./references/events.md#canonical-event-ownership).
5. Send synthetic canaries shaped like SINs, emails, and tokens through every sink in a local or test environment. Check sink output, not the call site. Use production or third-party sinks only with the owner's authorization. In your answer, report each sink's result or name each unavailable sink and the gap. See [review.md](./references/review.md#minimum-gate-for-every-logging-change).

## Rules

- Never log SINs or derived forms, personal data, credentials, API keys, tokens, headers, raw session IDs, raw URLs or query strings, environment dumps, or whole objects.
- Use fixed messages and fresh allowlisted structured attributes. Do not pass splat interpolation arguments or embed serialized objects in the message. Preserve useful TRACE and DEBUG diagnostics without exporting sensitive inputs.
- Classify failures with predictable, low-cardinality `error.type`; omit it on success and expected non-error outcomes. Use a documented fixed code or an explicitly allowlisted canonical exception class, never arbitrary error names or messages. Record `exception.type` only for an actual exception with an admitted class name. Do not duplicate `error.type` in a custom reason field. Messages and stacks require admission under [sensitive-data.md](./references/sensitive-data.md).
- Every log record and event record carries a severity under this skill's policy. Category is optional unless an approved schema or routing policy requires it. Do not automatically add a category field. OpenTelemetry does not require one. A category does not replace severity or determine the record kind.
- Ordinary diagnostic log records omit `EventName`. Event records use a non-empty native `EventName` that identifies their documented structure. Do not emit the deprecated `event.name` attribute.
- Audit and security events bypass sampling and level filters.
- The layer that handles a failure logs it once. Lower layers add context and rethrow without logging. Never invent a status for an error you rethrow.
- Fix logging without changing public signatures or business behavior.
- Use the approved structured logger and shared adapter, never console directly. The adapter keeps logging failures from failing requests. If redaction fails, drop the field, not the record.

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

Map source levels to `SeverityNumber` and preserve the actual source label in `SeverityText`. `INFO2` is the normalized display name for 10, not a required source label. See [severity.md](./references/severity.md).

## When the platform can't comply

- No FATAL: use ERROR (17) with outcome `terminated`.
- No INFO2: see [severity.md](./references/severity.md#adapt-missing-or-incorrect-levels).
- No structured fields, shared adapter, or unsampled audit route: make the safe change, report the gap, and don't claim compliance. Never relax a privacy rule to fit the platform.

## Example

Bad: `warn("Invalid body: %j", body)`, then return 400.
Good: one access event, WARN (13), with `http.response.status_code: 400` and `error.type: "validation_failed"` when the request failed validation.

## Troubleshooting

- Leak found: remove or redact the field where it is emitted, then report the field and sink without copying values.
