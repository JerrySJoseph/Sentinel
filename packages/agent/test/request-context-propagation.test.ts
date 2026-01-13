import { ProviderRegistry } from '@sentinel/providers';
import { ToolRegistry, type Tool } from '@sentinel/tools';
import { z } from 'zod';
import { Agent, InMemoryMemoryPort } from '../src';
import { getRequestContext, runWithRequestContext } from '@sentinel/observability';

describe('request context propagation', () => {
  it('is available inside provider calls and tool execution', async () => {
    const providers = new ProviderRegistry();
    providers.register({
      name: 'ctx-provider',
      plan: async (input) => {
        const ctx = getRequestContext();
        return {
          toolCalls: [
            {
              id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
              name: 'ctx-tool',
              args: {},
            },
          ],
          finalResponse: `rid:${ctx?.requestId ?? 'none'} sid:${ctx?.sessionId ?? 'none'}`,
          trace: {
            requestId: input.options.requestId,
            sessionId: input.options.sessionId,
            steps: [
              {
                id: '3fa85f64-5717-4562-b3fc-2c963f66afa7',
                kind: 'plan',
                name: 'ctx-provider.plan',
                startedAt: '2026-01-11T00:00:00.000Z',
              },
            ],
          },
        };
      },
    });

    const ctxTool: Tool = {
      name: 'ctx-tool',
      description: 'returns request context',
      risk: 'safe',
      argsSchema: z.object({}).strict(),
      execute: async () => {
        const ctx = getRequestContext();
        return { requestId: ctx?.requestId ?? null, sessionId: ctx?.sessionId ?? null };
      },
    };

    const tools = new ToolRegistry();
    tools.register(ctxTool);

    const agent = new Agent({
      providers,
      memory: new InMemoryMemoryPort(),
      tools,
      toolExecution: { timeoutMs: 1000, outputLimitBytes: 10_000 },
    });

    const requestId = '3fa85f64-5717-4562-b3fc-2c963f66afa1';
    const sessionId = '3fa85f64-5717-4562-b3fc-2c963f66afa2';

    const res = await runWithRequestContext(
      { requestId, sessionId, traceId: 'trace-1', spanId: 'span-1' },
      async () =>
        await agent.runTurn({
          requestId,
          sessionId,
          message: 'hello',
          provider: 'ctx-provider',
          toolPolicy: { mode: 'safe' },
        })
    );

    expect(res.finalResponse).toBe(`rid:${requestId} sid:${sessionId}`);
    expect(res.toolResults[0].ok).toBe(true);
    expect(res.toolResults[0].result).toEqual(
      expect.objectContaining({ requestId, sessionId })
    );
  });
});

