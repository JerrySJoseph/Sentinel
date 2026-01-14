import { CalculatorTool, executeToolCall, ToolRegistry } from '../src';

const REQUEST_ID = '3fa85f64-5717-4562-b3fc-2c963f66afa6';
const TOOL_CALL_ID = '3fa85f64-5717-4562-b3fc-2c963f66afa7';

function toolCall(expression: string) {
  return {
    id: TOOL_CALL_ID,
    name: 'calculator',
    args: { expression },
  } as const;
}

describe('CalculatorTool', () => {
  it('evaluates precedence: 1 + 2 * 3 = 7', async () => {
    const registry = new ToolRegistry();
    registry.register(new CalculatorTool());

    const res = await executeToolCall({
      registry,
      toolCall: toolCall('1 + 2 * 3'),
      policy: { mode: 'safe' },
      requestId: REQUEST_ID,
      timeoutMs: 50,
      outputLimitBytes: 10_000,
    });

    expect(res.ok).toBe(true);
    expect(res.result).toBe(7);
  });

  it('evaluates parentheses: (1 + 2) * 3 = 9', async () => {
    const registry = new ToolRegistry();
    registry.register(new CalculatorTool());

    const res = await executeToolCall({
      registry,
      toolCall: toolCall('(1 + 2) * 3'),
      policy: { mode: 'safe' },
      requestId: REQUEST_ID,
      timeoutMs: 50,
      outputLimitBytes: 10_000,
    });

    expect(res.ok).toBe(true);
    expect(res.result).toBe(9);
  });

  it('supports decimals and whitespace', async () => {
    const registry = new ToolRegistry();
    registry.register(new CalculatorTool());

    const res = await executeToolCall({
      registry,
      toolCall: toolCall('  3.5  * 2 '),
      policy: { mode: 'safe' },
      requestId: REQUEST_ID,
      timeoutMs: 50,
      outputLimitBytes: 10_000,
    });

    expect(res.ok).toBe(true);
    expect(res.result).toBe(7);
  });

  it('supports unary minus with parentheses: -(1+2) = -3', async () => {
    const registry = new ToolRegistry();
    registry.register(new CalculatorTool());

    const res = await executeToolCall({
      registry,
      toolCall: toolCall('-(1+2)'),
      policy: { mode: 'safe' },
      requestId: REQUEST_ID,
      timeoutMs: 50,
      outputLimitBytes: 10_000,
    });

    expect(res.ok).toBe(true);
    expect(res.result).toBe(-3);
  });

  it('supports unary minus after operator: 2*-3 = -6', async () => {
    const registry = new ToolRegistry();
    registry.register(new CalculatorTool());

    const res = await executeToolCall({
      registry,
      toolCall: toolCall('2*-3'),
      policy: { mode: 'safe' },
      requestId: REQUEST_ID,
      timeoutMs: 50,
      outputLimitBytes: 10_000,
    });

    expect(res.ok).toBe(true);
    expect(res.result).toBe(-6);
  });

  it('rejects invalid characters', async () => {
    const registry = new ToolRegistry();
    registry.register(new CalculatorTool());

    const res = await executeToolCall({
      registry,
      toolCall: toolCall('1 + abc'),
      policy: { mode: 'safe' },
      requestId: REQUEST_ID,
      timeoutMs: 50,
      outputLimitBytes: 10_000,
    });

    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe('INVALID_CHAR');
    expect(res.error?.details).toEqual(expect.objectContaining({ char: 'a' }));
  });

  it('rejects division by zero', async () => {
    const registry = new ToolRegistry();
    registry.register(new CalculatorTool());

    const res = await executeToolCall({
      registry,
      toolCall: toolCall('1/0'),
      policy: { mode: 'safe' },
      requestId: REQUEST_ID,
      timeoutMs: 50,
      outputLimitBytes: 10_000,
    });

    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe('DIVISION_BY_ZERO');
  });

  it('rejects mismatched parentheses', async () => {
    const registry = new ToolRegistry();
    registry.register(new CalculatorTool());

    const res = await executeToolCall({
      registry,
      toolCall: toolCall('(1+2'),
      policy: { mode: 'safe' },
      requestId: REQUEST_ID,
      timeoutMs: 50,
      outputLimitBytes: 10_000,
    });

    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe('MISMATCHED_PARENS');
  });

  it('rejects invalid syntax (unexpected operator)', async () => {
    const registry = new ToolRegistry();
    registry.register(new CalculatorTool());

    const res = await executeToolCall({
      registry,
      toolCall: toolCall('1+*2'),
      policy: { mode: 'safe' },
      requestId: REQUEST_ID,
      timeoutMs: 50,
      outputLimitBytes: 10_000,
    });

    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe('INVALID_SYNTAX');
  });

  it('rejects invalid number literals (multiple dots)', async () => {
    const registry = new ToolRegistry();
    registry.register(new CalculatorTool());

    const res = await executeToolCall({
      registry,
      toolCall: toolCall('1..2'),
      policy: { mode: 'safe' },
      requestId: REQUEST_ID,
      timeoutMs: 50,
      outputLimitBytes: 10_000,
    });

    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe('INVALID_NUMBER');
  });

  it('enforces args schema (missing expression)', async () => {
    const registry = new ToolRegistry();
    registry.register(new CalculatorTool());

    const res = await executeToolCall({
      registry,
      toolCall: {
        id: TOOL_CALL_ID,
        name: 'calculator',
        args: {},
      },
      policy: { mode: 'safe' },
      requestId: REQUEST_ID,
      timeoutMs: 50,
      outputLimitBytes: 10_000,
    });

    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe('INVALID_TOOL_ARGS');
  });
});
