import { ProviderRegistry } from '@sentinel/providers';
import { ToolRegistry, type Tool } from '@sentinel/tools';
import { z } from 'zod';
import { Agent, InMemoryMemoryPort } from '../src';

describe('Agent tool idempotency', () => {
  it('does not execute the same tool call twice when idempotencyKey matches', async () => {
    const providers = new ProviderRegistry();
    providers.register({
      name: 'planner',
      plan: async (input) => ({
        toolCalls: [
          {
            id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
            name: 'counter',
            args: {},
          },
        ],
        finalResponse: `ok:${input.request.message}`,
        trace: {
          requestId: input.options.requestId,
          sessionId: input.options.sessionId,
          steps: [
            {
              id: '3fa85f64-5717-4562-b3fc-2c963f66afa7',
              kind: 'plan',
              name: 'planner.plan',
              startedAt: '2026-01-11T00:00:00.000Z',
            },
          ],
        },
      }),
    });

    let executions = 0;
    const counterTool: Tool = {
      name: 'counter',
      description: 'counter',
      risk: 'safe',
      argsSchema: z.object({}).strict(),
      execute: async () => {
        executions += 1;
        return executions;
      },
    };

    const tools = new ToolRegistry();
    tools.register(counterTool);

    const memory = new InMemoryMemoryPort();
    const agent = new Agent({
      providers,
      memory,
      tools,
      toolExecution: { timeoutMs: 50, outputLimitBytes: 10_000 },
    });

    const sessionId = '3fa85f64-5717-4562-b3fc-2c963f66afa1';
    const idempotencyKey = 'idem-1';

    const res1 = await agent.runTurn({
      sessionId,
      requestId: '3fa85f64-5717-4562-b3fc-2c963f66afa2',
      idempotencyKey,
      message: 'hi',
      provider: 'planner',
      toolPolicy: { mode: 'safe' },
    });

    const res2 = await agent.runTurn({
      sessionId,
      requestId: '3fa85f64-5717-4562-b3fc-2c963f66afa3',
      idempotencyKey,
      message: 'hi',
      provider: 'planner',
      toolPolicy: { mode: 'safe' },
    });

    expect(executions).toBe(1);
    expect(res1.toolResults[0].ok).toBe(true);
    expect(res2.toolResults[0].ok).toBe(true);
    expect(res2.toolResults[0].result).toBe(1);
  });
});

