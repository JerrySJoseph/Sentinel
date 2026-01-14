import { ChatMessage, JsonValue, toolErrorSchema, ToolCall, ToolResult } from '@sentinel/contracts';
import { MemoryPort } from './memory';
import { MemoryRepository, MessageRole, Prisma } from '@sentinel/memory';

function toInputJson(value: JsonValue): Prisma.InputJsonValue {
  if (value === null) return Prisma.JsonNull as unknown as Prisma.InputJsonValue;
  return value as unknown as Prisma.InputJsonValue;
}

export class PrismaMemoryPort implements MemoryPort {
  constructor(private readonly repo: MemoryRepository) {}

  async ensureSession(sessionId: string): Promise<void> {
    await this.repo.ensureSession(sessionId);
  }

  async loadHistory(sessionId: string): Promise<ChatMessage[]> {
    const messages = await this.repo.listMessages(sessionId);
    return messages.map(m => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
      toolCallId: m.toolCallId ?? undefined,
    }));
  }

  async appendMessages(sessionId: string, messages: ChatMessage[]): Promise<void> {
    for (const msg of messages) {
      await this.repo.createMessage({
        sessionId,
        role: msg.role as MessageRole,
        content: msg.content,
        toolCallId: msg.toolCallId,
        createdAt: msg.createdAt ? new Date(msg.createdAt) : undefined,
      });
    }
  }

  async getToolResultByIdempotency(input: {
    sessionId: string;
    toolCallId: string;
    idempotencyKey: string;
  }): Promise<ToolResult | null> {
    const run = await this.repo.findToolRunByIdempotency(input);
    if (!run) return null;

    return {
      toolCallId: run.toolCallId,
      name: run.name,
      ok: run.ok,
      result:
        run.result === null || run.result === undefined
          ? undefined
          : (run.result as unknown as JsonValue),
      error:
        run.error === null || run.error === undefined
          ? undefined
          : (() => {
              const parsed = toolErrorSchema.safeParse(run.error);
              return parsed.success
                ? parsed.data
                : { message: 'Invalid persisted tool error', code: 'TOOL_EXECUTION_ERROR' };
            })(),
      startedAt: run.startedAt?.toISOString(),
      endedAt: run.endedAt?.toISOString(),
      durationMs: run.durationMs ?? undefined,
      truncated: run.truncated ?? undefined,
    };
  }

  async appendToolRuns(
    sessionId: string,
    meta: { requestId: string; idempotencyKey: string },
    toolCalls: ToolCall[],
    toolResults: ToolResult[]
  ): Promise<void> {
    const byId = new Map(toolCalls.map(tc => [tc.id, tc]));
    for (const tr of toolResults) {
      const tc = byId.get(tr.toolCallId);
      if (!tc) continue;

      await this.repo.createToolRunIdempotent({
        sessionId,
        toolCallId: tr.toolCallId,
        requestId: meta.requestId,
        idempotencyKey: meta.idempotencyKey,
        name: tr.name,
        args: toInputJson(tc.args),
        ok: tr.ok,
        result: tr.result === undefined ? undefined : toInputJson(tr.result),
        error: tr.error ? toInputJson(tr.error as unknown as JsonValue) : undefined,
        startedAt: tr.startedAt ? new Date(tr.startedAt) : undefined,
        endedAt: tr.endedAt ? new Date(tr.endedAt) : undefined,
        durationMs: tr.durationMs,
        truncated: tr.truncated,
      });
    }
  }
}
