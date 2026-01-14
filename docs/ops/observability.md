# Observability (Operations Guide)

This guide describes Sentinel’s current observability surface area and how to integrate it with common ops stacks.

## Prometheus metrics (`/metrics`)

`agent-core` exposes a Prometheus-compatible endpoint:

- **Endpoint**: `GET /metrics`
- **Format**: Prometheus text exposition (`text/plain; version=0.0.4`)

### Quick check

```bash
curl -sS http://localhost:3000/metrics | head
```

### Key metrics exposed

Sentinel prefixes all custom metrics with `sentinel_` to avoid collisions.

#### HTTP

- **`sentinel_http_requests_total{method,route,status_code}`**
  - Count of completed HTTP requests.
  - `route` is **bounded**: it uses the matched route template when available, otherwise `unknown`.
- **`sentinel_http_request_duration_seconds{method,route,status_code}`**
  - Latency histogram for HTTP requests.

#### Agent + execution

- **`sentinel_agent_turn_duration_seconds`**
  - Duration histogram for `Agent.runTurn`.
- **`sentinel_provider_call_duration_seconds{provider}`**
  - Provider planning call latency (label is provider name; bounded by registry).
- **`sentinel_tool_execution_duration_seconds{tool}`**
  - Tool execution latency (label is tool name; bounded by registry).

#### Errors

- **`sentinel_errors_total{code,status_code}`**
  - Count of error responses returned by the API (code is the normalized Sentinel error code).

> Note: `prom-client` also exposes default Node.js process metrics (GC, event loop, memory, etc.).

### Example Prometheus scrape config

```yaml
scrape_configs:
  - job_name: "sentinel-agent-core"
    metrics_path: /metrics
    scrape_interval: 15s
    static_configs:
      - targets: ["localhost:3000"]
```

If running under Docker Compose, target the exposed host port (e.g. `localhost:3000`) or scrape from within the same network using the service name (e.g. `agent-core:3000`) depending on where Prometheus runs.

## OpenTelemetry tracing (context + exporters)

### Current state (today)

Sentinel currently supports **trace context propagation**:

- Accepts **W3C** `traceparent` on inbound HTTP requests
- Also accepts `x-trace-id` / `x-span-id`
- Stores these values in request-scoped context (AsyncLocalStorage)
- Echoes `x-trace-id` / `x-span-id` back on responses when present

This enables correlation even before full OpenTelemetry SDK tracing is enabled.

### Exporters (recommended configuration)

Full OpenTelemetry trace exporting (console or OTLP) is typically done by initializing the OpenTelemetry SDK in the `agent-core` process.

Common environment variables used by most OpenTelemetry SDK setups:

- **Console exporter (local dev)**
  - `OTEL_TRACES_EXPORTER=console`
- **OTLP exporter (production)**
  - `OTEL_TRACES_EXPORTER=otlp`
  - `OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318` (HTTP) or `http://otel-collector:4317` (gRPC)
- Resource metadata:
  - `OTEL_SERVICE_NAME=sentinel-agent-core`
  - `OTEL_RESOURCE_ATTRIBUTES=service.version=0.1.0,deployment.environment=dev`

If you deploy an OpenTelemetry Collector, prefer exporting via OTLP to the collector and then fan out to your backend (Tempo/Jaeger/Honeycomb/etc.).

## Structured logs + correlation fields

`agent-core` emits structured JSON logs for request completion. Correlation fields are automatically added via request-scoped context:

- **`requestId`**: always present (also returned as `x-request-id`)
- **`sessionId`**: present when known (e.g. chat requests)
- **`traceId` / `spanId`**: present when provided via incoming headers (`traceparent` or `x-trace-id` / `x-span-id`)

Example (shape):

```json
{
  "msg": "request_completed",
  "requestId": "…",
  "sessionId": "…",
  "traceId": "…",
  "spanId": "…",
  "method": "POST",
  "path": "/v1/chat",
  "statusCode": 200,
  "durationMs": 42
}
```

### Log/trace correlation tips

- If you run a reverse proxy / gateway, propagate `traceparent` end-to-end.
- Configure your log pipeline to index `requestId` and `traceId` as searchable fields.
- In the UI, you can display `requestId` and `traceId` from response headers to help operators correlate client errors with server logs and traces.

