import {
  ProviderRegistry,
  ProviderNotFoundError,
  type LLMProvider,
  type PlanInput,
} from '@sentinel/providers';
import { ToolRegistry } from '@sentinel/tools';
import { Agent, InMemoryMemoryPort } from '../src';

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('Agent', () => {
  it('returns a ChatResponse for a direct response with no tools', async () => {
    const providers = new ProviderRegistry();
    providers.register({
      name: 'no-tools',
      plan: input =>
        Promise.resolve({
          toolCalls: [],
          finalResponse: `Echo: ${input.request.message}`,
          trace: {
            requestId: input.options.requestId,
            sessionId: input.options.sessionId,
            steps: [
              {
                id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
                kind: 'plan',
                name: 'no-tools.plan',
                startedAt: '2026-01-11T00:00:00.000Z',
              },
            ],
          },
        }),
    });

    const agent = new Agent({
      providers,
      memory: new InMemoryMemoryPort(),
      tools: new ToolRegistry(),
      toolExecution: { timeoutMs: 50, outputLimitBytes: 10_000 },
    });

    const res = await agent.runTurn({
      message: 'hello',
      provider: 'no-tools',
      toolPolicy: { mode: 'safe' },
    });

    expect(res.requestId).toMatch(UUID_V4_REGEX);
    expect(res.sessionId).toMatch(UUID_V4_REGEX);
    expect(res.latencyMs).toBeGreaterThanOrEqual(0);
    expect(res.finalResponse).toBe('Echo: hello');
    expect(res.toolCalls).toEqual([]);
    expect(res.toolResults).toEqual([]);
    expect(res.trace.requestId).toBe(res.requestId);
  });

  it('throws when provider is invalid', async () => {
    const agent = new Agent({
      providers: new ProviderRegistry(),
      memory: new InMemoryMemoryPort(),
      tools: new ToolRegistry(),
      toolExecution: { timeoutMs: 50, outputLimitBytes: 10_000 },
    });

    await expect(
      agent.runTurn({
        message: 'hello',
        provider: 'missing',
        toolPolicy: { mode: 'safe' },
      })
    ).rejects.toThrow(ProviderNotFoundError);
  });

  it('throws when provider returns invalid plan schema', async () => {
    const providers = new ProviderRegistry();
    const badProvider = {
      name: 'bad',
      plan: (_input: PlanInput): Promise<unknown> =>
        Promise.resolve({
          toolCalls: 'not-an-array',
          finalResponse: 123,
          trace: {},
        }),
    } as unknown as LLMProvider;

    providers.register(badProvider);

    const agent = new Agent({
      providers,
      memory: new InMemoryMemoryPort(),
      tools: new ToolRegistry(),
      toolExecution: { timeoutMs: 50, outputLimitBytes: 10_000 },
    });

    await expect(
      agent.runTurn({
        message: 'hello',
        provider: 'bad',
        toolPolicy: { mode: 'safe' },
      })
    ).rejects.toThrow();
  });
});
