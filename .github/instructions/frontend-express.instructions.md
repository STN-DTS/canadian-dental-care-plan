---
applyTo: "frontend/app/.server/express-server/**/*.ts"
---

# Frontend Express Middleware Naming

- Use `*Middleware` for Express middleware, `*Handler` for request or route logic, `*ErrorHandler` for error middleware, `*Router` for routers, and `*App` for applications.
- Use `configure*` for app setup and `create*Middleware` for middleware factories.
- If a factory returns a meaningfully named middleware or request handler, register it directly. If it returns an anonymous function, assigning it to a named variable does not change its `name`; use a named wrapper when stable OpenTelemetry middleware naming matters.
- Keep registered middleware names stable when telemetry, dashboards, alerts, or diagnostics depend on them.
- See [frontend Express documentation](../../frontend/other/docs/express.md) for detailed naming guidance and examples.
