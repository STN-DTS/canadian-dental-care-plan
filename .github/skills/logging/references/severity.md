# Severity decisions

## Numbers and source levels

OpenTelemetry defines increasing severity numbers. Logger threshold integers may run in the opposite direction. These selected numbers are organization policy within the OpenTelemetry ranges.

| Range       |        Selected number | Policy                                                         |
| ----------- | ---------------------: | -------------------------------------------------------------- |
| TRACE 1-4   |                      1 | Fine-grained diagnostics, normally disabled.                   |
| DEBUG 5-8   |                      5 | Component, dependency, and network diagnostics.                |
| INFO 9-12   |                      9 | Normal application and lifecycle events.                       |
| INFO 9-12   | 10, displayed as INFO2 | Successful canonical HTTP events.                              |
| INFO 9-12   |              11 and 12 | Reserved. Do not emit new first-party INFO3 or INFO4 levels.   |
| WARN 13-16  |                     13 | Warnings, material degradation, and final inbound 4xx.         |
| ERROR 17-20 |                     17 | Failed server work, integration faults, and final inbound 5xx. |
| FATAL 21-24 |                     21 | Abnormal process-ending failures at the top-level boundary.    |

Number 0 means unspecified, not TRACE. Backend display and alert behavior require tests.

`SeverityText` preserves the source label. `SeverityNumber` carries normalized meaning. OpenTelemetry recommends the lowest number in a range when the source has only one matching level. Imported third-party sublevels need a documented mapping, not automatic rewriting to this first-party subset.

## Decision table

| Situation                                                                    | Record and severity                                                                                                              |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Successful final HTTP 1xx through 3xx                                        | One access completion at INFO2 10. An interim 100 response is not completion.                                                    |
| Final inbound 4xx                                                            | One access event at WARN 13, including expected 400, 401, 403, 404, 409, 422, and 429.                                           |
| Final inbound 5xx                                                            | One access event at ERROR 17, including deliberate maintenance or kill-switch 503 responses.                                     |
| Server timeout or failed response stream                                     | ERROR 17 with failure outcome. Preserve the actual sent status if known. Never invent a sent 500.                                |
| Intentional client cancellation without a final response                     | Record cancellation at DEBUG if useful, otherwise omit. Do not fabricate a status or error stack.                                |
| Downstream bad request or credentials caused by our service                  | ERROR 17 once where that integration failure is handled.                                                                         |
| Expected downstream absence or conflict                                      | No separate line. Add approved dependency status and outcome fields to the canonical record.                                     |
| Downstream rejection of validly forwarded caller input or caller credentials | Classify the owned outcome. A resulting inbound 4xx is WARN, not automatically a server fault.                                   |
| Retry within its budget                                                      | No line by default. Useful attempt diagnostics are DEBUG 5.                                                                      |
| Retry recovers without material degradation                                  | Normal success severity with retry count.                                                                                        |
| Handled throttling or fallback leaves material degradation                   | WARN 13 for the owned non-HTTP outcome or a distinct degradation transition.                                                     |
| Retries exhausted and required work fails                                    | ERROR 17 at the final owner.                                                                                                     |
| Expected non-HTTP domain refusal                                             | INFO 9 or no separate event. Do not expose personal decision details.                                                            |
| Service ready, graceful stop, or recovery                                    | INFO 9 once per transition.                                                                                                      |
| Required startup configuration prevents execution                            | FATAL 21 at the top-level owner if the process exits abnormally. Never log the configuration value.                              |
| Shutdown failure                                                             | Classify actual impact. Failed required work can be ERROR. Normal exit is not FATAL.                                             |
| Healthy probe                                                                | Omit routine completion logs under an explicit probe policy. Preserve probe metrics.                                             |
| Health deteriorates                                                          | WARN for degradation, ERROR for inability to perform required work, once per transition. Retained 5xx probe events remain ERROR. |
| Successful audit action or security decision                                 | INFO 9 with the approved audit or security schema and protected delivery route.                                                  |
| Authentication refusal or authorization denial                               | WARN 13 when required by the security event catalog, with its protected delivery route. Backend faults remain ERROR.             |

A caught exception is not proof of recovery. A public caller can trigger a real server defect. Neither fact permits demoting a failed server operation.

HTTP status owns the access record. A successful 200 served through a fallback remains INFO2 with a degraded outcome. Record a distinct dependency failure or degradation transition separately only when it needs independent operational attention. If the dependency failure becomes the final 5xx, fold its safe details into that canonical ERROR instead. Never duplicate the same exception stack.

HTTP span status follows its own conventions. Server-span 4xx normally leaves status unset. Client-span 4xx normally sets Error. Neither rule dictates log severity.

## Adapt missing or incorrect levels

1. Record each source method, source threshold, logical event severity, and exported `SeverityNumber`.
2. Prefer an existing numeric-severity API or configure the shared adapter to preserve logical levels.
3. If the logger lacks INFO2, use its informational transport method and a shared canonical-event adapter that exports logical severity 10. Match a defined HTTP completion schema and successful outcome, not arbitrary message text or a mandatory category field. Do not remap all INFO to 10.
4. If that distinction cannot survive export, retain native INFO with approved HTTP completion fields and report an unresolved application-policy mapping gap. Native INFO 9 is valid OpenTelemetry; it does not satisfy this policy's selected HTTP sublevel. Do not invent INFO2 merely in a display label.
5. If TRACE is absent, use scoped DEBUG and document the loss of granularity. If neither exists, omit optional diagnostics rather than promote them to INFO.
6. If FATAL is absent, emit ERROR 17 and explicitly describe termination in the fixed message or an approved custom outcome field. There is no universal OpenTelemetry termination-outcome attribute. Keep bounded flushing and abnormal exit at the top-level owner.
7. If WARN or ERROR cannot be represented, add the shared normalized mapping before accepting the change. A category field alone cannot replace failure severity.
8. Fix bridge mis-mapping centrally. Verify production thresholds, collector transforms, and backend values for every emitted logical level. A method named HTTP may otherwise arrive as a diagnostic or unspecified level.

Severity does not automatically page an operator. Alert on impact, rates, and response procedures. A single actionable security event may warrant an alert.
