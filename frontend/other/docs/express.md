# Express

## Middleware naming

Give Express middleware meaningful function names when telemetry or diagnostics
use those names. A function can serve as a request handler while acting as
middleware when registered with `app.use(...)`:

### Role-based suffixes

- `*Middleware`: function registered with `app.use(...)`.
- `*Handler`: function handling request and response logic, especially route logic.
- `*ErrorHandler`: Express error middleware with `(error, req, res, next)`.
- `*Router`: Express router instance.
- `*App`: Express application instance.
- `configure*`: function that configures an Express app; it is not middleware itself.

Factories that return middleware should use `create*Middleware`, such as
`createSessionMiddleware` or `createSecurityHeadersMiddleware`.

### 1. Factory returns named middleware

Preferred pattern: factory and returned middleware both have meaningful names.
Register result directly; no intermediate variable or wrapper needed:

```ts
function createFeatureMiddleware(options) {
  return function featureMiddleware(request, response, next) {
    // Apply feature-specific middleware behavior.
    next();
  };
}

app.use(createFeatureMiddleware(options));
```

Factory name describes creation role. Returned function name is available to
Express and telemetry at runtime. Use behavior-specific names in application
code, such as `createSessionMiddleware` and `sessionMiddleware`.

### 2. Factory returns anonymous middleware

Use named wrapper when library factory returns anonymous middleware. Variable
name alone does not rename factory result:

```ts
const generatedMiddleware = createMiddleware(options);

function featureMiddleware(request, response, next) {
  return generatedMiddleware(request, response, next);
}

app.use(featureMiddleware);
```

### 3. Middleware defined directly

Name middleware defined in application code directly:

```ts
function featureMiddleware(request, response, next) {
  return next();
}

app.use(featureMiddleware);
```

### Runtime naming

Express OpenTelemetry instrumentation uses the registered function's `name`
property for middleware metadata and middleware span naming. Anonymous
middleware may appear as `<anonymous>`. Keep names stable when dashboards,
alerts, or diagnostics depend on them.

Treat middleware function names as an instrumentation contract, not only a
naming preference.
