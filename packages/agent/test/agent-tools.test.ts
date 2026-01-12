import { ProviderRegistry } from '@sentinel/providers';
import { CalculatorTool, ToolRegistry, type Tool } from '@sentinel/tools';
import { Agent, InMemoryMemoryPort } from '../src';
import { z } from 'zod';

describe('Agent tool execution', () => {
  it('executes calculator tool call returned by provider', async () => {
    const providers = new ProviderRegistry();
    providers.register({
      name: 'planner',
      plan: async (input) => ({
        toolCalls: [
          {
            id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
            name: 'calculator',
            args: { expression: '1 + 2 * 3' },
          },
        ],
        finalResponse: 'computed',
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

    const tools = new ToolRegistry();
    tools.register(new CalculatorTool());

    const agent = new Agent({
      providers,
      memory: new InMemoryMemoryPort(),
      tools,
      toolExecution: { timeoutMs: 50, outputLimitBytes: 10_000 },
    });

    const res = await agent.runTurn({
      message: 'do math',
      provider: 'planner',
      toolPolicy: { mode: 'safe' },
    });

    expect(res.toolResults).toHaveLength(1);
    expect(res.toolResults[0].ok).toBe(true);
    expect(res.toolResults[0].name).toBe('calculator');
    expect(res.toolResults[0].result).toBe(7);

    const toolSteps = res.trace.steps.filter((s) => s.kind === 'tool');
    expect(toolSteps).toHaveLength(1);
    expect(toolSteps[0].name).toBe('calculator');
  });

  it('rejects unknown tool but continues and returns toolResults', async () => {
    const providers = new ProviderRegistry();
    providers.register({
      name: 'planner',
      plan: async (input) => ({
        toolCalls: [
          {
            id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
            name: 'missing_tool',
            args: {},
          },
        ],
        finalResponse: 'no tool',
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

    const agent = new Agent({
      providers,
      memory: new InMemoryMemoryPort(),
      tools: new ToolRegistry(),
      toolExecution: { timeoutMs: 50, outputLimitBytes: 10_000 },
    });

    const res = await agent.runTurn({
      message: 'x',
      provider: 'planner',
      toolPolicy: { mode: 'safe' },
    });

    expect(res.toolResults).toHaveLength(1);
    expect(res.toolResults[0].ok).toBe(false);
    expect(res.toolResults[0].error?.code).toBe('TOOL_NOT_FOUND');
  });

  it('marks tool timeout in toolResults', async () => {
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

    const tools = new ToolRegistry();
    const slowTool: Tool = {
      name: 'slow',
      description: 'slow',
      risk: 'safe',
      argsSchema: z.object({}).strict(),
      execute: async () => new Promise((resolve) => setTimeout(() => resolve('ok'), 50)),
    };
    tools.register(slowTool);

    const agent = new Agent({
      providers,
      memory: new InMemoryMemoryPort(),
      tools,
      toolExecution: { timeoutMs: 5, outputLimitBytes: 10_000 },
    });

    const res = await agent.runTurn({
      message: 'x',
      provider: 'planner',
      toolPolicy: { mode: 'safe' },
    });

    expect(res.toolResults).toHaveLength(1);
    expect(res.toolResults[0].ok).toBe(false);
    expect(res.toolResults[0].error?.code).toBe('TIMEOUT');
  });

  it('reuses tool result when idempotencyKey is the same', async () => {
    const providers = new ProviderRegistry();
    providers.register({
      name: 'planner',
      plan: async (input) => ({
        toolCalls: [
          {
            id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
            name: 'calculator',
            args: { expression: '1 + 2 * 3' },
          },
        ],
        finalResponse: 'computed',
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

    const tools = new ToolRegistry();
    tools.register(new CalculatorTool());

    const agent = new Agent({
      providers,
      memory: new InMemoryMemoryPort(),
      tools,
      toolExecution: { timeoutMs: 50, outputLimitBytes: 10_000 },
    });

    const sessionId = '3fa85f64-5717-4562-b3fc-2c963f66afa1';

    const r1 = await agent.runTurn({
      sessionId,
      requestId: '3fa85f64-5717-4562-b3fc-2c963f66afa2',
      idempotencyKey: 'idem-1',
      message: 'x',
      provider: 'planner',
      toolPolicy: { mode: 'safe' },
    });

    const r2 = await agent.runTurn({
      sessionId,
      requestId: '3fa85f64-5717-4562-b3fc-2c963f66afa3',
      idempotencyKey: 'idem-1',
      message: 'x',
      provider: 'planner',
      toolPolicy: { mode: 'safe' },
    });

    expect(r1.toolResults[0].result).toBe(7);
    expect(r2.toolResults[0].result).toBe(7);

    const toolSteps2 = r2.trace.steps.filter((s) => s.kind === 'tool');
    expect(toolSteps2.length).toBe(1);
    expect((toolSteps2[0].input as any).reused).toBe(true);
  });
});

