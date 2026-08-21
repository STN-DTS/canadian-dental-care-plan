# Welcome to Remix

- [Remix Docs](https://remix.run/docs)

## Development

From your terminal:

```sh
npm run dev
```

This starts your app in development mode, rebuilding assets on file changes.

## Deployment

First, build your app for production:

```sh
npm run build
```

Then run the app in production mode:

```sh
npm start
```

Now you'll need to pick a host to deploy it to.

## OpenTelemetry ESM Bootstrap

The server is an ECMAScript Module (ESM) application. OpenTelemetry must be
preloaded before server modules import Express or other instrumented packages.
The `dev`, `preview`, and `start` scripts already preload the OpenTelemetry
bootstrap with Node's `--import` flag.

Do not start the server entry point directly. Use the package scripts so the
instrumentation loader runs before application imports:

```sh
npm run dev
npm run preview
npm start
```

See the [OpenTelemetry ESM support guidance](https://github.com/open-telemetry/opentelemetry-js/blob/main/doc/esm-support.md)
for loader requirements and startup details.

See [express.md](other/docs/express.md) for the named middleware
wrapper pattern for preserving meaningful OpenTelemetry middleware metadata and
span names.

### Local OTLP stack

The repository includes a local-only Podman Compose stack for testing all
application telemetry signals:

- Grafana Alloy receives OTLP/HTTP from the frontend.
- Loki stores logs.
- Prometheus stores metrics.
- Tempo stores traces.
- Grafana provides one UI for all three backends.

#### Start stack

```sh
podman compose -f compose.otel-local.yaml up -d
```

Add these values to frontend `.env` before starting the server. They point to
Alloy, not directly to Loki, Prometheus, or Tempo:

```sh
OTEL_API_KEY=local
OTEL_LOGS_ENDPOINT=http://127.0.0.1:4318/v1/logs
OTEL_METRICS_ENDPOINT=http://127.0.0.1:4318/v1/metrics
OTEL_TRACES_ENDPOINT=http://127.0.0.1:4318/v1/traces
OTEL_USE_CONSOLE_EXPORTERS=false
```

`OTEL_API_KEY=local` satisfies the frontend's local OTLP authentication
requirement. Local Alloy does not require authentication and ignores this
development-only header.

Start the frontend with:

```sh
npm run dev
```

Open Grafana at `http://localhost:3001`. New stacks use `admin` / `admin`.
Loki, Prometheus, and Tempo data sources are provisioned automatically.

#### Stop and preserve data

Named volumes store Alloy queue state, Grafana configuration, Loki logs,
Prometheus metrics, and Tempo traces. Normal stop, restart, and container
recreation preserve these volumes:

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

#### Delete data

Warning: `down -v` permanently deletes local telemetry volumes. Use only when
resetting the local observability stack is intentional:

```sh
podman compose -f compose.otel-local.yaml down -v
```

#### Inspect and back up data

Compose may prefix volume names with the project directory. List the actual
names before inspecting or exporting them:

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

### DIY

If you're familiar with deploying node applications, the built-in Remix app server is production-ready.

Make sure to deploy the output of `remix build`

- `build/`
- `public/build/`

## Development Guideline

### Method Naming Conventions (Repository and Service)

This document provides guidelines for naming repository methods in TypeScript Node.js applications, focusing on consistency, clarity, immutability, and domain-specific terminology.

#### General Principles

- **Clarity:** Method names should clearly convey their intent and be easily understandable to developers unfamiliar with the code.
- **Consistency:** Adhere to a consistent pattern for method names across the repository layer.
- **Domain Language:** Use domain-specific terminology to improve readability and relevance to the business logic.
- **CRUD Operations:** Follow standard CRUD method prefixes where applicable (e.g., `get`, `create`, `update`, `delete`).
- **Immutability:** Consider using immutable objects and arrays to avoid unintended side effects. Utilize TypeScript's readonly properties where appropriate.
- **Error Handling:** Consider whether methods should throw an error or return `null` when no result is found.

#### Method Naming Guidelines

##### Retrieval (Read) Operations

1. **`get`:** Used to retrieve a single entity or value that is expected to exist. If not found, it may throw an error or handle it based on use-case.
   - Repository Example: `getUserById(id: number): Promise<UserEntity>`

2. **`find`:** Used when searching for one or more entities where results might not be found. These methods typically return `null` or `undefined` for single items, or an empty list for collections.
   - Repository Example: `findUserByEmail(email: string): Promise<UserEntity | null>`

3. **`list`:** Used to retrieve collections without specific filtering criteria, typically returning a full list of entities.
   - Repository Example: `listAllUsers(): Promise<UserEntity[]>`

##### Creation (Create) Operations

- **`create`:** Used for creating a new entity. Methods should clearly indicate if any side effects occur, such as persisting to a database.
  - Repository Example: `createUser(user: UserEntity): Promise<UserEntity>`

##### Update Operations

- **`update`:** Used for updating an existing entity. It’s important to ensure proper type safety, especially if partial updates are allowed.
  - Repository Example: `updateUserDetails(id: number, userDetails: Partial<UserEntity>): Promise<UserEntity>`

##### Deletion Operations

- **`delete`:** Used to remove an entity, usually returning `void` or a boolean indicating success.
  - Repository Example: `deleteUser(id: number): Promise<void>`

#### Additional Considerations

- **Asynchronous Operations:** Most repository methods in a Node.js context will be asynchronous. Use `async/await` or promises, ensuring all returned data is properly handled in an async context.

- **Immutability:** To ensure that objects and arrays remain immutable, consider returning readonly objects or using libraries such as Immutable.js for deeper immutability. This prevents unintended mutations that may cause bugs and ensures data integrity.

- **Custom Methods:** Incorporate domain-specific custom methods where needed, ensuring the method names still adhere to the `get`, `find`, `list`, `create`, `update`, and `delete` convention.

#### Example

##### Repository Interface

```typescript
import { UserEntity } from '../entities/user.entity';

export interface UserRepository {
  // Read Operations
  getUserById(id: number): Promise<UserEntity>;
  findUserByEmail(email: string): Promise<UserEntity | null>;
  findUsersByRole(role: string): Promise<UserEntity[]>;
  listAllUsers(): Promise<UserEntity[]>;

  // Create Operation
  createUser(user: UserEntity): Promise<UserEntity>;

  // Update Operation
  updateUserDetails(id: number, userDetails: Partial<UserEntity>): Promise<UserEntity>;

  // Delete Operation
  deleteUser(id: number): Promise<void>;

  // Domain-Specific Methods
  findActiveUsersByDepartment(department: string): Promise<UserEntity[]>;
  findUsersByAgeRange(minAge: number, maxAge: number): Promise<UserEntity[]>;
}
```

### Key Points to Remember

1. **Use** `get` for retrieving entities that are expected to exist, often throwing an error if not found.

2. **Use** `find` when there is uncertainty about whether the entity exists, allowing for `null` results or empty collections.

3. **Use** `list` for retrieving broad, unfiltered collections of entities.

4. **Immutability:** Where appropriate, return immutable objects and arrays or use tools to enforce immutability.

5. **TypeScript's Types:** Utilize TypeScript’s type system fully to express precise types for arguments and return values.

6. **Error Handling:** Consider whether the method should throw exceptions (for `get`) or return `null` (for `find`).
