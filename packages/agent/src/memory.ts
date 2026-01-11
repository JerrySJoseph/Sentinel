import { ChatMessage } from '@sentinel/contracts';

export interface MemoryPort {
  loadHistory(sessionId: string): Promise<ChatMessage[]>;
  appendMessages(sessionId: string, messages: ChatMessage[]): Promise<void>;
}

export class InMemoryMemoryPort implements MemoryPort {
  private readonly messagesBySessionId = new Map<string, ChatMessage[]>();

  async loadHistory(sessionId: string): Promise<ChatMessage[]> {
    return this.messagesBySessionId.get(sessionId) ?? [];
  }

  async appendMessages(sessionId: string, messages: ChatMessage[]): Promise<void> {
    const existing = this.messagesBySessionId.get(sessionId) ?? [];
    this.messagesBySessionId.set(sessionId, existing.concat(messages));
  }
}

