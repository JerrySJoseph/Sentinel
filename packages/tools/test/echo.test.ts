import { EchoTool, executeToolCall, ToolRegistry } from '../src';

describe('EchoTool', () => {
  it('echoes the provided text', async () => {
    const registry = new ToolRegistry();
    registry.register(new EchoTool());

    const res = await executeToolCall({
      registry,
      toolCall: {
        id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
        name: 'echo',
        args: { text: 'hello' },
      },
      policy: { mode: 'safe' },
      requestId: '3fa85f64-5717-4562-b3fc-2c963f66afa7',
      timeoutMs: 50,
      outputLimitBytes: 10_000,
    });

    expect(res.ok).toBe(true);
    expect(res.name).toBe('echo');
    expect(res.result).toEqual({ echoed: 'hello', length: 5 });
  });

  it('rejects invalid args (empty text)', async () => {
    const registry = new ToolRegistry();
    registry.register(new EchoTool());

    const res = await executeToolCall({
      registry,
      toolCall: {
        id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
        name: 'echo',
        args: { text: '' },
      },
      policy: { mode: 'safe' },
      requestId: '3fa85f64-5717-4562-b3fc-2c963f66afa7',
      timeoutMs: 50,
      outputLimitBytes: 10_000,
    });

    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe('INVALID_TOOL_ARGS');
  });
});
