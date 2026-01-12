import { randomUUID } from 'crypto';
import { z } from 'zod';
import { JsonObject, JsonValue, ToolCall, ToolError, ToolResult } from '@sentinel/contracts';
import { ToolNotFoundError, ToolPolicyError, ToolUserError } from './errors';
import { ToolContext, ToolPolicy } from './types';
import { ToolRegistry } from './tool-registry';

export type ExecuteToolCallOptions = {
  registry: ToolRegistry;
  toolCall: ToolCall;
  policy: ToolPolicy;
  requestId: string;
  sessionId?: string;
  timeoutMs: number;
  outputLimitBytes: number;
};

function toToolError(err: unknown): ToolError {
  if (err instanceof ToolNotFoundError) {
    return { message: err.message, code: 'TOOL_NOT_FOUND' };
  }
  if (err instanceof ToolPolicyError) {
    return { message: err.message, code: 'POLICY_DENIED' };
  }
  if (err instanceof ToolUserError) {
    return { message: err.message, code: err.code, details: err.details };
  }
  if (err instanceof z.ZodError) {
    return {
      message: 'Invalid tool arguments',
      code: 'INVALID_TOOL_ARGS',
      details: {
        issues: err.issues.map((i) => ({
          path: i.path.map((p) => String(p)),
          message: i.message,
        })),
      },
    };
  }
  if (err instanceof Error) {
    return { message: err.message || 'Tool execution failed', code: 'TOOL_EXECUTION_ERROR' };
  }
  return { message: String(err), code: 'TOOL_EXECUTION_ERROR' };
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(Object.assign(new Error(`Tool timed out after ${timeoutMs}ms`), { code: 'TIMEOUT' }));
    }, timeoutMs);

    promise
      .then((val) => resolve(val))
      .catch(reject)
      .finally(() => clearTimeout(timer));
  });
}

function enforceOutputLimit(
  value: JsonValue,
  limitBytes: number
): { value: JsonValue; truncated: boolean } {
  try {
    const json = JSON.stringify(value);
    const bytes = Buffer.byteLength(json, 'utf8');
    if (bytes <= limitBytes) return { value, truncated: false };

    // If too large, return a truncated string preview (still JsonValue-safe).
    const slice = json.slice(0, Math.max(0, limitBytes));
    return { value: slice, truncated: true };
  } catch {
    // Non-serializable output -> coerce to string.
    const str = String(value);
    const truncated = Buffer.byteLength(str, 'utf8') > limitBytes;
    return { value: truncated ? str.slice(0, Math.max(0, limitBytes)) : str, truncated };
  }
}

export async function executeToolCall(opts: ExecuteToolCallOptions): Promise<ToolResult> {
  const startedAt = new Date().toISOString();
  const startTimeMs = Date.now();

  try {
    const tool = opts.registry.get(opts.toolCall.name);

    if (tool.risk === 'developer' && opts.policy.mode !== 'developer') {
      throw new ToolPolicyError(tool.name, `Tool "${tool.name}" requires developer policy`);
    }

    const args = tool.argsSchema.parse(opts.toolCall.args);

    const ctx: ToolContext = {
      requestId: opts.requestId,
      sessionId: opts.sessionId,
      policy: opts.policy,
    };

    const rawResult = await withTimeout(tool.execute(args, ctx), opts.timeoutMs);
    const { value: capped, truncated } = enforceOutputLimit(rawResult, opts.outputLimitBytes);

    const endedAt = new Date().toISOString();
    const durationMs = Date.now() - startTimeMs;

    return {
      toolCallId: opts.toolCall.id,
      name: opts.toolCall.name,
      ok: true,
      result: capped,
      startedAt,
      endedAt,
      durationMs,
      truncated: truncated || undefined,
    };
  } catch (err) {
    const endedAt = new Date().toISOString();
    const durationMs = Date.now() - startTimeMs;

    let toolError = toToolError(err);
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code?: unknown }).code === 'TIMEOUT'
    ) {
      toolError = { message: toolError.message, code: 'TIMEOUT' };
    }

    return {
      toolCallId: opts.toolCall.id,
      name: opts.toolCall.name,
      ok: false,
      error: toolError,
      startedAt,
      endedAt,
      durationMs,
    };
  }
}

export function createToolCall(name: string, args: JsonObject): ToolCall {
  return {
    id: randomUUID(),
    name,
    args,
  };
}

