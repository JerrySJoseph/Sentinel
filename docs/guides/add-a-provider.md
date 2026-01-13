# Add an LLM Provider Adapter (Step-by-step)

This guide explains how to add a new LLM provider adapter to Sentinel in a way that is **safe, testable, and production-ready**.

## Hard requirements (non-negotiable)

- **Structured output only**: providers must return a strict JSON object matching the shared contract.
  - Shape: `PlanOutput` (see `packages/contracts`)
  - No free-form “here’s a plan…” text. If using an external LLM API, you must force JSON output.
- **Runtime validation with Zod**:
  - Provider output must be validated using `PlanOutputSchema.parse(...)` before returning.
- **Config gating**:
  - Providers that require API keys must be disabled unless configured (e.g. `OPENAI_API_KEY`).
  - Use `ToggleableProvider.isEnabled()` so `ProviderRegistry` can reject disabled providers.
- **No external calls in tests**:
  - Providers must not call external APIs when `NODE_ENV === "test"`.
  - Unit tests must be deterministic and must not require API keys.

## Where providers live

- Provider interface: `packages/providers/src/types.ts`
- Provider registry: `packages/providers/src/provider-registry.ts`
- Built-in adapters live under: `packages/providers/src/adapters/`
- Deterministic dev provider: `packages/providers/src/mock-provider.ts`

## 1) Implement the provider

At minimum, implement `LLMProvider`:

- `name: string`
- `plan(input): Promise<PlanOutput>`

If it depends on configuration (API keys, base URLs, etc), implement `ToggleableProvider` and gate it via `isEnabled()`.

### Example: deterministic provider template

Sentinel includes a template provider you can copy:

- `packages/providers/src/example-provider.ts`

It demonstrates:

- strict `PlanOutputSchema` validation
- deterministic behavior
- config gating (`EXAMPLE_PROVIDER_ENABLED=true`)
- hard disable in tests

```1:62:/Volumes/Disk1/Projects/NestJS Projects/Sentinel/packages/providers/src/example-provider.ts
import { PlanOutputSchema, type PlanOutput } from '@sentinel/contracts';
import { ProviderDisabledInTestError } from './errors';
import type { PlanInput, ToggleableProvider } from './types';

export class ExampleProvider implements ToggleableProvider {
  readonly name = 'example';

  static fromEnv(): ExampleProvider {
    return new ExampleProvider({ enabled: process.env.EXAMPLE_PROVIDER_ENABLED === 'true' });
  }

  constructor(private readonly opts: { enabled?: boolean } = {}) {}

  isEnabled(): boolean {
    if (process.env.NODE_ENV === 'test') return false;
    return Boolean(this.opts.enabled);
  }

  async plan(input: PlanInput): Promise<PlanOutput> {
    if (process.env.NODE_ENV === 'test') throw new ProviderDisabledInTestError(this.name);
    // ...
    return PlanOutputSchema.parse(output);
  }
}
```

## 2) Export it from `@sentinel/providers`

Add an export from `packages/providers/src/index.ts`:

```1:8:/Volumes/Disk1/Projects/NestJS Projects/Sentinel/packages/providers/src/index.ts
export * from './types';
export * from './errors';
export * from './provider-registry';
export * from './mock-provider';
export * from './example-provider';
export * from './adapters/openai';
export * from './adapters/anthropic';
```

## 3) Register it at runtime

Providers are registered into `ProviderRegistry`. Example (in `agent-core` today we register `MockProvider`):

```18:23:/Volumes/Disk1/Projects/NestJS Projects/Sentinel/apps/agent-core/src/v1/chat/chat.service.ts
    const providers = new ProviderRegistry();
    providers.register(new MockProvider());
```

To use your provider in dev/production you’d typically:

- add `YourProvider.fromEnv()` (or equivalent)
- register it conditionally (registry will throw if disabled)
- allow selecting `provider` by name per request (already supported by `Agent.runTurn`)

## 4) How to implement a real external adapter (OpenAI/Anthropic pattern)

Real adapters should follow this pattern:

- `static fromEnv()` that reads required env vars
- `isEnabled()` returns `false` if missing config or if `NODE_ENV === "test"`
- `plan()`:
  - throws `ProviderDisabledInTestError` when `NODE_ENV === "test"`
  - makes exactly one HTTP call (per request)
  - forces the model to output JSON only
  - parses JSON
  - validates with `PlanOutputSchema.parse(...)`

Reference implementations:

- `packages/providers/src/adapters/openai.ts`
- `packages/providers/src/adapters/anthropic.ts`

## 5) Tests (must be deterministic)

Create unit tests that:

- validate the provider output against `PlanOutputSchema`
- verify config gating (disabled providers rejected by `ProviderRegistry`)
- never rely on external network calls or API keys

Example test file:

- `packages/providers/test/example-provider.test.ts`

```1:44:/Volumes/Disk1/Projects/NestJS Projects/Sentinel/packages/providers/test/example-provider.test.ts
import { PlanOutputSchema } from '@sentinel/contracts';
import { ExampleProvider, ProviderRegistry, ProviderRegistryError } from '../src';

describe('ExampleProvider', () => {
  it('returns deterministic, schema-valid PlanOutput', async () => {
    process.env.NODE_ENV = 'development';
    const provider = new ExampleProvider({ enabled: true });
    const out = await provider.plan({
      request: { message: 'hello' },
      options: { requestId: '3fa85f64-5717-4562-b3fc-2c963f66afa8', sessionId: '3fa85f64-5717-4562-b3fc-2c963f66afa9' },
    });
    expect(PlanOutputSchema.safeParse(out).success).toBe(true);
  });
});
```

## Notes / conventions

- Provider output must be **contract-shaped**; the agent will validate tool calls again before execution.
- When using external LLMs, **temperature must be 0** (or as close as possible) to reduce variability.
- Never let provider errors crash the process—throw structured errors and let the API translate them into safe responses.

