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

## Span attribute redaction

The telemetry preload wraps its exporting span processor with
[`RedactQueryParamsSpanProcessor`](../../app/instrumentation/redact-query-params-span-processor.ts)
and
[`RedactAttributesSpanProcessor`](../../app/instrumentation/redact-attributes-span-processor.ts).
Both sanitize copies of span attributes before forwarding them downstream.
They preserve span metadata and forward lifecycle calls, including flush and shutdown.

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
