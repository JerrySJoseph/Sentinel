import { PlanOutputSchema, type PlanOutput } from '@sentinel/contracts';
import { ProviderDisabledInTestError } from './errors';
import type { PlanInput, ToggleableProvider } from './types';

/**
 * ExampleProvider
 *
 * A deterministic provider intended as a template for building real LLM adapters.
 *
 * Key properties:
 * - Produces a strictly structured plan output (validated by PlanOutputSchema)
 * - Is config-gated via EXAMPLE_PROVIDER_ENABLED
 * - Makes NO external network calls (safe for unit tests)
 */
export class ExampleProvider implements ToggleableProvider {
  readonly name = 'example';

  static fromEnv(): ExampleProvider {
    return new ExampleProvider({ enabled: process.env.EXAMPLE_PROVIDER_ENABLED === 'true' });
  }

  constructor(private readonly opts: { enabled?: boolean } = {}) {}

  isEnabled(): boolean {
    // Hard rule: never make external calls in tests; template follows same pattern.
    if (process.env.NODE_ENV === 'test') return false;
    return Boolean(this.opts.enabled);
  }

  async plan(input: PlanInput): Promise<PlanOutput> {
    // Defensive: ensure we don't accidentally use this in tests.
    if (process.env.NODE_ENV === 'test') throw new ProviderDisabledInTestError(this.name);

    const startedAt = new Date().toISOString();
    const endedAt = startedAt;
    const message = input.request.message ?? '';

    const output: unknown = {
      toolCalls: [],
      finalResponse: `ExampleProvider: ${message}`,
      trace: {
        requestId: input.options.requestId,
        sessionId: input.options.sessionId,
        steps: [
          {
            id: input.options.requestId,
            kind: 'provider',
            name: 'example.plan',
            startedAt,
            endedAt,
            durationMs: 0,
            input: { message },
            output: { toolCalls: 0, finalResponse: `ExampleProvider: ${message}` },
          },
        ],
      },
    };

    // Strict runtime validation is mandatory.
    return PlanOutputSchema.parse(output);
  }
}

