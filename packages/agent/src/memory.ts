import { ChatMessage, ToolCall, ToolResult } from '@sentinel/contracts';

export interface MemoryPort {
  ensureSession(sessionId: string): Promise<void>;
  loadHistory(sessionId: string): Promise<ChatMessage[]>;
  appendMessages(sessionId: string, messages: ChatMessage[]): Promise<void>;
  getToolResultByIdempotency(input: {
    sessionId: string;
    toolCallId: string;
    idempotencyKey: string;
  }): Promise<ToolResult | null>;
  appendToolRuns(
    sessionId: string,
    meta: { requestId: string; idempotencyKey: string },
    toolCalls: ToolCall[],
    toolResults: ToolResult[]
  ): Promise<void>;
}

export class InMemoryMemoryPort implements MemoryPort {
  private readonly messagesBySessionId = new Map<string, ChatMessage[]>();
  private readonly toolRunsByKey = new Map<string, ToolResult>();

  ensureSession(_sessionId: string): Promise<void> {
    // no-op for in-memory
    return Promise.resolve();
  }

  loadHistory(sessionId: string): Promise<ChatMessage[]> {
    return Promise.resolve(this.messagesBySessionId.get(sessionId) ?? []);
  }

  appendMessages(sessionId: string, messages: ChatMessage[]): Promise<void> {
    const existing = this.messagesBySessionId.get(sessionId) ?? [];
    this.messagesBySessionId.set(sessionId, existing.concat(messages));
    return Promise.resolve();
  }

  appendToolRuns(
    sessionId: string,
    meta: { requestId: string; idempotencyKey: string },
    toolCalls: ToolCall[],
    toolResults: ToolResult[]
  ): Promise<void> {
    const byId = new Map(toolCalls.map(tc => [tc.id, tc]));
    for (const tr of toolResults) {
      const tc = byId.get(tr.toolCallId);
      if (!tc) continue;
      const key = `${sessionId}:${meta.idempotencyKey}:${tr.toolCallId}`;
      this.toolRunsByKey.set(key, tr);
    }
    return Promise.resolve();
  }

  getToolResultByIdempotency(input: {
    sessionId: string;
    toolCallId: string;
    idempotencyKey: string;
  }): Promise<ToolResult | null> {
    const key = `${input.sessionId}:${input.idempotencyKey}:${input.toolCallId}`;
    return Promise.resolve(this.toolRunsByKey.get(key) ?? null);
  }
}
