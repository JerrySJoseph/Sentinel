import { ProviderRegistry } from '@sentinel/providers';
import { ToolRegistry, type Tool } from '@sentinel/tools';
import { ConcurrencyLimiter, InMemoryConcurrencyStore } from '@sentinel/observability';
import { z } from 'zod';
import { Agent, AgentBusyError, InMemoryMemoryPort } from '../src';

describe('Agent concurrency guardrails', () => {
  it('fails fast with PROVIDER_BUSY when provider concurrency is saturated', async () => {
    const providers = new ProviderRegistry();

    let started!: () => void;
    const providerStarted = new Promise<void>((r) => {
      started = r;
    });
    let finish!: () => void;
    const providerFinish = new Promise<void>((r) => {
      finish = r;
    });

    providers.register({
      name: 'slow-provider',
      plan: async (input) => {
        started();
        await providerFinish;
        return {
          toolCalls: [],
          finalResponse: `ok:${input.request.message}`,
          trace: {
            requestId: input.options.requestId,
            sessionId: input.options.sessionId,
            steps: [
              {
                id: '3fa85f64-5717-4562-b3fc-2c963f66afa7',
                kind: 'plan',
                name: 'slow-provider.plan',
                startedAt: '2026-01-11T00:00:00.000Z',
              },
            ],
          },
        };
      },
    });

    const store = new InMemoryConcurrencyStore();
    const providerLimiter = new ConcurrencyLimiter(store, {
      key: 'conc:provider',
      limit: 1,
      leaseTtlMs: 60_000,
    });

    const agent = new Agent({
      providers,
      memory: new InMemoryMemoryPort(),
      tools: new ToolRegistry(),
      toolExecution: { timeoutMs: 5_000, outputLimitBytes: 10_000 },
      concurrency: { provider: providerLimiter },
    });

    const p1 = agent.runTurn({ message: 'one', provider: 'slow-provider', toolPolicy: { mode: 'safe' } });
    await providerStarted;

    await expect(
      agent.runTurn({ message: 'two', provider: 'slow-provider', toolPolicy: { mode: 'safe' } })
    ).rejects.toBeInstanceOf(AgentBusyError);

    await expect(
      agent.runTurn({ message: 'two', provider: 'slow-provider', toolPolicy: { mode: 'safe' } })
    ).rejects.toMatchObject({ code: 'PROVIDER_BUSY' });

    finish();
    await expect(p1).resolves.toEqual(expect.objectContaining({ finalResponse: 'ok:one' }));
  });

  it('fails fast with TOOL_BUSY when tool executor concurrency is saturated', async () => {
    const providers = new ProviderRegistry();
    providers.register({
      name: 'planner',
      plan: async (input) => ({
        toolCalls: [
          {
            id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
            name: 'slow',
            args: {},
          },
        ],
        finalResponse: 'done',
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

    let toolStarted!: () => void;
    const toolStartedP = new Promise<void>((r) => {
      toolStarted = r;
    });
    let toolFinish!: () => void;
    const toolFinishP = new Promise<void>((r) => {
      toolFinish = r;
    });

    const slowTool: Tool = {
      name: 'slow',
      description: 'slow',
      risk: 'safe',
      argsSchema: z.object({}).strict(),
      execute: async () => {
        toolStarted();
        await toolFinishP;
        return 'ok';
      },
    };

    const tools = new ToolRegistry();
    tools.register(slowTool);

    const store = new InMemoryConcurrencyStore();
    const toolLimiter = new ConcurrencyLimiter(store, {
      key: 'conc:tool',
      limit: 1,
      leaseTtlMs: 60_000,
    });

    const agent = new Agent({
      providers,
      memory: new InMemoryMemoryPort(),
      tools,
      toolExecution: { timeoutMs: 5_000, outputLimitBytes: 10_000 },
      concurrency: { tool: toolLimiter },
    });

    const p1 = agent.runTurn({ message: 'one', provider: 'planner', toolPolicy: { mode: 'safe' } });
    await toolStartedP;

    await expect(
      agent.runTurn({ message: 'two', provider: 'planner', toolPolicy: { mode: 'safe' } })
    ).rejects.toMatchObject({ code: 'TOOL_BUSY' });

    toolFinish();
    await expect(p1).resolves.toEqual(expect.objectContaining({ finalResponse: 'done' }));
  });
});

