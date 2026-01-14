# Go-live checklist (agent-core v0.1.x)

This checklist is meant to answer one question: **can we safely run `agent-core` in production and debug it when it misbehaves?**

- Scope: `apps/agent-core` + critical shared packages (`packages/contracts`, `packages/agent`, `packages/tools`, `packages/providers`, `packages/memory`, `packages/observability`, `packages/config`)
- Principle: **P0 items are blockers**. P1/P2 can be scheduled but should be consciously accepted.

---

## P0 — Go-live blockers (must be done)

### Quality gates are enforced

- **CI runs lint + typecheck**
  - **Acceptance**: `.github/workflows/ci.yml` runs `pnpm lint` and `pnpm typecheck` and fails the workflow when either fails.
  - **Verify**: PR with a deliberate lint error fails CI.

- **Workspace lint passes locally**
  - **Acceptance**: `pnpm lint` succeeds from repo root.
  - **Notes**:
    - Fix TS-eslint project config so `eslint "{src,test}/**/*.ts"` does not error on test files (common approach: add a `tsconfig.eslint.json` per package that includes `src` + `test`).
    - Fix formatting violations (`prettier/prettier`) and ensure `lint` does not auto-fix in CI unless explicitly intended.
  - **Verify**: `pnpm lint` (root) returns exit code 0.

### Network controls (safety + abuse prevention)

- **Rate limiting uses a trustworthy client identifier**
  - **Acceptance**: IP-derived keys cannot be spoofed by user-supplied `x-forwarded-for` unless the app is explicitly configured to trust the upstream proxy.
  - **Implementation options** (choose one, document it):
    - Configure Express `trust proxy` and only use XFF when trusted.
    - Ignore XFF entirely and rely on `req.ip` (best only when running without a proxy).
    - Prefer a gateway-provided header (e.g., `x-real-ip`) with strict trust rules.
  - **Verify**: With `trust proxy=false`, sending different `x-forwarded-for` does not change the limiter key.

- **Provider HTTP calls have explicit timeouts**
  - **Acceptance**: OpenAI/Anthropic adapters enforce timeouts (connect + overall request) and return a structured provider error on timeout.
  - **Verify**: Inject a very small timeout and ensure requests fail fast and are normalized by the API error model.

### Health and readiness are meaningful

- **Liveness and readiness are separated**
  - **Acceptance**:
    - `/health` remains **fast and stable** (process is up).
    - Add `/health/ready` (or similar) that checks **database connectivity** at minimum; Redis readiness is optional if Redis is configured as “optional”.
  - **Verify**:
    - Kill Postgres: `/health` still returns 200 (optional), `/health/ready` returns 503.
    - Restore Postgres: `/health/ready` returns 200.

### Production container hardening

- **Run as non-root in containers**
  - **Acceptance**: `agent-core` container runs with a non-root UID/GID.
  - **Verify**: `id` inside container shows non-root.

- **Migration strategy is safe for multiple replicas**
  - **Acceptance**: Migrations are not run concurrently by multiple replicas without coordination.
  - **Recommended**: run migrations as a separate one-off job during deploy (or leader-election/lock strategy if you must run on start).
  - **Verify**: Start 2+ replicas; no migration race or crash loops.

---

## P1 — Strongly recommended before first real customers

### Observability and debugging

- **Structured logger**
  - **Acceptance**: logs are emitted as JSON objects (not JSON strings) with consistent fields:
    - `msg`, `level`, `ts`, `requestId`, `sessionId` (if present), `traceId/spanId` (if present)
  - **Verify**: log pipeline parses fields without regex extraction.

- **Error budget hygiene**
  - **Acceptance**:
    - bounded metric labels (already done for HTTP route); ensure any future labels remain bounded
    - provider/tool error codes are normalized and counted (already done)
  - **Verify**: `GET /metrics` shows `sentinel_errors_total{code,status_code}` incrementing on errors.

- **Request timeout**
  - **Acceptance**: the API enforces an upper bound on request processing time for `/v1/chat` (separate from tool/provider timeouts).
  - **Verify**: artificially long request returns a structured timeout error.

### Security defaults

- **Tool policy is externally configurable**
  - **Acceptance**: tool policy mode is not hardcoded to `{ mode: 'safe' }`; it is derived from config and defaults to safe.
  - **Verify**: switching config enables developer tools only when explicitly allowed.

- **CORS hardened**
  - **Acceptance**: in production, `CORS_ORIGINS` must be explicitly set and cannot silently default to localhost allowlist.
  - **Verify**: missing `CORS_ORIGINS` in production fails fast or defaults to deny (documented behavior).

### Persistence and data lifecycle

- **Retention policy for sessions/messages/tool runs**
  - **Acceptance**: documented retention and deletion approach (cron job, soft delete, TTL tables, etc.).
  - **Verify**: operator can delete a session and verify cascading delete (or soft delete behavior).

- **PII policy**
  - **Acceptance**: clear policy on what user content is stored and how it can be exported/erased.

---

## P2 — Nice-to-have (post go-live)

- **OpenTelemetry SDK integration**
  - Export traces to OTLP and connect trace IDs across gateway → agent-core → provider calls → tool calls.

- **Request/response sampling**
  - Ability to sample traces/log details for debugging without storing everything.

- **Circuit breakers**
  - Provider circuit breaker to fail fast during upstream incidents.

- **API documentation**
  - OpenAPI/Swagger generation (still validate with Zod; OpenAPI is for humans).

---

## Operational sign-off (one-time per environment)

- **Secrets**
  - Provider keys stored in a secrets manager (not env files committed anywhere).
- **Backups**
  - Postgres backups enabled + restore drill performed.
- **Alerts**
  - Alerts on:
    - elevated `sentinel_errors_total`
    - p95 latency on `sentinel_http_request_duration_seconds`
    - DB connectivity failures (readiness)
    - restarts/crash loops

