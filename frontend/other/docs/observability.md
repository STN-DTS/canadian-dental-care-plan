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
the SDK configuration in `opentelemetry.ts` (or its built JavaScript output)
with `--import`. The production container uses the same hook and SDK preload.
Do not start the server entry point directly: ESM auto-instrumentation requires
the hook, and the SDK must start before application dependencies are imported.

The loader uses Node's asynchronous ESM loader mechanism. Node may print an
`ExperimentalWarning` about `--experimental-loader`; this is expected with the
currently documented OpenTelemetry entry point, not an SDK initialization failure.

See [Express conventions](express.md) for middleware naming rules that preserve
meaningful telemetry metadata and span names.

For OpenTelemetry ESM loader requirements, see the
[OpenTelemetry ESM support guidance](https://github.com/open-telemetry/opentelemetry-js/blob/main/doc/esm-support.md).
