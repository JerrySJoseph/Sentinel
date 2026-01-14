import { PlanOutputSchema } from '@sentinel/contracts';
import { MockProvider } from '../src';

describe('MockProvider', () => {
  it('returns deterministic, schema-valid PlanOutput', async () => {
    const provider = new MockProvider();

    const out = await provider.plan({
      request: { message: 'hello' },
      options: {
        requestId: '3fa85f64-5717-4562-b3fc-2c963f66afa8',
        sessionId: '3fa85f64-5717-4562-b3fc-2c963f66afa9',
      },
    });

    expect(PlanOutputSchema.safeParse(out).success).toBe(true);
    expect(out.finalResponse).toBe('MockProvider: hello');
    expect(out.trace.requestId).toBe('3fa85f64-5717-4562-b3fc-2c963f66afa8');
    expect(out.toolCalls).toHaveLength(1);
    expect(out.toolCalls[0].name).toBe('calculator');
  });
});
