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
[`instrumentation-utils.server.ts`](../../app/instrumentation/instrumentation-utils.server.ts).
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
import { fastCaseInsensitiveEqual } from '~/instrumentation/instrumentation-utils.server';
```

The [ESM instrumentation test](../../__tests__/instrumentation/telemetry-esm.server.test.ts)
starts a real server with the preload. It checks that HTTP and Express spans are
still emitted.

## Span attribute redaction

The telemetry preload wraps its exporting span processor with
[`RedactQueryParamsSpanProcessor`](../../app/instrumentation/redact-query-params-span-processor.server.ts)
and
[`RedactAttributesSpanProcessor`](../../app/instrumentation/redact-attributes-span-processor.server.ts).
Both sanitize copies of span attributes before forwarding them downstream.
They preserve span metadata and forward lifecycle calls, including flush and shutdown.

Query redaction hides every parameter value by default in `url.full`, `http.url`,
`http.target`, and the standalone `url.query` attribute. It preserves paths,
parameter names, duplicate parameters, and URL fragments. Redaction uses
`URLSearchParams`, so query strings use its encoding, including `%5BREDACTED%5D`
for `[REDACTED]`. The redactor also scans other string attributes and string
arrays for HTTP URLs and slash-prefixed paths with query parameters.

The rules live in two redactors that the span and log record processors share:
[`QueryParamsRedactor`](../../app/instrumentation/query-params-redactor.server.ts)
and
[`AttributeRedactor`](../../app/instrumentation/attribute-redactor.server.ts).
Each processor takes a redactor instance, and the preload creates one of each
for both signals. Pass options to the redactor constructor.

`QueryParamsRedactor` accepts these optional overrides:

- `urlAttributeKeys` replaces the URL attribute list.
- `queryAttributeKeys` replaces the standalone query attribute list.
- `redactRules` selects which decoded query parameters to redact, using the
  same rule shape as `AttributeRedactor` (described below). Key rules match the
  parameter name and replace its whole value. Value rules replace matching text
  inside the parameter value. The default rule redacts every parameter value.
  Supplied rules replace it, and an empty list disables parameter redaction.
- `scanOtherStringAttributes` controls the scan of string attributes outside the
  configured URL and query attribute lists. It defaults to `true`.
- `embeddedUrlPatterns` replaces the patterns that find URLs and paths in text.
  Each pattern must match the complete URL or path, including its query string.
  Add patterns without losing the defaults by spreading
  `DEFAULT_REDACT_QUERY_PARAMS_OPTIONS.embeddedUrlPatterns`.
- `replacement` replaces `[REDACTED]`. It can be a string or a callback, and
  each rule can override it. Callbacks receive the decoded parameter name as
  `key` and its decoded value as `value`. Replacements are encoded as parameter
  values, so they cannot add parameters.

For example, this redactor hides authorization codes and states with a
distinct marker, any parameter whose name contains `token`, and nine-digit
numbers in other parameter values:

```typescript
const queryParamsRedactor = new QueryParamsRedactor({
  redactRules: [
    { type: 'key', match: 'pattern', value: /^(code|state)$/i, replacement: '[AUTH]' },
    { type: 'key', match: 'substring', value: 'token' },
    { type: 'value', pattern: /\b\d{3}[ -]?\d{3}[ -]?\d{3}\b/g },
  ],
});
```

The default `embeddedUrlPatterns` match HTTP URLs and slash-prefixed paths with
at least one `name=value` query parameter. To recognize another format, add a
pattern to the defaults:

```typescript
const queryParamsRedactor = new QueryParamsRedactor({
  embeddedUrlPatterns: [...DEFAULT_REDACT_QUERY_PARAMS_OPTIONS.embeddedUrlPatterns, /provider\?[^,\s]+/i],
});
```

`AttributeRedactor` uses one `redactRules` list. A key rule can match the full
attribute key, a substring within it, or a regular expression. A matching key rule
replaces the whole attribute value. A value rule applies a regular expression to
strings and string arrays, regardless of the attribute key. It replaces only the
matching text.

The default rules match `db.statement`, `http.request.body`, and `user.email`
exactly. They also match keys containing `password`, `secret`, `token`, `apikey`,
`api_key`, `authorization`, `credential`, `ssn`, `credit_card`, or `cookie`.
Value rules redact email addresses, 16-digit card-like numbers, bearer tokens,
and AWS access key IDs. These patterns are best-effort matches, not a complete
detector of personal data.

Exact key matches ignore case and accents. Substring matches ignore case.
Key rules with `match: 'pattern'` take a `RegExp` in `value` and follow its flags;
use `i` for case-insensitive matching. Stateful expressions are safe to reuse
across attributes and redaction calls without changing the caller's `lastIndex`.
`redactRules` replaces the default rule list when supplied. Pass an empty list to
disable attribute redaction, or spread
`DEFAULT_REDACT_ATTRIBUTES_OPTIONS.redactRules` to extend the defaults.

Each rule can set its own optional `replacement`, as a string or callback,
overriding the global `replacement` option. An empty string is also a valid
override. Callbacks receive `{ key, value }`: the original attribute value for
key rules, or the current string before that rule for value rules. Non-string
attribute values are passed without stringification. Value callbacks run only
for matching text, once per match, and their returned strings are inserted
literally.

The first matching key rule redacts the whole value before any value rules run.
Put key-rule overrides before default rules when extending the list. If no key
rule matches, value rules run in list order.

Both redactor modules export their `DEFAULT_REDACT_*_OPTIONS` objects for callers
that want to extend a default list rather than replace it.

For example, this pipeline redacts only the `token` query parameter, customizes
the replacement for credit-card keys, and adds `customer.id` to the default keys:

```typescript
const queryParamsRedactor = new QueryParamsRedactor({ redactRules: [{ type: 'key', match: 'exact', value: 'token' }] });
const attributeRedactor = new AttributeRedactor({
  redactRules: [{ type: 'key', match: 'pattern', value: /.*credit_card.*/gi, replacement: '[CARD]' }, ...DEFAULT_REDACT_ATTRIBUTES_OPTIONS.redactRules, { type: 'key', match: 'exact', value: 'customer.id', replacement: ({ key }) => `[${key}]` }],
});
const processor = new RedactQueryParamsSpanProcessor(new RedactAttributesSpanProcessor(exportingProcessor, attributeRedactor), queryParamsRedactor);
```

These processors sanitize span attributes only. Span names, status descriptions,
event and link attributes, resource attributes, metrics, and URL fragments are
outside their scope. Do not record sensitive data in those fields.

## Log record redaction

When log export is enabled, the preload lists
[`RedactQueryParamsLogRecordProcessor`](../../app/instrumentation/redact-query-params-log-record-processor.server.ts)
and
[`RedactAttributesLogRecordProcessor`](../../app/instrumentation/redact-attributes-log-record-processor.server.ts)
before the batch exporting processor, using the same redactors as spans.

Query redaction applies the URL and query attribute rules to log record
attributes and map-body entries with matching keys. It also scans other string
attributes and string arrays for URLs and paths with query parameters. For map
bodies, it scans other top-level string values and string arrays the same way.
For string bodies, it finds URLs and paths embedded in text, such as
`request: [/en/apply?token=abc]`, and redacts their query parameters. The
`scanOtherStringAttributes` option does not disable scans of string bodies.
The `embeddedUrlPatterns` option controls the patterns used for string
attributes, map-body entries, and string bodies.

Attribute redaction applies its rules to log record attributes and to the
top-level keys of a map body. It applies the value patterns to a string body.
Nested map values in a body are not inspected.

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
