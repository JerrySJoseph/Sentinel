import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Agent, PrismaMemoryPort } from '@sentinel/agent';
import { createPrismaClient, MemoryRepository } from '@sentinel/memory';
import { ProviderRegistry, MockProvider } from '@sentinel/providers';
import { CalculatorTool, EchoTool, ToolRegistry } from '@sentinel/tools';
import { ChatResponse } from '@sentinel/contracts';
import type { AgentCoreConfig } from '@sentinel/config';
import type { ConcurrencyLimiter } from '@sentinel/observability';
import { AGENT_CORE_CONFIG } from '../../config/config.module';
import {
  PROVIDER_CONCURRENCY_LIMITER,
  TOOL_CONCURRENCY_LIMITER,
} from '../../concurrency/concurrency.constants';

@Injectable()
export class ChatService implements OnModuleDestroy {
  private readonly agent: Agent;
  private readonly prisma: ReturnType<typeof createPrismaClient>;

  constructor(
    @Inject(AGENT_CORE_CONFIG) cfg: AgentCoreConfig,
    @Inject(PROVIDER_CONCURRENCY_LIMITER) providerLimiter: ConcurrencyLimiter,
    @Inject(TOOL_CONCURRENCY_LIMITER) toolLimiter: ConcurrencyLimiter
  ) {
    this.prisma = createPrismaClient({ databaseUrl: cfg.databaseUrl });

    const providers = new ProviderRegistry();
    providers.register(new MockProvider());

    const repo = new MemoryRepository(this.prisma);
    const memory = new PrismaMemoryPort(repo);

    const tools = new ToolRegistry();
    tools.register(new CalculatorTool());
    tools.register(new EchoTool());

    this.agent = new Agent({
      providers,
      memory,
      tools,
      toolExecution: { timeoutMs: 2000, outputLimitBytes: 50_000 },
      concurrency: { provider: providerLimiter, tool: toolLimiter },
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

