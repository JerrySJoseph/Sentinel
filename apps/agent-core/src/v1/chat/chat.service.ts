import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Agent, PrismaMemoryPort } from '@sentinel/agent';
import { createPrismaClient, MemoryRepository } from '@sentinel/memory';
import { ProviderRegistry, MockProvider } from '@sentinel/providers';
import { CalculatorTool, EchoTool, ToolRegistry } from '@sentinel/tools';
import { ChatResponse, type JsonObject } from '@sentinel/contracts';
import type { AgentCoreConfig } from '@sentinel/config';
import type { ConcurrencyLimiter } from '@sentinel/observability';
import { AGENT_CORE_CONFIG } from '../../config/config.module';
import {
  PROVIDER_CONCURRENCY_LIMITER,
  TOOL_CONCURRENCY_LIMITER,
} from '../../concurrency/concurrency.constants';
import type { LLMProvider } from '@sentinel/providers';
import type { Tool } from '@sentinel/tools';
import { MetricsService } from '../../metrics/metrics.service';

@Injectable()
export class ChatService implements OnModuleDestroy {
  private readonly agent: Agent;
  private readonly prisma: ReturnType<typeof createPrismaClient>;

  constructor(
    @Inject(AGENT_CORE_CONFIG) cfg: AgentCoreConfig,
    @Inject(PROVIDER_CONCURRENCY_LIMITER) providerLimiter: ConcurrencyLimiter,
    @Inject(TOOL_CONCURRENCY_LIMITER) toolLimiter: ConcurrencyLimiter,
    private readonly metrics: MetricsService
  ) {
    this.prisma = createPrismaClient({ databaseUrl: cfg.databaseUrl });

    const providers = new ProviderRegistry();
    providers.register(this.wrapProviderWithMetrics(new MockProvider()));

    const repo = new MemoryRepository(this.prisma);
    const memory = new PrismaMemoryPort(repo);

    const tools = new ToolRegistry();
    tools.register(this.wrapToolWithMetrics(new CalculatorTool()));
    tools.register(this.wrapToolWithMetrics(new EchoTool()));

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
    const startNs = process.hrtime.bigint();
    try {
      return await this.agent.runTurn({
        requestId: input.requestId,
        idempotencyKey: input.idempotencyKey,
        sessionId: input.sessionId,
        message: input.message,
        provider: 'mock',
        toolPolicy: { mode: 'safe' },
      });
    } finally {
      const endNs = process.hrtime.bigint();
      const durationSeconds = Number(endNs - startNs) / 1e9;
      this.metrics.observeAgentTurn(durationSeconds);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.prisma.$disconnect();
  }

  private wrapProviderWithMetrics(provider: LLMProvider): LLMProvider {
    const name = provider.name;
    return {
      name,
      plan: async input => {
        const startNs = process.hrtime.bigint();
        try {
          return await provider.plan(input);
        } finally {
          const endNs = process.hrtime.bigint();
          const durationSeconds = Number(endNs - startNs) / 1e9;
          this.metrics.observeProvider(name, durationSeconds);
        }
      },
    };
  }

  private wrapToolWithMetrics<TArgs extends JsonObject>(tool: Tool<TArgs>): Tool<TArgs> {
    const name = tool.name;
    return {
      ...tool,
      execute: async (args, ctx) => {
        const startNs = process.hrtime.bigint();
        try {
          return await tool.execute(args, ctx);
        } finally {
          const endNs = process.hrtime.bigint();
          const durationSeconds = Number(endNs - startNs) / 1e9;
          this.metrics.observeTool(name, durationSeconds);
        }
      },
    };
  }
}
