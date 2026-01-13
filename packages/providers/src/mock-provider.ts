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

    const msg = input.request.message ?? '';
    const finalResponse = `MockProvider: ${msg}`;

    // For dev/testing: allow exercising multiple tools deterministically.
    // - "echo <text>" -> echo tool
    // - otherwise -> calculator tool
    const echoMatch = msg.match(/^echo\s+([\s\S]+)$/i);
    // IMPORTANT: toolCall.id must be stable across retries when the same idempotency-key is used.
    // If we tie it to requestId, idempotency cannot work (requestId changes per request).
    const stableToolCallId = '3fa85f64-5717-4562-b3fc-2c963f66afa6';
    const toolCall =
      echoMatch
        ? {
            id: stableToolCallId,
            name: 'echo',
            args: { text: echoMatch[1] },
          }
        : {
            id: stableToolCallId,
            name: 'calculator',
            args: { expression: '1 + 2 * 3' },
          };

    const output = {
      toolCalls: [toolCall],
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
            input: { message: msg },
            output: { toolCalls: 1, finalResponse },
          },
        ],
      },
    };

    return PlanOutputSchema.parse(output);
  }
}

