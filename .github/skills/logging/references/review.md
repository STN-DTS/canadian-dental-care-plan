# Detect, migrate, and review

## Detect the logging path

- Find the approved logger, structured-field API, exception serializer, request completion hook, trace context, and audit destination.
- Read configuration and installed bridge versions. Trace emission through filters, formatters, auto-instrumentation, collectors, and every sink, including bootstrap and emergency output.
- Map source levels to [severity numbers](./severity.md) and test the exported numbers. Never equate local priority integers with OpenTelemetry numbers.
- Fix a missing level or bridge mis-mapping in the shared adapter, not at call sites.
- If no approved logging path exists, report the gap. Do not substitute console output or add a library without project approval.

## Migrate in verifiable units

1. Inventory call sites, completion owners, exception hooks, sinks, filters, dashboards, alerts, and audit consumers.
2. Remove disclosure paths first. Do not dual-write unsafe legacy records for compatibility. Report historical exposure through incident handling.
3. Declare the safe event schema and its terminal owner. Remove duplicate exception logs and redundant breadcrumbs in the same unit.
4. Correct severity and category mapping centrally. Preserve distinct security and audit events.
5. Update queries and consumers with incompatible schema changes. Version the contract when needed, not every record by default.
6. Verify real emitted records before proceeding to the next unit. For a bulk migration, use a repeatable transformation and a check for forbidden patterns.

## Minimum gate for every logging change

- Every field has an approved purpose, type, bounds, and destination. No whole objects or forbidden values enter the record.
- Messages and event names are stable. Structured values remain typed at the destination.
- The relevant canonical events map successful HTTP to 10, inbound 4xx to 13, and inbound 5xx to 17.
- Dependency status does not overwrite local response status. Retries do not emit failure records at every layer.
- One terminal event owns the result. Exception detail appears once. Audit and security facts retain independent delivery.
- Trace context survives applicable asynchronous boundaries. Concurrent requests cannot exchange context.
- The mandatory synthetic canary suite runs through every configured real sink, including bootstrap and OpenTelemetry export.
- Backend mapping tests cover every logical level and the applicable success, rejection, failure, cancellation, and termination paths.
- Raised ordinary thresholds and disabled trace sampling do not suppress audit or security records.

A call-site change runs the existing pipeline canary and mapping suites plus focused event tests. If the suites do not exist, add them or report the gate as unmet.

## Additional gate for pipeline changes

Test serializer failure, exporter outage, queue overflow, flush timeout, and emergency fallback. Test every newly enabled sink and any changed bridge version. Confirm that rejected fields never escape through fallback output.

Use bounded asynchronous buffers and a shutdown deadline. Ordinary diagnostic export failure must not change the business result. Monitor queue saturation, lost records, and export failures through a non-recursive health path. Verify required audit durability using its approved failure policy.

## Volume and operations

Keep production diagnostics at INFO or the equivalent threshold that retains INFO2. Enable DEBUG or TRACE only for a scoped investigation with an owner and expiry. Privacy rules do not relax.

Sample routine successes under a documented trace-consistent or operation-consistent policy. Record inclusion probability. Use metrics for exact counts rather than treating sampled logs as totals.

Retain failures by default. An approved repeated-failure aggregation policy must preserve counts, time interval, first and last occurrence, and a safe representative. Never apply sampling, deduplication that loses facts, or ordinary level filtering to audit and security events.

Bound record bytes, field lengths, collection sizes, stack depth, buffers, and flush time. Avoid per-item hot-loop logs. Use lazy attribute construction or a level-enabled check for expensive diagnostics.

Set per-category access, retention, integrity, and deletion controls. Alert on user impact and actionable conditions. Missing telemetry is a monitoring failure, not proof of health.

## Sources

OpenTelemetry pages were checked on 2026-11-03.

Organization policy supplies the exact HTTP severity mapping, reserved sublevels, government-identifier prohibition, exception-message allowlist, category vocabulary, and unsampled security and audit routing. External sources support these decisions but do not mandate all of them.

### Specifications

- [OpenTelemetry logs data model](https://opentelemetry.io/docs/specs/otel/logs/data-model/). Supplies severity ranges, recommended source mapping, short names including INFO2, native trace fields, event time, Resource, InstrumentationScope, Body, Attributes, and EventName. It does not prescribe HTTP log severity.
- [OpenTelemetry semantic conventions](https://opentelemetry.io/docs/specs/semconv/). Supplies the shared vocabulary and resource-attribute framework. The resource fields used here are `service.name`, `service.version`, and `deployment.environment.name`.
- [HTTP attribute registry](https://opentelemetry.io/docs/specs/semconv/registry/attributes/http/). Supplies `http.request.method`, `http.route`, and `http.response.status_code`. Requires unknown-method handling and forbids substituting a raw path for a route template.
- [HTTP span conventions](https://opentelemetry.io/docs/specs/semconv/http/http-spans/). Supplies separate client and server perspectives, contextual status handling, and cancellation guidance. Span status is not log severity.
- [Error attribute registry](https://opentelemetry.io/docs/specs/semconv/registry/attributes/error/). Supplies predictable low-cardinality `error.type`, omission on success, and the deprecation of `error.message`.
- [Exceptions in logs](https://opentelemetry.io/docs/specs/semconv/exceptions/exceptions-logs/). Supplies `exception.type`, `exception.message`, and `exception.stacktrace`, the sensitive-message warning, and best-effort fatal export. Attributes are stable. Severity, event-name, and some recording guidance remain Development. Native exception support does not prove serializer safety.
- [Event conventions](https://opentelemetry.io/docs/specs/semconv/general/events/). Supplies stable event names, occurrence timestamps, typed attributes, and selective reuse of span attributes. This guidance is Development. Canonical completion events here are outcome checkpoints, not replacements for duration spans.
- [Event attribute registry](https://opentelemetry.io/docs/specs/semconv/registry/attributes/event/). Deprecates `event.name` in favor of native `EventName`.

### Privacy and security

- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html). Supports sensitive-data exclusion, attributable security events, output encoding, integrity, access, retention, and failure testing. The identifier and exception restrictions here are stricter local policy.
- [OWASP A09:2021](https://owasp.org/Top10/2021/A09_2021-Security_Logging_and_Monitoring_Failures/). Supports security monitoring, response, audit integrity, and injection protection. It does not mandate WARN for 4xx.
- [Privacy Act](https://laws-lois.justice.gc.ca/eng/acts/P-21/page-1.html). Informs treatment of identifying numbers and medical or financial information as sensitive, with purpose-limited collection and controlled use. It does not establish applicability, compliance, or a retention period for every project.

### Operational practice

- [Stripe canonical log lines](https://stripe.com/blog/canonical-log-lines). Supports consolidated request outcomes, stable schemas, and failure-path emission. Completion logging remains best effort.
- [Boris Tane, wide events](https://boristane.com/blog/observability-wide-events-101/). Supports context-rich service-hop records and correlation. Whole user objects, headers, and query values in examples are not adopted.
- [Logging sucks](https://loggingsucks.com/). Supports deliberate context and outcome-aware sampling. Always-informational failures and identifying example fields are not adopted.
- [Dash0 logging practices](https://www.dash0.com/guides/logging-best-practices). Supports stable messages, structured values, severity adaptation, bounded volume, retention, and actionable alerts.
- [Honeycomb logging checklist](https://www.honeycomb.io/blog/engineers-checklist-logging-best-practices). Supports consolidation, ingress correlation, standardized fields, and retention. Raw session IDs and universal per-error paging are not adopted.
- [Gordol logging practices](https://gist.github.com/gordol/04bd623f769f42de566b8580e36dcd29). Supports consolidation, purposeful events, and verification. Raw request or response dumps are not adopted.
