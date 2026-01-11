import { PlanOutputSchema } from '@sentinel/contracts';
import { LLMProvider, PlanInput } from './types';

/**
 * Deterministic provider for tests/dev. Always returns the same shaped output
 * (with values derived from input), validated against PlanOutputSchema.
 */
export class MockProvider implements LLMProvider {
  readonly name = 'mock';

  async plan(input: PlanInput) {
    const startedAt = '2026-01-11T00:00:00.000Z';
    const endedAt = '2026-01-11T00:00:00.001Z';

    const finalResponse = `MockProvider: ${input.request.message}`;

    const output = {
      toolCalls: [
        {
          id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
          name: 'noop',
          args: {},
        },
      ],
      finalResponse,
      trace: {
        requestId: input.options.requestId,
        sessionId: input.options.sessionId,
        steps: [
          {
            id: '3fa85f64-5717-4562-b3fc-2c963f66afa7',
            kind: 'provider',
            name: 'mock.plan',
            startedAt,
            endedAt,
            durationMs: 1,
            input: { message: input.request.message },
            output: { toolCalls: 1, finalResponse },
          },
        ],
      },
    };

    return PlanOutputSchema.parse(output);
  }
}

