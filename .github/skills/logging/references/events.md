# Event schema

## Logical record

This contract describes logical fields, not a logger call signature or an OTLP JSON encoding. Map native logger fields explicitly to the OpenTelemetry model.

| Field                             | Contract                                                                                                                                                                                                     |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Timestamp`                       | Event occurrence time. Set it for first-party events. Let the SDK populate `ObservedTimestamp` separately. If a consumer accepts one timestamp, use `Timestamp` when present, otherwise `ObservedTimestamp`. |
| `EventName`                       | Stable, low-cardinality name for the event schema. No IDs or other dynamic values.                                                                                                                           |
| `Body`                            | OpenTelemetry permits any value, including structured values. This policy uses a stable human-readable message or template; approved variable values belong in attributes.                                   |
| `SeverityNumber`                  | Normalized number from the severity reference.                                                                                                                                                               |
| `SeverityText`                    | Actual source severity label. Do not confuse it with the normalized display name.                                                                                                                            |
| `Resource`                        | Configure `service.name`, `service.version`, and `deployment.environment.name` once at the logging boundary.                                                                                                 |
| `InstrumentationScope`            | Stable emitting component or library scope. Never a user or request name.                                                                                                                                    |
| `TraceId`, `SpanId`, `TraceFlags` | Active trace context when available. Do not emit a span ID without its trace ID. The sampled flag does not authorize dropping logs.                                                                          |
| `Attributes`                      | Named fields from the event allowlist. Preserve numeric and boolean types.                                                                                                                                   |

A JSON logger may use `event_name`, `message`, `trace_id`, and `span_id` only with an explicit mapping to native fields. Do not introduce the deprecated `event.name` attribute. Do not use deprecated `error.message` for new records.

Constant message templates are acceptable when the logger retains the template and typed properties separately. Rendered prose or JSON embedded in a message is not a substitute for structured attributes.

## Attribute catalog

`org.*` denotes organization-defined extensions, not OpenTelemetry conventions. Keep this namespace or map it once to an organization-owned namespace. Do not invent new meanings inside standard namespaces.

| Attribute                      | Type and admission                                                                                                            |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `org.event.category`           | Required enum. `application`, `access`, `security`, or `audit`.                                                               |
| `org.operation.name`           | Fixed operation name for canonical events.                                                                                    |
| `org.operation.outcome`        | Canonical enum. `success`, `rejected`, `degraded`, `failure`, `cancelled`, or `terminated`.                                   |
| `org.duration_ms`              | Nonnegative completion duration in milliseconds, measured with a monotonic clock.                                             |
| `org.reason.code`              | Optional bounded reason code. Never raw error text.                                                                           |
| `org.request_id`, `org.job_id` | Random ingress-generated correlation fallback when needed. Not personal or session identity.                                  |
| `http.request.method`          | Known method string. Unknown methods become `_OTHER`. Do not retain arbitrary original input.                                 |
| `http.route`                   | Matched low-cardinality route template. Omit when unavailable. Never substitute the raw path.                                 |
| `http.response.status_code`    | Actual response status as an integer, when known. On an access event this is our response, not the dependency response.       |
| `error.type`                   | Predictable low-cardinality classification when the operation ends in error. Omit on success and expected non-error outcomes. |
| `exception.type`               | Safe exception class name when an exception needs recording.                                                                  |
| `exception.message`            | Optional message from a first-party error type declared safe.                                                                 |
| `exception.stacktrace`         | Optional bounded sanitized stack.                                                                                             |
| `org.retry.count`              | Nonnegative total retry count for this unit of work. Not the HTTP convention for a particular resend attempt.                 |
| `org.dependency.name`          | Fixed approved dependency alias, not a URL.                                                                                   |
| `org.dependency.status_code`   | Remote HTTP status when relevant to the canonical outcome.                                                                    |
| `org.record.id`                | Optional declared opaque internal record ID.                                                                                  |
| `org.actor.id`                 | Optional declared opaque actor ID or centrally approved pseudonym.                                                            |
| `org.sampling.probability`     | Inclusion probability greater than zero and at most one, required only on sampled streams.                                    |

Define bounds and permitted destinations for each admitted field. Add domain fields only through the same admission process. Keep correlation IDs out of metric labels, event names, and logger names.

## Canonical-event ownership

Use one request-scoped or job-scoped accumulator and one terminal emitter. Never store mutable request fields in a global logger. Every return, rejection, and throw must end in its actual outcome and one terminal event, unless a named completion hook owns that branch. A catch-only failure event does not cover a successful return. Helpers add approved fields or DEBUG diagnostics; they do not emit standalone INFO completion events.

Use the actual status and schema-approved operation and reason values. Do not invent statuses or replace validated values with generic codes. The terminal event records the outcome, duration, and useful safe context. Streaming responses need finish, failure, and close handling after the handler returns. Deduplicate overlapping callbacks. A process crash can prevent emission. Completion logging is not a durability guarantee.

Use a completion event as an outcome checkpoint. Use spans for the operation duration and step timing. Copy only fields needed to understand or retain the log independently, not every span attribute.

A separate security decision or audit commitment may precede completion. Preserve that distinct fact without copying the exception stack into both records.

## Audit and security schemas

Route by `org.event.category`, not by severity or an event-name prefix. Apply no sampling or ordinary level threshold at the call site, logger, collector, or destination.

Define events for authentication results, authorization denials, security-control decisions, and high-risk administrative actions. Give each a fixed event name and approved fields for action, target type, result, and reason. Use `org.audit.action`, `org.audit.target_type`, `org.audit.result`, and `org.reason.code` for audit events. Use `org.security.control` and `org.reason.code` for security decisions.

Include the minimum approved actor and target references when attributable evidence requires them. Use `org.actor.id` and `org.record.id`. Do not make a person ID or client IP mandatory on every record. Never accept arbitrary audit details.

Define delivery, integrity, access, retention, and failure handling separately from severity. If durable audit evidence is required, use the approved transactional or fail-closed mechanism. An unfiltered asynchronous logger alone cannot guarantee delivery.

## Worked corrections

These examples describe emitted records, not APIs for a particular language or logger.

| Existing pattern                                                        | Replacement                                                                                                   |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| TRACE dumps a DTO                                                       | Remove the dump. Add only useful approved scalars to the canonical event.                                     |
| DEBUG prints a token or a cache value                                   | Remove the value. Record a fixed authentication outcome or a boolean cache hit when needed.                   |
| INFO prints a raw session ID                                            | Delete the identifier. Use active trace context. Do not compute a session hash at the call site.              |
| DEBUG prints an authorization or sign-out URL                           | Record the fixed operation and outcome. Omit query values and session identity.                               |
| A rejected body is printed before returning 400                         | One WARN 13 access event with status 400 and a fixed validation reason. Never the body.                       |
| A dependency 404 is an expected lookup miss                             | Add remote status to the canonical event. No separate failure line.                                           |
| Our dependency credentials cause 401                                    | One ERROR 17 at the owner of the integration failure. Do not call it a public-client error.                   |
| A kill switch deliberately returns 503                                  | The final access event is ERROR 17. A separate switch transition uses its own impact-based severity.          |
| Each reconnect emits ERROR                                              | DEBUG for useful attempt detail. One degradation transition. Final failed required work is ERROR.             |
| A repository logs an error body and rethrows                            | Propagate safe dependency type and status. Let the final owner record the failure once.                       |
| A formatter keeps the final digits of an identifier                     | Prevent admission. Replace the whole value in the backstop.                                                   |
| An exception is passed directly to a native error slot                  | Use that slot only after every sink passes the safe serializer tests. Otherwise project safe type and reason. |
| Audit is the highest logger level                                       | INFO audit successes and WARN denials use an independent protected category route.                            |
| A handler emits completion in a finally block before streaming finishes | Move terminal emission to response lifecycle hooks and deduplicate callbacks.                                 |

### Canonical failure

Logical projection onto native OpenTelemetry fields, not OTLP wire JSON.

```json
{
  "event_name": "org.document.upload.finished",
  "message": "Document upload finished",
  "severity_number": 17,
  "severity_text": "ERROR",
  "attributes": {
    "org.event.category": "access",
    "org.operation.name": "document.upload",
    "org.operation.outcome": "failure",
    "org.reason.code": "storage_unavailable",
    "org.duration_ms": 1247,
    "http.request.method": "POST",
    "http.route": "/documents",
    "http.response.status_code": 503,
    "error.type": "storage_unavailable",
    "org.retry.count": 2
  }
}
```

The logger supplies event time, resource metadata, and active trace context. No filename, document content, person identifier, or exception message enters this record.
