# Add a Tool (Step-by-step)

This guide shows how to add a **safe** tool to Sentinel end-to-end:

- define a Zod args schema (runtime validation)
- implement the tool in `packages/tools`
- register it in `agent-core`
- make it invokable via the dev `MockProvider`
- add tests proving it shows up in **`toolCalls`**, **`toolResults`**, and the **agent trace**

> Example tool used here: `echo` (safe, deterministic).

## 1) Create the tool implementation

Create a new builtin tool file:

- `packages/tools/src/builtin/echo.ts`

It should:

- export an `argsSchema` (Zod)
- implement `Tool<Args>` with `name`, `description`, `risk`, `argsSchema`, and `execute`
- return a JSON-serializable value (`JsonValue`)

Key implementation (already added):

```1:33:/Volumes/Disk1/Projects/NestJS Projects/Sentinel/packages/tools/src/builtin/echo.ts
import { z } from 'zod';
import { JsonValue } from '@sentinel/contracts';
import { Tool, ToolContext } from '../types';

export const echoArgsSchema = z
  .object({
    text: z.string().min(1).max(10_000),
  })
  .strict();

const echoResultSchema = z
  .object({
    echoed: z.string(),
    length: z.number().int().nonnegative(),
  })
  .strict();

/**
 * A safe, deterministic tool that returns its input.
 * Useful as a template for adding new tools.
 */
export class EchoTool implements Tool<z.infer<typeof echoArgsSchema>> {
  readonly name = 'echo';
  readonly description = 'Echo back the provided text (safe, deterministic).';
  readonly risk = 'safe' as const;
  readonly argsSchema = echoArgsSchema;

  async execute(args: z.infer<typeof echoArgsSchema>, _ctx: ToolContext): Promise<JsonValue> {
    // Validate output shape as defense-in-depth.
    return echoResultSchema.parse({ echoed: args.text, length: args.text.length });
  }
}
```

## 2) Export the tool from `@sentinel/tools`

Add it to `packages/tools/src/index.ts` so other packages can import it:

```1:7:/Volumes/Disk1/Projects/NestJS Projects/Sentinel/packages/tools/src/index.ts
export * from './types';
export * from './errors';
export * from './tool-registry';
export * from './executor';
export * from './builtin/calculator';
export * from './builtin/echo';
```

## 3) Register the tool in `agent-core`

Tools are registered into a `ToolRegistry` at startup. Add your tool alongside existing ones:

```18:33:/Volumes/Disk1/Projects/NestJS Projects/Sentinel/apps/agent-core/src/v1/chat/chat.service.ts
    const tools = new ToolRegistry();
    tools.register(new CalculatorTool());
    tools.register(new EchoTool());

    this.agent = new Agent({
      providers,
      memory,
      tools,
      toolExecution: { timeoutMs: 2000, outputLimitBytes: 50_000 },
    });
```

## 4) Make it invokable in dev (MockProvider)

The dev `MockProvider` is deterministic and returns tool calls without hitting real LLMs.
We added a simple rule:

- if the user message matches `echo <text>`, call the `echo` tool
- otherwise, call the `calculator` tool

```9:41:/Volumes/Disk1/Projects/NestJS Projects/Sentinel/packages/providers/src/mock-provider.ts
    const msg = input.request.message ?? '';
    const finalResponse = `MockProvider: ${msg}`;

    // For dev/testing: allow exercising multiple tools deterministically.
    // - "echo <text>" -> echo tool
    // - otherwise -> calculator tool
    const echoMatch = msg.match(/^echo\\s+([\\s\\S]+)$/i);
    const toolCall =
      echoMatch
        ? {
            id: input.options.requestId,
            name: 'echo',
            args: { text: echoMatch[1] },
          }
        : {
            id: input.options.requestId,
            name: 'calculator',
            args: { expression: '1 + 2 * 3' },
          };
```

## 5) Add unit tests (tool package)

Add a test in `packages/tools/test/echo.test.ts` that executes the tool via `executeToolCall`
and asserts:

- args are validated (Zod)
- result is returned in `toolResults`

```1:44:/Volumes/Disk1/Projects/NestJS Projects/Sentinel/packages/tools/test/echo.test.ts
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
});
```

## 6) Add an integration-style test (agent trace visibility)

To prove the tool is visible where it matters (agent response), add a test in:

- `packages/agent/test/agent-tools.test.ts`

This test asserts the tool appears in:

- `res.toolCalls`
- `res.toolResults`
- `res.trace.steps` as a `kind: "tool"` step

```61:118:/Volumes/Disk1/Projects/NestJS Projects/Sentinel/packages/agent/test/agent-tools.test.ts
  it('executes echo tool call and includes it in trace/toolResults', async () => {
    const providers = new ProviderRegistry();
    providers.register({
      name: 'planner',
      plan: async (input) => ({
        toolCalls: [
          {
            id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
            name: 'echo',
            args: { text: 'hi' },
          },
        ],
        finalResponse: 'echoed',
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
    tools.register(new EchoTool());

    const agent = new Agent({
      providers,
      memory: new InMemoryMemoryPort(),
      tools,
      toolExecution: { timeoutMs: 50, outputLimitBytes: 10_000 },
    });

    const res = await agent.runTurn({
      message: 'echo hi',
      provider: 'planner',
      toolPolicy: { mode: 'safe' },
    });

    expect(res.toolCalls).toHaveLength(1);
    expect(res.toolCalls[0].name).toBe('echo');

    expect(res.toolResults).toHaveLength(1);
    expect(res.toolResults[0].ok).toBe(true);
    expect(res.toolResults[0].name).toBe('echo');
    expect(res.toolResults[0].result).toEqual({ echoed: 'hi', length: 2 });

    const toolSteps = res.trace.steps.filter((s) => s.kind === 'tool');
    expect(toolSteps).toHaveLength(1);
    expect(toolSteps[0].name).toBe('echo');
  });
```

## 7) Verify manually in the UI

1. Start everything:

```bash
pnpm dev
```

2. Open the UI: `http://localhost:3001`
3. Send a message like:

```text
echo hello from sentinel
```

4. In the UI, open **Inspect** on the assistant response:
   - `toolCalls` should include `{ name: "echo", args: { text: "hello from sentinel" } }`
   - `toolResults` should include `{ ok: true, result: { echoed: "...", length: ... } }`
   - `trace.steps` should include a `kind: "tool"` step with `name: "echo"`

## Notes / conventions

- **Schema validation is mandatory**: tool args must be validated with Zod (`argsSchema.parse(...)` happens in the executor).
- **Keep tools safe by default**: use `risk: "safe"` unless you explicitly gate it behind developer policy.
- **Return JSON only**: tool results must be JSON-serializable (`JsonValue`).

