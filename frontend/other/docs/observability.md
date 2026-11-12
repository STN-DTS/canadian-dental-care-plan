# Local observability

Local-only guide for collecting and exploring frontend logs, metrics, and
traces with OpenTelemetry.

## Architecture

The frontend sends OTLP/HTTP signals to Grafana Alloy on port `4318`.
Alloy routes them to:

- Loki for logs
- Prometheus for metrics
- Tempo for traces
- Grafana for exploration

The Compose stack starts observability services only. It does not start the
frontend.

## Start stack

Prerequisites: Podman and the frontend dependencies installed.

```sh
podman compose -f compose.otel-local.yaml up -d
```

Configure frontend `.env`:

```sh
OTEL_API_KEY=local
OTEL_LOGS_ENDPOINT=http://127.0.0.1:4318/v1/logs
OTEL_METRICS_ENDPOINT=http://127.0.0.1:4318/v1/metrics
OTEL_TRACES_ENDPOINT=http://127.0.0.1:4318/v1/traces
OTEL_USE_CONSOLE_EXPORTERS=false
```

`OTEL_API_KEY=local` satisfies local frontend authentication. Local Alloy does
not require authentication and ignores this development-only header.

Start the frontend separately:

```sh
pnpm run dev
```

Open Grafana at <http://localhost:3001>. New stacks use `admin` / `admin`.
Loki, Prometheus, and Tempo data sources are provisioned automatically.

## Manage stack

Named volumes preserve Alloy queue state, Grafana configuration, and backend
data across normal stop, restart, and container recreation.

```sh
# Stop containers; keep containers and volumes.
podman compose -f compose.otel-local.yaml stop

# Restart stopped containers.
podman compose -f compose.otel-local.yaml start

# Remove containers and network; keep named volumes.
podman compose -f compose.otel-local.yaml down

# Recreate containers while reusing existing volumes.
podman compose -f compose.otel-local.yaml up -d
```

Delete local telemetry data only when intentional:

```sh
podman compose -f compose.otel-local.yaml down -v
```

## Inspect and back up data

Compose may prefix volume names with the project directory. List actual names
before inspecting or exporting them:

```sh
podman volume ls
podman volume inspect <volume-name>
podman volume export <volume-name> --output <volume-name>.tar
```

Restore a volume after creating an empty volume with the same name:

```sh
podman volume create <volume-name>
podman volume import <volume-name> <volume-name>.tar
```

## Application instrumentation

### Class method spans

Public instance methods in `app/.server/` use the existing
[`@Traced()` decorator](../../app/.server/observability/decorator/traced.ts).
The following helpers are deliberately untraced:

- Container lookups in `DefaultAppContainerProvider`.
- All DTO mappers under `domain/mappers/` and `web/mappers/`.
- Reference-data services for application years, client-friendly statuses,
  countries, document upload reasons, evidentiary document types, federal and
  provincial government insurance plans, GC and Sun Life communication methods,
  languages, letter types, marital statuses, provinces/territories/states, and
  record sources.
- Bearer-token resolution, build-info retrieval, and Redis command wrappers.
- In-memory `has`, `find`, `get`, `set`, and `unset` methods in `ExpressSession`
  and `NoopSession`. Their `save`, `destroy`, and `regenerate` lifecycle methods
  remain traced.
- Phone/email field selection in public and protected application-state resolvers.
  Their other methods remain traced because they localize values or coordinate
  address and dental-benefit lookups.
- All `Mock*Repository` methods.
- Repository metadata, `find*` methods that search a `listAll*` result, and
  health checks that only delegate or are unimplemented. Health checks that
  perform their own I/O, such as `DefaultVerificationCodeRepository.checkHealth`,
  remain traced.

These helpers do not create method spans. Any traced business service or repository
they call still runs under the active parent span. Mapping, lookup, localization,
memoization, logging, and error propagation are unchanged.

Logging and tracing internals, constructors, accessors, static methods, and private
or protected helpers also remain undecorated.

Span names use `ClassName.methodName`. The `code.function.name` attribute
identifies the same class and method. Arguments and return values are not
attached as attributes. The decorator records thrown or rejected errors as
exception events and sets the span status to error without replacing the error.
Exception messages and stacks retain the decorator's existing behavior.

Synchronous spans finish when the method returns. Asynchronous spans finish
when the returned promise settles. Method spans use the active OpenTelemetry
context, so repository spans nest under the active calling span even when an
untraced lookup service or mapper sits between them.

Existing memoization wraps the decorated method. Cache hits do not execute the
method and therefore do not create its span. Cached values, cache settings,
and method signatures are unchanged.

The [application tracing tests](../../__tests__/.server/observability/application-tracing.test.ts)
enforce these tracing boundaries and verify exported repository spans, the absence
of helper spans, retained session lifecycle spans, parent context, cache behavior,
and error propagation using real lookups, mappers, resolvers, and session wrappers
with mocked HTTP clients and session-store callbacks.

### Application error correlation IDs

Error pages display an existing `AppError.correlationId`, for example
`AB-123456`. This is an application-error occurrence ID, not a trace ID,
request ID, applicant identifier, or error-code catalog entry. Do not ask a
user for stack traces, exception messages, tokens, or applicant information.
Ask for the displayed ID and approximate time of the failure.

Public and protected errors use the selected language. Bilingual fallback
pages show the same ID in both sections. Not-found pages show it only when
their supplied error carries an AppError ID. Missing or blank IDs produce no
detail. Rendering and serialization never generate replacement IDs.

The existing `entry.server/handleError` diagnostic event emits `correlationId`
as a structured field with a fixed `Application error` message and error code;
it does not serialize the AppError message or stack. Aborted requests remain
suppressed. Ordinary errors without an AppError ID cannot be looked up by
this occurrence ID.

Use the existing log store and select the frontend service and relevant time
window. A synthetic Loki example (adjust the existing service label as needed):

```logql
{service_name="canadian-dental-care-plan"} | json | correlationId="AB-123456"
```

For development text logs, search the exact ID. Production JSON logs can also
be inspected locally using synthetic data:

```sh
jq 'select(.label == "entry.server/handleError" and .correlationId == "AB-123456")' synthetic-logs.ndjson
```

Server request and failing handler spans carry the same `correlationId`
attribute. A synthetic Tempo TraceQL lookup is:

```traceql
{ span.correlationId = "AB-123456" }
```

Open the matching trace to inspect the request and loader/action/middleware
spans. Trace IDs remain independently generated by the existing tracing
pipeline; this feature adds no headers, downstream propagation, browser
telemetry, exporters, or infrastructure. Sampling and retention can mean that
a matching log exists without a retained trace. `N/A` on an ordinary-error
span means no AppError occurrence ID was available; it is not displayed.

React Router 8.5.1 filters non-`Error` throws out of instrumentation
`result.error`, including AppError. The server-build adapter captures them
inside their active handler span, preserves the original throw, and retains
the ID and original abort signal in request-local OpenTelemetry context for
request-span enrichment. It preserves middleware names and loader hydration
metadata. Keep the real-router regression when upgrading React Router.

Validation from the repository root:

```sh
pnpm test frontend/__tests__/errors/app-error.test.ts frontend/__tests__/components/correlation-detail.test.tsx frontend/__tests__/components/error-layouts.test.tsx frontend/__tests__/entry.server.test.tsx frontend/__tests__/.server/utils/otel-instrumentation-utils.test.ts frontend/__tests__/.server/locales/typography.test.ts
pnpm run check
pnpm run test:unit:coverage
pnpm --filter @cdcp-rcsd/frontend run build
pnpm --filter @cdcp-rcsd/frontend exec playwright test --config e2e/error-correlation.config.ts
```

The last command uses a guarded, test-only preload against a fresh production
build, on port 3011, with existing mocks and synthetic error data. It replaces
handlers in the in-memory test build only, bypassing route business middleware
there; it does not add a production route or change application authentication.
The harness is outside the deployed package's `files` list. Its local
OpenTelemetry SDK is disabled; automated span assertions use mock spans with
real React Router instrumentation. Live collector/store verification requires
the existing observability environment and is not established by these tests.

The `dev`, `dbg`, `preview`, and `start` scripts load the official OpenTelemetry
ESM hook with
`--experimental-loader=@opentelemetry/instrumentation/hook.mjs` and preload
the SDK configuration in `app/instrumentation/telemetry.server.ts` with
`--import`. The server build emits
`build/server/telemetry.js`, which the production container preloads
with the same hook.
Do not start the server entry point directly: ESM auto-instrumentation requires
the hook, and the SDK must start before application dependencies are imported.

The loader uses Node's asynchronous ESM loader mechanism. Node may print an
`ExperimentalWarning` about `--experimental-loader`; this is expected with the
currently documented OpenTelemetry entry point, not an SDK initialization failure.

See [Express conventions](express.md) for middleware naming rules that preserve
meaningful telemetry metadata and span names.

For OpenTelemetry ESM loader requirements, see the
[OpenTelemetry ESM support guidance](https://github.com/open-telemetry/opentelemetry-js/blob/main/doc/esm-support.md).

### Keep the preload self-contained

Modules in `app/instrumentation/` must not import runtime code from outside
that directory. Use only OpenTelemetry packages, Node.js built-ins, and other
modules in `app/instrumentation/`. Type-only imports (`import type`) are safe
because TypeScript removes them. If an instrumentation module needs a general
helper, such as a string comparison, copy it into
[`instrumentation-utils.ts`](../../app/instrumentation/instrumentation-utils.ts).
Do not import it from `app/utils/` or another application module.

OpenTelemetry auto-instrumentation hooks into target modules, such as `http`,
`express`, and `redis`, when they are first imported. The SDK must register its
instrumentations before those modules load. If an instrumentation module
imports an application helper, that helper's dependency chain can load a target
package before the SDK starts. The hook is missed, and that package stops
emitting telemetry without an error. As the
[OpenTelemetry troubleshooting guide](https://opentelemetry.io/blog/2022/troubleshooting-nodejs/#enable-before-require)
puts it:

> All instrumentations are designed such that you first need to enable them and
> only then require the instrumented package. A common mistake is to require
> packages before enabling the instrumentation libraries for them.

The guide's example shows the mistake:

```typescript
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import http from 'http'; // ⇐ BAD - at this point instrumentation is not registered yet

registerInstrumentations({ instrumentations: [new HttpInstrumentation()] });
// your application code which uses http
```

An indirect import causes the same problem. In this example, `~/utils/string-utils`
could import a module that loads `http`, `express`, or another target package.
Do not import application helpers from an instrumentation module:

```typescript
// BAD: loads application code before the SDK starts.
import { fastCaseInsensitiveEqual } from '~/utils/string-utils';
```

Import the instrumentation-local copy instead:

```typescript
// GOOD: stays inside app/instrumentation/.
import { fastCaseInsensitiveEqual } from '~/instrumentation/instrumentation-utils';
```

The [ESM instrumentation test](../../__tests__/instrumentation/telemetry-esm.server.test.ts)
starts a real server with the preload. It checks that HTTP and Express spans are
still emitted.

### Router instrumentation is disabled

Express 5 dispatches through the `router` package, so the default
`@opentelemetry/instrumentation-router` wraps the same layers that
`@opentelemetry/instrumentation-express` already wrapped. Every middleware then
gets an extra `middleware - patched` span, and request handlers are recorded
twice. The SDK disables router instrumentation, even when
`OTEL_NODE_ENABLED_INSTRUMENTATIONS` lists it, and keeps the Express spans. The
ESM instrumentation test verifies that no router spans are exported. Revisit
this setting when
[opentelemetry-js-contrib#3881](https://github.com/open-telemetry/opentelemetry-js-contrib/issues/3881)
is fixed.

## Winston log export

The frontend runtime includes `@opentelemetry/winston-transport`. Winston
auto-instrumentation needs this package to attach its OpenTelemetry transport
when `OTEL_LOGS_ENDPOINT` enables log sending. Do not add a second transport
manually, because the instrumentation attaches it when Winston is configured.

The [Winston export test](../../__tests__/instrumentation/winston-export.server.test.ts)
starts the application preload, observes native records at the exporter boundary,
and captures actual OTLP output with a loopback collector. It verifies native
event names, timestamps, typed fields, severity numbers and source labels without
adding a protobuf decoder dependency. It also checks
serialized console and temporary audit-file output. This local coverage does not
establish live collector or storage policies.

Enabling export also enables export of existing log calls. The current log
redactors do not sanitize string bodies. Keep sensitive data out of messages
and metadata, and complete the planned caller migration and sink canary tests
before treating logging as privacy-safe.

### Backend URL paths

[`UrlPathRedactor`](../../app/instrumentation/url-path-redactor.ts) removes the
key-bearing suffix of `esdc_clients(...)` paths under
`/dental-care/appeal-upload-eligible/pp/v1` and
`/dental-care/doc-metadata/pp/v1`. The suffix becomes `esdc_clients([REDACTED])`,
including any navigation or action after the key. This avoids parsing
untrusted OData key delimiters. Application pathnames and collection paths
remain unchanged in spans.

The rule covers `url.full`, `url.path`, `http.url`, `http.target`, and
`react_router.url`, including string arrays, in Winston output and OpenTelemetry
logs and spans. Backend client identifiers are redacted; approved application
request paths are retained in the canonical HTTP completion event. Query
parameters are handled separately by the query-parameter redactors. The
approved `cdcp.application.confirmation_code` field is unaffected. String
messages, arbitrary metadata keys, span names, and exception details are not
inspected; callers must still omit sensitive values.

The Winston export and ESM instrumentation tests exercise synthetic client
numbers, email-shaped values, and token markers through console logs, local
OTLP log export, and auto-instrumented HTTP/Undici spans through both console
and local OTLP trace export. They do not
verify live collectors or backends.

### Custom log attribute conventions

[`log-attributes.ts`](../../app/.server/logging/log-attributes.ts) is the
canonical registry for application-owned `cdcp.*` log attributes. Each
`ATTR_CDCP_*` export documents its wire name, value type, meaning, units or
allowed source domain, and relevant privacy restrictions. These attributes
reach the configured console and OpenTelemetry log sinks; they do not
authorize new destinations or broader retention/access.

Use the official `@opentelemetry/semantic-conventions` constants for standard
attributes and named imports from the registry for custom keys:

```typescript
import { ATTR_CDCP_CLIENT_ID } from '~/.server/logging/log-attributes';

log.debug('Home address is missing required fields; omitting home address from response', {
  [ATTR_CDCP_CLIENT_ID]: clientId,
});
```

Keep metadata objects fresh at each call. The registry names fields; it does
not validate, truncate, mask or sanitize their values. Apply privacy controls
before logging. Opaque identifiers and masked confirmation codes remain
linkable protected data, not anonymous values.

Before adding an attribute, check for an applicable standard convention,
then document its purpose, source domain, type, units, privacy admission and
destinations in the registry. Never add personal fields merely because the
key has a constant. Treat wire-name or meaning changes as consumer-facing
schema changes. Existing raw-string assertions intentionally verify exported
wire names independently of the registry.

`cdcp.http.request.completed` is an event-name **value**, not an attribute
key, and stays separate. This registry does not change event ownership,
OpenTelemetry severity mapping, or audit record schemas/delivery. It belongs
to server application logging, not the self-contained telemetry preload.

`createRequestLoggerMiddleware` owns the canonical completion event and retains
the application `request.path` without its query string. It uses
Winston `http` for final HTTP 1xx-4xx responses, which exports as
`SeverityNumber.DEBUG4` (8), below ordinary INFO (9). Winston's `http` priority
also sits below `info`, so production `LOG_LEVEL=info` drops these
completions before console or OpenTelemetry delivery. Use `LOG_LEVEL=http`,
`debug` or `trace` to include them during a scoped investigation.

Inbound 4xx responses are expected client outcomes, such as form validation
errors returned by actions, so they share the `http` level and keep
`error.type` set to the status code. Inbound 5xx remains ERROR (17) and is
retained at INFO. Incomplete responses keep `error.type=http_response_incomplete`
and the same event name, but use the message `HTTP response incomplete` and
log at `http` because they usually mean the client disconnected, for
example by navigating away during an asset download (Traefik records 499).
Server-side stream and handler failures are logged at ERROR by the layer that
handles them, so the completion event does not duplicate them. Audit and ordinary application INFO
records remain severity 9. This filtering does not change request handling,
metrics, spans or completion ownership.

React Router's `handleError` logs recognized 4xx route errors at DEBUG.
This includes POST requests to routes without an action, which return 405.
The request completion event logs it at `http`, so production `LOG_LEVEL=info`
drops the rejection without a duplicate ERROR diagnostic. Route errors with 5xx status and
unclassified errors remain at ERROR. Aborted requests remain excluded from
the error hook. Its request failure counter and log attributes are unchanged.

### Audit records

`DefaultAuditService.createAudit` emits `cdcp.audit.recorded` when an internal
audit call occurs. It records the audit fact, not the outcome of the associated
business operation. The fixed body is `Audit event recorded`; the source label
is `audit`, normalized to INFO (9). The SDK supplies the native occurrence and
observed timestamps.

The bounded schema admits:

- `cdcp.audit.event_id`: a code-defined action identifier of at most 128
  lowercase ASCII letters, digits, dots or hyphens, beginning with a letter.
- `cdcp.user.id`: the existing approved opaque actor identifier, when present.
- `cdcp.letter.id`: the existing approved opaque letter identifier, only for
  `pdf.get`.

Actor and letter identifiers are at most 255 ASCII letters, digits, dots,
underscores, colons or hyphens. Government-number-shaped values are rejected.
These fields remain linkable protected data; the format check does not
authorize new identifier sources, destinations, retention or access.
Arbitrary `AuditDetails` fields, whole objects, accessors and proxies are not
serialized. Rejected metadata produces a fixed diagnostic without its keys or
values; the admitted audit fact is still emitted.

OpenTelemetry receives a native `EventName`. Console and file JSON retain
`otel.event.name` as the non-OTLP fallback. The old `%j` message and nested
`details` payload are not emitted. Consumers should query the documented flat
fields rather than expecting interpolation or arbitrary metadata.

Audit priority bypasses ordinary Winston thresholds, including `LOG_LEVEL=error`
and `LOG_LEVEL=audit`, and is independent of trace sampling. Persistent output
still follows `AUDIT_LOG_ENABLED`. Audit files retain the transport's default
permissions, subject to the process umask. Deployment configuration must allow
Fluentd to read them while enforcing approved access, integrity and retention
policies. The local sink test verifies
delivery to file, console and OTLP with ordinary diagnostics filtered out and
trace sampling disabled.

### Application confirmation codes

The public and protected application and renewal services log confirmation
receipt at INFO with the last four digits of
`cdcp.application.confirmation_code` replaced by `*`. Codes with fewer than
four digits have all their digits masked. The code returned to the applicant
is unchanged.

Search using the remaining visible prefix, for example `1234****` for the
synthetic code `12345678`. Partial masking is not anonymization: prefixes
remain linkable and may match multiple submissions. The masked digits cannot
be recovered from this field. The Winston sink test verifies the masked value
in console and local OTLP output and checks that the original code is absent.

### Operational diagnostics

Audit startup includes the configured file path/pattern in
`cdcp.log.audit_file_path`; this is a startup diagnostic, not an audit record.
Memory-session expiry checks include `cdcp.session.expires_at`, an ISO timestamp
or null when no expiry is set.

Redis and telemetry startup/shutdown failures use the shared
`operationalErrorType` classifier. Verified `Error.isError` values report their
prototype constructor's class name, including custom subclasses. Names must be
identifier-shaped ASCII strings of at most 128 characters; unavailable or
unsupported names fall back to `Error`. Instance overrides of `name` and
`constructor` are ignored, and getters are not invoked. Proxied prototypes and
constructors are rejected without invoking their traps.
Non-errors use OpenTelemetry's `ERROR_TYPE_VALUE_OTHER` (`_OTHER`).
Generic `Error` instances remain `Error`, even when they carry an OS error code;
Redis protocol replies report their class rather than parsing message prefixes.
`cdcp.error.code` separately preserves allowlisted system codes for connection,
DNS, permission, missing-file and TLS-certificate failures. Unknown codes are
omitted. Its constant is defined in the self-contained instrumentation registry
and re-exported by the application registry.
Constructor names are diagnostic hints, not trusted identity: build tools can
rename them, and identifier-shaped names can still be application-controlled.
Do not dynamically generate class names from personal data or secrets.
Operation context stays in the fixed log message. Exception messages,
stacks, arbitrary error codes and causes are never emitted by these diagnostics.
Bootstrap output remains on console to avoid loading application dependencies
before instrumentation; it is not routed through the application logger.

## Span attribute redaction

The telemetry preload wraps its exporting span processor with
[`RedactQueryParamsSpanProcessor`](../../app/instrumentation/redact-query-params-span-processor.ts)
and
[`RedactAttributesSpanProcessor`](../../app/instrumentation/redact-attributes-span-processor.ts).
Both sanitize copies of span attributes before forwarding them downstream.
They preserve span metadata and forward lifecycle calls, including flush and shutdown.
An additional `RedactAttributesSpanProcessor` applies `UrlPathRedactor` before
export, including when console trace export is enabled.

Query redaction replaces parameter values in `url.full`, `http.url`,
`http.target`, `url.query`, and `react_router.url`. By default it hides every
parameter except the names in `SAFE_QUERY_PARAMETER_NAMES`, so a parameter added
to the app stays hidden until someone reviews it and adds it to that list. It
preserves paths, parameter names, safe parameters, duplicate parameters, and URL
fragments.
Redaction uses `URLSearchParams`, so a redacted query string uses its encoding,
including `%5BREDACTED%5D` for `[REDACTED]`. Other attributes are not inspected.

The rules live in two redactors that the span and log record processors share:
[`QueryParamsRedactor`](../../app/instrumentation/query-params-redactor.ts)
and
[`AttributeRedactor`](../../app/instrumentation/attribute-redactor.ts).
Each processor takes a redactor instance, and the preload creates one of each
for both signals. Pass options to the redactor constructor.

`QueryParamsRedactor` accepts these options:

- `attributeKeys` lists the attributes to inspect. It defaults to `url.full`,
  `http.url`, `http.target`, `url.query`, and `react_router.url`, the full
  request URL that the app's React Router spans record. Each value must be an absolute
  URL, a slash-prefixed path, or a query string with an optional leading `?`.
  Values that are none of these are parsed as a query string. Values without a
  query are left unchanged.
- `parameterNames` lists the decoded parameter names whose values are
  replaced. It defaults to a predicate that matches every name not in
  `SAFE_QUERY_PARAMETER_NAMES`. That set lists the names the app sends or
  receives that carry no personal data or secrets, such as `lang`, `locale`,
  `scope`, and the OData `$select`, `$expand`, and `$orderby`. The OData values
  are constant field lists, and nested `$filter` clauses in `$expand` compare
  only status codes and hard-coded IDs. If a query puts personal data in one of
  these parameters, remove the name from the set. OIDC values such as `code`,
  `state`, and `nonce`, `$filter`, identifiers, and address lookups are
  redacted. Names are compared exactly, so `LANG` is redacted. To allow
  another name, pass
  `(name) => !SAFE_QUERY_PARAMETER_NAMES.has(name) && name !== 'page'`. An empty
  list redacts nothing.
- `replacement` replaces `[REDACTED]`. It can be a string or a callback that
  receives the decoded parameter name as `key` and its decoded value as `value`.
  Replacements are encoded as parameter values, so they cannot add parameters.

Entries in both lists are strings, regular expressions, or predicates. Strings
match ignoring case and accents. Regular expressions follow their own flags; the
`g` and `y` flags are ignored. A predicate is a function that receives the
attribute key or parameter name and returns `true` to redact it. Predicates see
names only, never values.

Strings are checked first, then regular expressions, then predicates. Each
regular expression and predicate runs against every name that no earlier entry
matched, so prefer anchored expressions such as `/^id_token$/i` and keep
predicates cheap. Attribute-key results are cached, so a predicate in
`attributeKeys` must return the same result for the same key. Parameter names
are not cached, so a predicate in `parameterNames` runs for every parameter.

For example, this redactor hides authorization codes, states, any parameter
ending in `token`, and long parameters prefixed with `x-`, in the default
attributes and in any attribute under `redirect.`:

```typescript
const queryParamsRedactor = new QueryParamsRedactor({
  attributeKeys: [...DEFAULT_REDACT_QUERY_PARAMS_OPTIONS.attributeKeys, /^redirect\./],
  parameterNames: ['code', 'state', /token$/i, (name) => name.startsWith('x-') && name.length > 32],
});
```

`AttributeRedactor` replaces the whole value of each attribute whose key
matches `attributeKeys`, whatever the value's type. It never reads attribute
values, so it does not look for personal data in attributes it is not told
about. Name sensitive attributes explicitly instead of recording them under
generic keys such as `message`.

`AttributeRedactor` accepts these options:

- `attributeKeys` lists the attributes to redact, as strings or regular
  expressions matched as described above. The defaults match `db.statement`,
  `db.query.text`, `http.request.body`, and `user.email`, plus keys containing
  `password`, `secret`, `token`, `apikey`, `api_key`, `api-key`, `authorization`,
  `credential`, `ssn`, `credit_card`, `credit-card`, or `cookie`, ignoring case.
  A `sin` key component is also matched. Client IP attributes such as
  `client.address` are kept for monitoring; add them to `attributeKeys` to
  redact them. Pass an empty list to disable attribute redaction.
- `replacement` replaces `[REDACTED]`. It can be a string, including an empty
  string, or a callback that receives `{ key, value }` with the original
  attribute value. Non-string values are passed without stringification.

Both redactor modules export their `DEFAULT_REDACT_*_OPTIONS` objects for callers
that want to extend a default list rather than replace it.

The redactors include these performance features:

- `QueryParamsRedactor` caches whether each attribute key matches its
  `attributeKeys`. It does not cache parameter names, which come from requests.
- `AttributeRedactor` caches the same decision for its `attributeKeys`.
- Both caches hold up to 1,000 keys and are cleared when full, so attacker-chosen
  keys cannot grow them without bound. Replacement callbacks still run on every
  redaction.

For example, this pipeline redacts only the `token` query parameter and adds
`customer.id` to the default attribute keys:

```typescript
const queryParamsRedactor = new QueryParamsRedactor({ parameterNames: ['token'] });
const attributeRedactor = new AttributeRedactor({
  attributeKeys: [...DEFAULT_REDACT_ATTRIBUTES_OPTIONS.attributeKeys, 'customer.id'],
});
const processor = new RedactQueryParamsSpanProcessor(new RedactAttributesSpanProcessor(exportingProcessor, attributeRedactor), queryParamsRedactor);
```

These processors sanitize span attributes only. Span names, status descriptions,
event and link attributes, resource attributes, metrics, and URL fragments are
outside their scope. Do not record sensitive data in those fields.

## Log record redaction

When log export is enabled, the preload lists
[`RedactQueryParamsLogRecordProcessor`](../../app/instrumentation/redact-query-params-log-record-processor.ts)
and
[`RedactAttributesLogRecordProcessor`](../../app/instrumentation/redact-attributes-log-record-processor.ts)
before the batch exporting processor, using the same redactors as spans.

Query redaction applies to log record attributes and top-level map-body
entries whose keys match `attributeKeys`. It does not scan string bodies or
other attributes, so do not log URLs with sensitive query parameters in
message text.

Attribute redaction applies to log record attributes and to the top-level keys
of a map body that match `attributeKeys`. String bodies and nested map values
are not inspected, so do not put sensitive data in log message text.

Log redaction uses flat list entries, unlike span redaction. The logs SDK passes
the same mutable record to each processor in order and makes it read-only only
after every processor has run, so these processors edit the record in place.
Keep them before any processor that exports or buffers records.

```typescript
logRecordProcessors: [
  new RedactQueryParamsLogRecordProcessor(queryParamsRedactor),
  new RedactAttributesLogRecordProcessor(attributeRedactor),
  exportingProcessor,
],
```
