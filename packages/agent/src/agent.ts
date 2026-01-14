import { randomUUID } from 'crypto';
import {
  AgentTraceStep,
  chatResponseSchema,
  ChatResponse,
  PlanOutputSchema,
  ToolCall,
  ToolResult,
  toolCallSchema,
} from '@sentinel/contracts';
import { ProviderRegistry } from '@sentinel/providers';
import { executeToolCall, ToolRegistry } from '@sentinel/tools';
import { MemoryPort } from './memory';
import type { ConcurrencyLimiter } from '@sentinel/observability';
import { AgentBusyError } from './errors';

export type ToolPolicy = {
  mode: 'safe' | 'developer';
};

export type RunTurnInput = {
  sessionId?: string;
  requestId?: string;
  idempotencyKey?: string;
  message: string;
  provider?: string;
  toolPolicy: ToolPolicy;
};

export type ToolExecutionConfig = {
  timeoutMs: number;
  outputLimitBytes: number;
};

export class Agent {
  constructor(
    private readonly deps: {
      providers: ProviderRegistry;
      memory: MemoryPort;
      tools: ToolRegistry;
      toolExecution: ToolExecutionConfig;
      concurrency?: {
        provider?: ConcurrencyLimiter;
        tool?: ConcurrencyLimiter;
      };
    }
  ) {}

  async runTurn(input: RunTurnInput): Promise<ChatResponse> {
    const startTimeMs = Date.now();
    const startedAt = new Date().toISOString();

    const requestId = input.requestId ?? randomUUID();
    const idempotencyKey = input.idempotencyKey ?? requestId;
    const sessionId = input.sessionId ?? randomUUID();

    await this.deps.memory.ensureSession(sessionId);

    // Load history (stub memory for now), and pass it to the provider.
    const history = await this.deps.memory.loadHistory(sessionId);

    const provider = this.deps.providers.resolve(input.provider);

    let providerLease:
      | { leaseId: string; expiresAtMs: number; release: () => Promise<void> }
      | undefined;

    if (this.deps.concurrency?.provider) {
      const decision = await this.deps.concurrency.provider.tryAcquire();
      if (!decision.acquired) {
        throw new AgentBusyError({
          code: 'PROVIDER_BUSY',
          message: 'Provider is at concurrency capacity',
          retryAfterMs: decision.retryAfterMs,
        });
      }
      providerLease = {
        leaseId: decision.leaseId,
        expiresAtMs: decision.expiresAtMs!,
        release: async () =>
          await this.deps.concurrency!.provider!.release({
            leaseId: decision.leaseId,
            expiresAtMs: decision.expiresAtMs!,
          }),
      };
    }

    let planUnknown: unknown;
    try {
      planUnknown = await provider.plan({
        request: { sessionId, message: input.message, history },
        options: { requestId, sessionId },
      });
    } finally {
      if (providerLease) await providerLease.release();
    }

    // Validate provider output is shape-correct (defense-in-depth).
    const plan = PlanOutputSchema.parse(planUnknown);

    // Validate tool call shapes before executing.
    const toolCalls: ToolCall[] = plan.toolCalls.map(tc => toolCallSchema.parse(tc));

    const toolResults: ToolResult[] = [];
    const toolTraceSteps: AgentTraceStep[] = [];

    for (const toolCall of toolCalls) {
      const existing = await this.deps.memory.getToolResultByIdempotency({
        sessionId,
        toolCallId: toolCall.id,
        idempotencyKey,
      });

      let toolResult: ToolResult;
      if (existing) {
        toolResult = existing;
      } else {
        let toolLease:
          | { leaseId: string; expiresAtMs: number; release: () => Promise<void> }
          | undefined;

        if (this.deps.concurrency?.tool) {
          const decision = await this.deps.concurrency.tool.tryAcquire();
          if (!decision.acquired) {
            throw new AgentBusyError({
              code: 'TOOL_BUSY',
              message: 'Tool executor is at concurrency capacity',
              retryAfterMs: decision.retryAfterMs,
            });
          }
          toolLease = {
            leaseId: decision.leaseId,
            expiresAtMs: decision.expiresAtMs!,
            release: async () =>
              await this.deps.concurrency!.tool!.release({
                leaseId: decision.leaseId,
                expiresAtMs: decision.expiresAtMs!,
              }),
          };
        }

        try {
          toolResult = await executeToolCall({
            registry: this.deps.tools,
            toolCall,
            policy: input.toolPolicy,
            requestId,
            sessionId,
            timeoutMs: this.deps.toolExecution.timeoutMs,
            outputLimitBytes: this.deps.toolExecution.outputLimitBytes,
          });
        } finally {
          if (toolLease) await toolLease.release();
        }
      }

      toolResults.push(toolResult);

      toolTraceSteps.push({
        id: randomUUID(),
        kind: 'tool',
        name: toolCall.name,
        startedAt: toolResult.startedAt ?? new Date().toISOString(),
        endedAt: toolResult.endedAt,
        durationMs: toolResult.durationMs,
        input: { toolCall, reused: Boolean(existing) },
        output: toolResult.ok ? toolResult.result : undefined,
        error: toolResult.ok ? undefined : toolResult.error,
      });
    }

    const endedAt = new Date().toISOString();
    const latencyMs = Date.now() - startTimeMs;

    const response: ChatResponse = {
      requestId,
      sessionId,
      latencyMs,
      finalResponse: plan.finalResponse,
      toolCalls,
      toolResults,
      trace: {
        ...plan.trace,
        requestId,
        sessionId,
        steps: [...plan.trace.steps, ...toolTraceSteps],
      },
    };

    // Persist messages to memory (in-memory stub).
    await this.deps.memory.appendMessages(sessionId, [
      { role: 'user', content: input.message, createdAt: startedAt },
      { role: 'assistant', content: response.finalResponse, createdAt: endedAt },
    ]);

    await this.deps.memory.appendToolRuns(
      sessionId,
      { requestId, idempotencyKey },
      toolCalls,
      toolResults
    );

    return chatResponseSchema.parse(response);
  }
}
