# Log records and event schemas

## Log records and event records

OpenTelemetry uses one `LogRecord` data model for diagnostics and named events. A record with a non-empty native `EventName` is an `EventRecord`. It travels through the same logs pipeline.

Ordinary diagnostic log records omit `EventName`. They may include approved structured attributes, severity, timestamps, and trace context. Neither structured metadata nor a category attribute makes them event records.

Use event records for named occurrences such as checkpoints, state changes, audit facts, and completion outcomes. Document when each event occurs, its stable name, its attribute schema, its occurrence timestamp, and its default severity number. The name identifies the structure, not an arbitrary message or request.

Reuse a defined OpenTelemetry event name only when the occurrence and schema match its convention. Otherwise use a documented custom namespaced name. Event definitions specify default severity numbers, not source severity text, and may define only a string display message for `Body`.

Use spans for operations with duration and meaningful boundaries. Use span attributes for properties of the operation as a whole. A completion event is a point-in-time outcome checkpoint, not a replacement for a duration span.

Privacy and field admission apply to both record kinds. Category is optional unless an approved schema or routing policy requires it. OpenTelemetry does not require a category. Ordinary diagnostics need approved fields, not a named-event schema or their own terminal owner.

## Logical record

This contract describes logical fields, not a logger call signature or an OTLP JSON encoding. Map native logger fields explicitly to the OpenTelemetry model.

| Field                             | Contract                                                                                                                                                                                                   |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Timestamp`                       | Record occurrence time. Required for event records. Let the SDK populate `ObservedTimestamp` separately. If a consumer accepts one timestamp, use `Timestamp` when present, otherwise `ObservedTimestamp`. |
| `EventName`                       | Omit for ordinary diagnostics. Required and non-empty for event records. Stable, low-cardinality name identifying the documented structure. No IDs or other dynamic values.                                |
| `Body`                            | OpenTelemetry permits any value, including structured values. This policy uses a stable human-readable message or template; approved variable values belong in attributes.                                 |
| `SeverityNumber`                  | Normalized number from the severity reference.                                                                                                                                                             |
| `SeverityText`                    | Actual source severity label. Preserve it independently of the event's documented default severity number. Do not confuse it with the normalized display name.                                             |
| `Resource`                        | Configure `service.name`, `service.version`, and `deployment.environment.name` once at the logging boundary.                                                                                               |
| `InstrumentationScope`            | Stable emitting component or library scope. Never a user or request name.                                                                                                                                  |
| `TraceId`, `SpanId`, `TraceFlags` | Active trace context when available. Do not emit a span ID without its trace ID. The sampled flag does not authorize dropping logs.                                                                        |
| `Attributes`                      | Approved diagnostic fields or fields from the named-event schema. Preserve numeric and boolean types.                                                                                                      |

A JSON logger may use `event_name`, `message`, `trace_id`, and `span_id` only with an explicit mapping to native fields. Do not introduce the deprecated `event.name` attribute. Do not use deprecated `error.message` for new records.

A bridge-specific metadata key is not a native field by itself. Existing logging libraries may use `otel.event.name`, exposed as `ATTR_OTEL_EVENT_NAME` in the JavaScript semantic-conventions package, so an SDK or Collector can set native `EventName`. This is distinct from deprecated `event.name`. For OTLP export, test that the bridge populates `EventName` rather than leaving the name only in attributes.

At the OpenTelemetry JavaScript API, `logger.emit({ eventName: ... })` sets the native field. In Winston metadata, the installed transport maps `[ATTR_OTEL_EVENT_NAME]` to that field. Plain `eventName` metadata becomes an attribute instead. Keep the existing logger wrapper unchanged for this distinction. Use the bridge key only for intentional event records, not every Winston call.

Non-OTLP exporters should use `otel.event.name` as an attribute fallback when the destination has no `EventName` or equivalent field. Document that destination mapping and verify it separately. Keep event-name bridge keys out of ordinary diagnostics.

Prefer fixed messages with typed attributes. Constant templates are acceptable only when the bridge demonstrably retains the template and typed properties separately; do not use Winston splat interpolation. Rendered prose or JSON embedded in a message is not a substitute for structured attributes.

## Attribute selection

Consult the applicable domain convention and attribute registry first. Reuse a standard attribute only when its meaning and type match the record. Check its stability and availability in the installed package; prefer exported constants over literal keys where supported. Do not redefine standard fields to fit an application schema.

Native `Timestamp`, `EventName`, severity, resource, scope, and trace context belong in their mapped OpenTelemetry fields, not invented attributes. Prefer native `TraceId` and `SpanId` for correlation rather than adding request identifiers.

### Standard attributes

| Attribute                   | Type and admission                                                                                                                                                                       |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `http.request.method`       | Known method string. Unknown methods become `_OTHER`. Do not retain arbitrary original input.                                                                                            |
| `http.route`                | Matched low-cardinality route template. Omit when unavailable. Never substitute the raw path.                                                                                            |
| `http.response.status_code` | Actual integer response status for the HTTP operation described by this record. An inbound completion records our response; a downstream HTTP record records that dependency's response. |
| `http.request.resend_count` | Nonnegative integer ordinal of an HTTP resending attempt, including redirects. Not a total retry count for a job or operation.                                                           |
| `error.type`                | Predictable low-cardinality failure classification. Use a documented fixed code or an allowlisted canonical exception class. Omit on success and expected non-error outcomes.            |
| `exception.type`            | Admitted canonical class name of an actual exception. Do not put a reason code in this field.                                                                                            |
| `exception.message`         | Optional message from a first-party error type declared safe.                                                                                                                            |
| `exception.stacktrace`      | Optional bounded sanitized stack.                                                                                                                                                        |

This is a selection, not a universal required schema. HTTP attributes describe HTTP operations, not arbitrary helpers. Domain conventions may supply other appropriate fields. Standard status or identity attributes do not override privacy restrictions.

### Custom fields

There is no universal OpenTelemetry attribute for every operation name, outcome, duration, reason, dependency alias, audit action, or record reference. Do not prescribe a generic extension catalog or merely remove a prefix and call the result standard.

If a field is necessary and no convention fits, use a documented application-owned namespace that does not clash with OpenTelemetry conventions. For internal CDCP fields, `cdcp.*` is an example; for cross-company use, OpenTelemetry recommends a company reverse-domain prefix. Follow lowercase dot-separated namespaces and snake_case within multi-word components. Never add custom fields to reserved `otel.*` or other standard namespaces.

The schema owner defines each custom field's meaning, type, bounds, privacy classification, and destinations:

- Operation names and dependency aliases are fixed, not URLs. Outcome values come from a documented bounded enum.
- Durations normally belong in spans or metrics. A completion log may carry a custom nonnegative monotonic duration with documented units when independent log analysis needs it; a metric name is not a standard log-duration attribute.
- A custom reason code is optional for non-error decisions or distinct domain detail. Do not repeat `error.type` under another key.
- Total retries, log inclusion probability, and random correlation fallbacks remain custom unless an applicable convention defines them. Do not confuse log sampling with native `TraceFlags`.
- Actor and target references require explicit privacy admission. Standard user or session attributes do not authorize personal data or session IDs.

If categorization is useful, use an approved custom or destination-specific field and bounded vocabulary. Destination conventions are not automatically OpenTelemetry conventions or evidence of protected delivery.

Keep correlation IDs out of metric labels, event names, and logger names.

## Canonical-event ownership

For each owned request or job, use one scoped accumulator and one terminal emitter. Never store mutable request fields in a global logger. Every return, rejection, and throw must end in its actual outcome and one terminal event, unless a named completion hook owns that branch. A catch-only failure event does not cover a successful return. Helpers add approved fields or ordinary DEBUG or TRACE diagnostic log records. They do not duplicate completion events, and each diagnostic does not need a terminal owner.

Use the actual status and schema-approved operation and reason values. Do not invent statuses or replace validated values with generic codes. The terminal event records the outcome and useful safe context; include a custom duration only when the schema requires independent log timing. Streaming responses need finish, failure, and close handling after the handler returns. Deduplicate overlapping callbacks. A process crash can prevent emission. Completion logging is not a durability guarantee.

Use a completion event as an outcome checkpoint. Use spans for the operation duration and step timing. Copy only fields needed to understand or retain the log independently, not every span attribute.

A separate security decision or audit commitment may precede completion. Preserve that distinct fact without copying the exception stack into both records.

## Audit and security schemas

Identify audit and security records through an explicit approved schema and delivery policy. Use a dedicated route or a tested schema-to-route mapping. A category field may select that route if the policy defines it, but no particular category key is required. Do not infer protected delivery from severity, an event-name prefix, or an unreviewed category value. Apply no sampling or ordinary level threshold at the call site, logger, collector, or destination.

Define events for authentication results, authorization denials, security-control decisions, and high-risk administrative actions. Reuse an applicable OpenTelemetry event convention when its occurrence and schema match. Otherwise define a custom namespaced event and approved fields for action, target type, result, reason, or security control as needed. These concepts do not imply a universal OpenTelemetry audit or security attribute catalog. Use `error.type` only when the occurrence represents an error.

Include the minimum approved actor and target references when attributable evidence requires them, using applicable conventions or documented custom fields. Do not make a person ID or client IP mandatory on every record. Never accept arbitrary audit details.

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
| Audit is the highest logger level                                       | INFO audit successes and WARN denials use an independent protected delivery route.                            |
| A handler emits completion in a finally block before streaming finishes | Move terminal emission to response lifecycle hooks and deduplicate callbacks.                                 |

### Ordinary diagnostic log record

Logical projection with explicitly mapped field names, not OTLP wire JSON.

```json
{
  "message": "Dependency retry scheduled",
  "severity_number": 5,
  "severity_text": "DEBUG",
  "attributes": {
    "cdcp.dependency.name": "document_storage",
    "cdcp.retry.count": 1
  }
}
```

The `cdcp.*` fields are illustrative custom attributes, not OpenTelemetry standards: a fixed dependency alias and nonnegative operation retry count. This diagnostic has no `EventName`. It is not an event record or a completion event.

### Canonical failure event record

Logical projection onto native OpenTelemetry fields, not OTLP wire JSON.

```json
{
  "event_name": "cdcp.document.upload.finished",
  "message": "Document upload finished",
  "severity_number": 17,
  "severity_text": "ERROR",
  "attributes": {
    "cdcp.operation.outcome": "failure",
    "http.request.method": "POST",
    "http.route": "/documents",
    "http.response.status_code": 503,
    "error.type": "storage_unavailable",
    "cdcp.retry.count": 2
  }
}
```

The custom event name identifies a documented application completion schema; it is not an OpenTelemetry standard event. The custom outcome enum and total retry count are included only if needed for independent log analysis. `error.type` supplies the failure classification without a duplicate reason field. Duration belongs to the associated span.

The logger maps `event_name` to native `EventName` and supplies the occurrence `Timestamp`, resource metadata, and active trace context. The HTTP attributes describe the incoming upload request, not a storage dependency response. No filename, document content, person identifier, or exception message enters this record.
