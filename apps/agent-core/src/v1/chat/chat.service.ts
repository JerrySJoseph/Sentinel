import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Agent, PrismaMemoryPort } from '@sentinel/agent';
import { createPrismaClient, MemoryRepository } from '@sentinel/memory';
import { ProviderRegistry, MockProvider } from '@sentinel/providers';
import { CalculatorTool, ToolRegistry } from '@sentinel/tools';
import { ChatResponse } from '@sentinel/contracts';

@Injectable()
export class ChatService implements OnModuleDestroy {
  private readonly agent: Agent;
  private readonly prisma = createPrismaClient({ databaseUrl: process.env.DATABASE_URL });

  constructor() {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is required (Postgres) for agent-core to be stateless');
    }

    const providers = new ProviderRegistry();
    providers.register(new MockProvider());

    const repo = new MemoryRepository(this.prisma);
    const memory = new PrismaMemoryPort(repo);

    const tools = new ToolRegistry();
    tools.register(new CalculatorTool());

    this.agent = new Agent({
      providers,
      memory,
      tools,
      toolExecution: { timeoutMs: 2000, outputLimitBytes: 50_000 },
    });
  }

  async runTurn(input: {
    requestId?: string;
    idempotencyKey?: string;
    sessionId?: string;
    message: string;
  }): Promise<ChatResponse> {
    return await this.agent.runTurn({
      requestId: input.requestId,
      idempotencyKey: input.idempotencyKey,
      sessionId: input.sessionId,
      message: input.message,
      provider: 'mock',
      toolPolicy: { mode: 'safe' },
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

