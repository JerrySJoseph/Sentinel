import { Injectable } from '@nestjs/common';
import { Agent, InMemoryMemoryPort } from '@sentinel/agent';
import { ProviderRegistry, MockProvider } from '@sentinel/providers';
import { ChatResponse } from '@sentinel/contracts';

@Injectable()
export class ChatService {
  private readonly agent: Agent;

  constructor() {
    const providers = new ProviderRegistry();
    providers.register(new MockProvider());

    // NOTE: In-memory stub only. Replace with Postgres-backed memory port later.
    const memory = new InMemoryMemoryPort();

    this.agent = new Agent({ providers, memory });
  }

  async runTurn(input: { sessionId?: string; message: string }): Promise<ChatResponse> {
    return await this.agent.runTurn({
      sessionId: input.sessionId,
      message: input.message,
      provider: 'mock',
      toolPolicy: { mode: 'safe' },
    });
  }
}

