import { z } from 'zod';
import { executeToolCall, ToolRegistry, type Tool } from '../src';

const TOOL_CALL = {
  id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  name: 'echo',
  args: { text: 'hello' },
} as const;

describe('executeToolCall', () => {
  it('returns ok=true for successful execution', async () => {
    const registry = new ToolRegistry();
    const tool: Tool<{ text: string }> = {
      name: 'echo',
      description: 'echo',
      risk: 'safe',
      argsSchema: z.object({ text: z.string() }).strict(),
      execute: async (args) => ({ echoed: args.text }),
    };
    registry.register(tool);

    const res = await executeToolCall({
      registry,
      toolCall: TOOL_CALL,
      policy: { mode: 'safe' },
      requestId: '3fa85f64-5717-4562-b3fc-2c963f66afa7',
      sessionId: '3fa85f64-5717-4562-b3fc-2c963f66afa8',
      timeoutMs: 50,
      outputLimitBytes: 10_000,
    });

    expect(res.ok).toBe(true);
    expect(res.name).toBe('echo');
    expect(res.result).toEqual({ echoed: 'hello' });
    expect(res.error).toBeUndefined();
  });

  it('returns ok=false with code=INVALID_TOOL_ARGS when args invalid', async () => {
    const registry = new ToolRegistry();
    registry.register({
      name: 'echo',
      description: 'echo',
      risk: 'safe',
      argsSchema: z.object({ text: z.string().min(2) }).strict(),
      execute: async () => 'ok',
    });

    const res = await executeToolCall({
      registry,
      toolCall: { ...TOOL_CALL, args: { text: 'x' } },
      policy: { mode: 'safe' },
      requestId: '3fa85f64-5717-4562-b3fc-2c963f66afa7',
      timeoutMs: 50,
      outputLimitBytes: 10_000,
    });

    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe('INVALID_TOOL_ARGS');
  });

  it('returns ok=false with code=TIMEOUT when tool times out', async () => {
    const registry = new ToolRegistry();
    registry.register({
      name: 'slow',
      description: 'slow',
      risk: 'safe',
      argsSchema: z.object({}).strict(),
      execute: async () => new Promise((resolve) => setTimeout(() => resolve('done'), 50)),
    });

    const res = await executeToolCall({
      registry,
      toolCall: { id: TOOL_CALL.id, name: 'slow', args: {} },
      policy: { mode: 'safe' },
      requestId: '3fa85f64-5717-4562-b3fc-2c963f66afa7',
      timeoutMs: 5,
      outputLimitBytes: 10_000,
    });

    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe('TIMEOUT');
  });

  it('caps output and marks truncated when output exceeds limit', async () => {
    const registry = new ToolRegistry();
    registry.register({
      name: 'big',
      description: 'big',
      risk: 'safe',
      argsSchema: z.object({}).strict(),
      execute: async () => ({ data: 'x'.repeat(10_000) }),
    });

    const res = await executeToolCall({
      registry,
      toolCall: { id: TOOL_CALL.id, name: 'big', args: {} },
      policy: { mode: 'safe' },
      requestId: '3fa85f64-5717-4562-b3fc-2c963f66afa7',
      timeoutMs: 50,
      outputLimitBytes: 100,
    });

    expect(res.ok).toBe(true);
    expect(res.truncated).toBe(true);
    expect(typeof res.result).toBe('string');
    expect((res.result as string).length).toBeLessThanOrEqual(100);
  });

  it('denies developer tools under safe policy', async () => {
    const registry = new ToolRegistry();
    registry.register({
      name: 'danger',
      description: 'danger',
      risk: 'developer',
      argsSchema: z.object({}).strict(),
      execute: async () => 'ok',
    });

    const res = await executeToolCall({
      registry,
      toolCall: { id: TOOL_CALL.id, name: 'danger', args: {} },
      policy: { mode: 'safe' },
      requestId: '3fa85f64-5717-4562-b3fc-2c963f66afa7',
      timeoutMs: 50,
      outputLimitBytes: 10_000,
    });

    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe('POLICY_DENIED');
  });
});

